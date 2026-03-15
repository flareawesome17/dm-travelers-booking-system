import { useState, useMemo } from "react";
import { Plus, Minus, Trash2, Search, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

type MenuItem = { id: string; name?: string; category?: string | null; price?: number | null; image_url?: string | null };
type BookingOption = { id: string; reference_number?: string; status?: string; payment_status?: string; guests?: { full_name?: string | null }; rooms?: { room_number?: string | null } };

type OrderFormProps = {
  items: MenuItem[];
  bookings: BookingOption[];
  onSuccess: () => void;
  onCancel: () => void;
};

export function RestaurantOrderForm({ items, bookings, onSuccess, onCancel }: OrderFormProps) {
  const [orderSource, setOrderSource] = useState<"Restaurant" | "Room Service" | "Walk-In">("Restaurant");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "GCash" | "Card" | "Charged to Room" | "Pending Payment">("Pending Payment");
  const [orderBookingRef, setOrderBookingRef] = useState<string>("");
  const [orderBookingSearch, setOrderBookingSearch] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItemSearch, setOrderItemSearch] = useState("");
  const [orderLines, setOrderLines] = useState<{ menu_item_id: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter items that are not yet added
  const availableItems = useMemo(() => {
    const search = orderItemSearch.toLowerCase().trim();
    return items.filter((m) => {
      if (orderLines.some((l) => l.menu_item_id === m.id)) return false;
      if (!search) return true;
      return m.name?.toLowerCase().includes(search) || m.category?.toLowerCase().includes(search);
    });
  }, [items, orderItemSearch, orderLines]);

  const activeRoomServiceBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "Checked-In");
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const term = orderBookingSearch.toLowerCase().trim();
    if (!term) return activeRoomServiceBookings;

    return activeRoomServiceBookings.filter((b) =>
      [b.reference_number, b.guests?.full_name, b.rooms?.room_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [activeRoomServiceBookings, orderBookingSearch]);

  const addLine = (menu_item_id: string) => {
    setOrderLines((prev) => [...prev, { menu_item_id, quantity: 1 }]);
    setOrderItemSearch("");
  };

  const updateQty = (id: string, delta: number) => {
    setOrderLines((prev) => prev.map((l) => {
      if (l.menu_item_id === id) {
        const newQty = l.quantity + delta;
        return { ...l, quantity: newQty > 0 ? newQty : 1 };
      }
      return l;
    }));
  };

  const removeLine = (id: string) => {
    setOrderLines((prev) => prev.filter((l) => l.menu_item_id !== id));
  };

  const subtotal = useMemo(() => {
    return orderLines.reduce((sum, line) => {
      const item = items.find((i) => i.id === line.menu_item_id);
      return sum + (Number(item?.price || 0) * line.quantity);
    }, 0);
  }, [orderLines, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderLines.length === 0) { toast.error("Please add at least one item to the order."); return; }
    if (orderSource === "Room Service" && !orderBookingRef.trim()) { toast.error("Booking reference is required for Room Service."); return; }
    
    setSaving(true);
    const token = localStorage.getItem("admin_token");
    if (!token) { window.location.href = "/admin/login"; return; }

    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_source: orderSource,
          customer_name: customerName.trim() || null,
          payment_method: orderSource === "Room Service" ? "Charged to Room" : paymentMethod,
          booking_reference: orderSource === "Room Service" ? orderBookingRef.trim() || null : null,
          notes: orderNotes.trim() || null,
          items: orderLines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { throw new Error(data.error || "Failed to create order."); }
      
      toast.success(orderSource === "Room Service" ? "Order created and charged to room." : "Restaurant order created successfully.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[85vh]">
      <ScrollArea className="flex-1 pr-4 pl-1 pb-4">
        <div className="space-y-6">
          {/* Order Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-2">
              <Label htmlFor="order-source" className="text-xs font-bold uppercase text-slate-500">Order source</Label>
              <select 
                id="order-source" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20 focus:border-[#07008A] transition-all shadow-sm" 
                value={orderSource} 
                onChange={(e) => {
                  const newSource = e.target.value as any;
                  setOrderSource(newSource);
                  if (newSource === "Room Service") {
                    setOrderBookingRef("");
                    setPaymentMethod("Charged to Room");
                  } else {
                    setPaymentMethod("Pending Payment");
                  }
                }}
              >
                <option value="Restaurant">Restaurant (Dine-in)</option>
                <option value="Room Service">Room Service</option>
                <option value="Walk-In">Walk-In (Takeout)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method" className="text-xs font-bold uppercase text-slate-500">Payment Status</Label>
              <select 
                id="payment-method" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20 focus:border-[#07008A] transition-all disabled:opacity-50 shadow-sm" 
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                disabled={orderSource === "Room Service"}
              >
                <option value="Pending Payment">Pay Later / Pending</option>
                <option value="Cash">Paid - Cash</option>
                <option value="GCash">Paid - GCash</option>
                <option value="Card">Paid - Card</option>
                {orderSource === "Room Service" && <option value="Charged to Room">Charged to Room</option>}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-name" className="text-xs font-bold uppercase text-slate-500">{orderSource === "Room Service" ? "Guest Name" : "Customer Name"}</Label>
              <Input 
                id="customer-name" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                placeholder={orderSource === "Room Service" ? "Select a booking first..." : "Enter guest name..."} 
                disabled={orderSource === "Room Service"}
                className="h-10 border-slate-200 focus:border-[#07008A] transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Room Service Link Section */}
          {orderSource === "Room Service" && (
            <div className="p-4 rounded-xl border border-[#07008A]/10 bg-[#07008A]/[0.02] space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-[#07008A]">
                <Search className="h-4 w-4" />
                <span className="text-sm font-semibold">Link to Guest Booking</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="order-booking-search" className="text-xs text-slate-500">Quick Search</Label>
                  <Input 
                    id="order-booking-search" 
                    value={orderBookingSearch} 
                    onChange={(e) => setOrderBookingSearch(e.target.value)} 
                    placeholder="Search by name, room or ref..." 
                    className="h-10 text-sm" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-booking-ref" className="text-xs text-slate-500">Select Matching Booking</Label>
                  <select 
                    id="order-booking-ref" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20 focus:border-[#07008A] transition-all" 
                    value={orderBookingRef} 
                    onChange={(e) => {
                      const ref = e.target.value;
                      setOrderBookingRef(ref);
                      const b = activeRoomServiceBookings.find((x) => x.reference_number === ref);
                      if (b && b.guests?.full_name) {
                        setCustomerName(b.guests.full_name);
                      }
                    }} 
                  >
                    <option value="">Choose guest...</option>
                    {filteredBookings.map((b) => (
                      <option key={b.id} value={b.reference_number ?? ""}>
                        {b.rooms?.room_number ? `Rm ${b.rooms.room_number}` : "No room"} - {b.guests?.full_name ?? "Guest"} ({b.reference_number})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="order-notes" className="text-xs font-bold uppercase text-slate-500">Order Notes (optional)</Label>
            <Input 
              id="order-notes" 
              value={orderNotes} 
              onChange={(e) => setOrderNotes(e.target.value)} 
              placeholder="Allergies, special instructions, fast prep needed..." 
              className="h-10 border-slate-200 focus:border-[#07008A]"
            />
          </div>

          <hr className="border-slate-100" />

          {/* Bottom Section: Order Lines */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Catalog Search */}
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label>Menu Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search dishes or drinks..." 
                    value={orderItemSearch} 
                    onChange={(e) => setOrderItemSearch(e.target.value)} 
                    className="pl-9" 
                  />
                </div>
              </div>
              
              <ScrollArea className="h-64 rounded-md border bg-slate-50/50 p-2">
                {availableItems.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">No menu items found.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {availableItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addLine(item.id)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-[#07008A]/5 border border-transparent hover:border-[#07008A]/10 text-left transition-colors group"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 group-hover:text-[#07008A]">{item.name}</span>
                          <span className="text-xs text-slate-400">{item.category}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-slate-600">₱{Number(item.price ?? 0).toFixed(0)}</span>
                          <div className="h-6 w-6 rounded-full bg-white border shadow-sm flex items-center justify-center text-[#07008A] group-hover:bg-[#07008A] group-hover:text-white transition-colors">
                            <Plus className="h-3 w-3" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Cart Items */}
            <div className="lg:col-span-3 space-y-4 flex flex-col">
              <Label>Order Summary</Label>
              <Card className="flex-1 border-slate-200 overflow-hidden flex flex-col bg-white">
                <ScrollArea className="h-64 p-0">
                  {orderLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                      <UtensilsCrossed className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm">No items in the cart yet.</p>
                      <p className="text-xs mt-1">Select items from the menu to add them.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                        <tr>
                          <th className="py-2 px-4 text-left font-medium text-xs text-slate-500">Item</th>
                          <th className="py-2 px-4 text-center font-medium text-xs text-slate-500">Qty</th>
                          <th className="py-2 px-4 text-right font-medium text-xs text-slate-500">Price</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderLines.map((line) => {
                          const item = items.find((i) => i.id === line.menu_item_id);
                          if (!item) return null;
                          const lineTotal = Number(item.price || 0) * line.quantity;
                          return (
                            <tr key={line.menu_item_id} className="border-b last:border-0 hover:bg-slate-50/40">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-700">{item.name}</div>
                                <div className="text-xs text-slate-400">₱{Number(item.price ?? 0).toFixed(0)}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => updateQty(line.menu_item_id, -1)} disabled={line.quantity <= 1}><Minus className="h-3 w-3" /></Button>
                                  <span className="w-4 text-center text-sm font-semibold">{line.quantity}</span>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => updateQty(line.menu_item_id, 1)}><Plus className="h-3 w-3" /></Button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-700">
                                ₱{lineTotal.toFixed(0)}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeLine(line.menu_item_id)}><Trash2 className="h-4 w-4" /></Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
                <div className="mt-auto border-t bg-slate-50 p-4">
                  <div className="flex justify-between items-center text-sm mb-1 text-slate-500">
                    <span>Subtotal</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold text-[#07008A]">
                    <span>Total Amount</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
      
      <div className="flex justify-end gap-3 pt-5 mt-auto border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a] text-white px-8" disabled={saving || orderLines.length === 0}>
          {saving ? "Processing..." : `Confirm Order (₱${subtotal.toFixed(0)})`}
        </Button>
      </div>
    </form>
  );
}
