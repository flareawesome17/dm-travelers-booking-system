import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UtensilsCrossed, Plus, Pencil, Trash2 } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

const API_URL = import.meta.env.VITE_API_URL || "";

type MenuItem = {
  id: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  is_available?: boolean | null;
  image_url?: string | null;
};

type RestaurantCategory = {
  id: string;
  name: string;
  sort_order?: number | null;
};

type BookingOption = {
  id: string;
  reference_number?: string;
  check_in_date?: string;
  check_out_date?: string;
  status?: string;
  guests?: { full_name?: string | null };
  rooms?: { room_number?: string | null };
};

type RestaurantOrder = {
  id: string;
  booking_id?: string | null;
  room_id?: string | null;
  order_source?: string | null;
  status?: string | null;
  subtotal?: number | null;
  service_charge?: number | null;
  total_amount?: number | null;
  created_at?: string | null;
};

export default function AdminRestaurant() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSource, setOrderSource] = useState<"Restaurant" | "Room Service" | "Walk-In">("Restaurant");
  const [orderBookingRef, setOrderBookingRef] = useState<string>("");
  const [orderBookingSearch, setOrderBookingSearch] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItemSearch, setOrderItemSearch] = useState("");
  const [orderLines, setOrderLines] = useState<{ menu_item_id: string; quantity: string }[]>([]);
  const navigate = useNavigate();

  const loadItems = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/menu`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? (data as MenuItem[]) : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    setCategoriesLoading(true);
    fetch(`${API_URL}/api/restaurant-categories`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as RestaurantCategory[]) : [];
        setCategories(list);
        if (!editingItem && !category && list.length > 0) {
          setCategory(list[0].name);
        }
      })
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    loadItems();
    loadCategories();
    // fetch bookings for Room Service dropdown (only once)
    fetch(`${API_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setBookings(Array.isArray(data) ? (data as BookingOption[]) : []))
      .catch(() => setBookings([]));
    // fetch recent restaurant orders
    fetch(`${API_URL}/api/restaurant/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? (data as RestaurantOrder[]) : []))
      .catch(() => setOrders([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const resetForm = () => {
    setName("");
    setCategory(categories[0]?.name ?? "");
    setPrice("");
    setDescription("");
    setIsAvailable(true);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const openForCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openOrderForm = () => {
    setOrderSource("Restaurant");
    setOrderBookingRef("");
    setOrderBookingSearch("");
    setOrderNotes("");
    setOrderItemSearch("");
    setOrderLines([]);
    setOrderOpen(true);
  };

  const openForEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name ?? "");
    setCategory(item.category ?? categories[0]?.name ?? "");
    setPrice(item.price != null ? String(item.price) : "");
    setDescription(item.description ?? "");
    setIsAvailable(item.is_available ?? true);
    setImageFile(null);
    setImagePreview(item.image_url ?? null);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!name.trim() || !price.trim() || !category.trim()) {
      toast.error("Name, category, and price are required.");
      return;
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast.error("Price must be a positive number.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingItem?.id);
      const endpoint = isEdit
        ? `${API_URL}/api/menu/${editingItem!.id}`
        : `${API_URL}/api/menu`;
      const method = isEdit ? "PATCH" : "POST";
      let imageUrlToUse: string | null = editingItem?.image_url ?? null;

      if (imageFile) {
        const token = localStorage.getItem("admin_token");
        if (!token) {
          navigate("/admin/login", { replace: true });
          return;
        }
        const filePayload = await new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              name: imageFile.name,
              type: imageFile.type || "image/jpeg",
              data: String(reader.result ?? ""),
            });
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(imageFile);
        });
        const uploadRes = await fetch(`${API_URL}/api/menu/upload-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ file: filePayload }),
        });
        const uploadData = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!uploadRes.ok || !uploadData.url) {
          toast.error(uploadData.error || "Failed to upload image.");
          setSaving(false);
          return;
        }
        imageUrlToUse = uploadData.url;
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: numericPrice,
          category,
          is_available: isAvailable,
          image_url: imageUrlToUse,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to save menu item.");
        return;
      }
      setItems((prev) => {
        const updated = data as MenuItem;
        if (!updated.id) return prev;
        const index = prev.findIndex((i) => i.id === updated.id);
        if (index === -1) return [...prev, updated];
        const copy = [...prev];
        copy[index] = updated;
        return copy;
      });
      toast.success(isEdit ? "Menu item updated." : "Menu item added.");
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Restaurant Menu</h1>
            <p className="text-muted-foreground mt-1">Manage menu items and pricing</p>
          </motion.div>
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" /> All Items
              </CardTitle>
              <div className="flex items-center gap-2">
                <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full px-4"
                    onClick={openOrderForm}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add order
                  </Button>
                  <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add restaurant order</DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const token = localStorage.getItem("admin_token");
                        if (!token) {
                          navigate("/admin/login", { replace: true });
                          return;
                        }
                        const itemsPayload = orderLines
                          .map((line) => {
                            const qty = Number(line.quantity);
                            if (!Number.isFinite(qty) || qty <= 0) return null;
                            return { menu_item_id: line.menu_item_id, quantity: qty };
                          })
                          .filter(Boolean) as { menu_item_id: string; quantity: number }[];
                        if (!itemsPayload.length) {
                          toast.error("Select at least one item with quantity.");
                          return;
                        }
                        if (orderSource === "Room Service" && !orderBookingRef.trim()) {
                          toast.error("Booking reference is required for Room Service orders.");
                          return;
                        }
                        setOrderSaving(true);
                        try {
                          const res = await fetch(`${API_URL}/api/restaurant/orders`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              order_source: orderSource,
                              booking_reference:
                                orderSource === "Room Service" ? orderBookingRef.trim() || null : null,
                              notes: orderNotes.trim() || null,
                              items: itemsPayload,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            toast.error((data as { error?: string }).error || "Failed to create order.");
                            return;
                          }
                          toast.success(
                            orderSource === "Room Service"
                              ? "Order created and charged to booking."
                              : "Restaurant order created.",
                          );
                          setOrderOpen(false);
                          setOrderLines([]);
                          setOrderBookingRef("");
                          setOrderNotes("");
                        } catch {
                          toast.error("Something went wrong while creating the order.");
                        } finally {
                          setOrderSaving(false);
                        }
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="order-source">Order source</Label>
                          <select
                            id="order-source"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={orderSource}
                            onChange={(e) => setOrderSource(e.target.value as any)}
                          >
                            <option value="Restaurant">Restaurant</option>
                            <option value="Room Service">Room Service</option>
                            <option value="Walk-In">Walk-In</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="order-booking-ref">Booking (for room charge)</Label>
                          <Input
                            id="order-booking-search"
                            value={orderBookingSearch}
                            onChange={(e) => setOrderBookingSearch(e.target.value)}
                            placeholder="Search by name, room, ref..."
                            className="mb-1"
                            disabled={orderSource !== "Room Service"}
                          />
                          <select
                            id="order-booking-ref"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={orderBookingRef}
                            onChange={(e) => setOrderBookingRef(e.target.value)}
                            disabled={orderSource !== "Room Service"}
                          >
                            <option value="">Select booking</option>
                            {bookings
                              .filter((b) => {
                                if (!orderBookingSearch.trim()) return true;
                                const term = orderBookingSearch.toLowerCase();
                                const haystack = [
                                  b.reference_number,
                                  b.guests?.full_name,
                                  b.rooms?.room_number,
                                  b.status,
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                                  .toLowerCase();
                                return haystack.includes(term);
                              })
                              .map((b) => (
                                <option key={b.id} value={b.reference_number ?? ""}>
                                  {b.rooms?.room_number
                                    ? `Room ${b.rooms.room_number}`
                                    : "No room"}{" "}
                                  · {b.guests?.full_name ?? "Guest"} · {b.reference_number}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="order-notes">Notes (optional)</Label>
                        <Input
                          id="order-notes"
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="Special instructions..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Items</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Search menu item..."
                              value={orderItemSearch}
                              onChange={(e) => setOrderItemSearch(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <select
                              className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#07008A]/60"
                              onChange={(e) => {
                                const id = e.target.value;
                                if (!id) return;
                                setOrderLines((prev) =>
                                  prev.find((l) => l.menu_item_id === id)
                                    ? prev
                                    : [...prev, { menu_item_id: id, quantity: "1" }],
                                );
                                e.target.value = "";
                              }}
                            >
                              <option value="">Add item…</option>
                              {items
                                .filter((m) => {
                                  if (orderLines.some((l) => l.menu_item_id === m.id)) return false;
                                  if (!orderItemSearch.trim()) return true;
                                  const term = orderItemSearch.toLowerCase();
                                  const haystack = [m.name, m.category]
                                    .filter(Boolean)
                                    .join(" ")
                                    .toLowerCase();
                                  return haystack.includes(term);
                                })
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} — ₱{Number(m.price ?? 0).toFixed(0)}
                                  </option>
                                ))}
                            </select>
                          </div>
                          {orderLines.length === 0 ? (
                            <p className="text-xs text-slate-500">No items selected yet.</p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto border rounded-md">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-slate-50">
                                    <th className="text-left py-2 px-3">Name</th>
                                    <th className="text-left py-2 px-3">Category</th>
                                    <th className="text-right py-2 px-3">Price</th>
                                    <th className="text-right py-2 px-3">Qty</th>
                                    <th className="text-right py-2 px-3">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderLines.map((line) => {
                                    const m = items.find((it) => it.id === line.menu_item_id);
                                    if (!m) return null;
                                    return (
                                      <tr key={line.menu_item_id} className="border-b last:border-0">
                                        <td className="py-2 px-3">{m.name}</td>
                                        <td className="py-2 px-3 text-slate-500">{m.category ?? "—"}</td>
                                        <td className="py-2 px-3 text-right">
                                          ₱{Number(m.price ?? 0).toFixed(0)}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                          <Input
                                            type="number"
                                            min={1}
                                            className="h-7 w-16 text-xs inline-block"
                                            value={line.quantity}
                                            onChange={(e) =>
                                              setOrderLines((prev) =>
                                                prev.map((l) =>
                                                  l.menu_item_id === line.menu_item_id
                                                    ? { ...l, quantity: e.target.value }
                                                    : l,
                                                ),
                                              )
                                            }
                                          />
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() =>
                                              setOrderLines((prev) =>
                                                prev.filter((l) => l.menu_item_id !== line.menu_item_id),
                                              )
                                            }
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOrderOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={orderSaving}>
                          {orderSaving ? "Creating..." : "Create order"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={open} onOpenChange={setOpen}>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4"
                    onClick={openForCreate}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add item
                  </Button>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingItem ? "Edit menu item" : "Add menu item"}</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label htmlFor="menu-name">Name</Label>
                      <Input
                        id="menu-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tapsilog"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-category">Category</Label>
                      <select
                        id="menu-category"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={categoriesLoading || categories.length === 0}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-price">Price (₱)</Label>
                      <Input
                        id="menu-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="150"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-description">Description (optional)</Label>
                      <Input
                        id="menu-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="menu-image">Image (optional)</Label>
                      <Input
                        id="menu-image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setImageFile(file);
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setImagePreview(url);
                          } else {
                            setImagePreview(editingItem?.image_url ?? null);
                          }
                        }}
                      />
                      {(imagePreview || editingItem?.image_url) && (
                        <div className="mt-2">
                          {/* eslint-disable-next-line jsx-a11y/alt-text */}
                          <img
                            src={imagePreview || editingItem?.image_url || ""}
                            className="h-24 w-24 rounded-md object-cover border border-slate-200 bg-slate-100"
                          />
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                      />
                      <span>Available</span>
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : editingItem ? "Update item" : "Save item"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-center justify-between px-6 py-3 border-b bg-slate-50/60 text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">Items ({items.length})</span>
                      <select
                        className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#07008A]/60"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                      >
                        <option value="all">All categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="text-left py-3 px-6 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Media
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-right py-3 px-6 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((item) =>
                          filterCategory === "all" ? true : item.category === filterCategory,
                        )
                        .map((item) => (
                        <tr
                          key={item.id}
                          className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-[#07008A]">
                            {item.name ?? "—"}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600">
                            {item.category ?? "—"}
                          </td>
                          <td className="py-4 px-4 font-semibold text-[#07008A]">
                            ₱{Number(item.price ?? 0).toFixed(0)}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600">
                            {item.image_url ? (
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                  <img src={item.image_url} className="h-full w-full object-cover" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No image</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600">
                            {item.is_available ? "Available" : "Hidden"}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:text-[#07008A] hover:bg-[#07008A]/10"
                                onClick={() => openForEdit(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this menu item?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={async () => {
                                        const token = localStorage.getItem("admin_token");
                                        if (!token) {
                                          navigate("/admin/login", { replace: true });
                                          return;
                                        }
                                        try {
                                          const res = await fetch(
                                            `${API_URL}/api/menu/${item.id}`,
                                            {
                                              method: "DELETE",
                                              headers: {
                                                Authorization: `Bearer ${token}`,
                                              },
                                            },
                                          );
                                          if (!res.ok) {
                                            toast.error("Failed to delete menu item.");
                                            return;
                                          }
                                          setItems((prev) =>
                                            prev.filter((m) => m.id !== item.id),
                                          );
                                          toast.success("Menu item deleted.");
                                        } catch {
                                          toast.error("Something went wrong. Please try again.");
                                        }
                                      }}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="mt-6 border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No restaurant orders yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="text-left py-3 px-6 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Booking / Room
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="text-right py-3 px-6 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => {
                        const booking = o.booking_id
                          ? bookings.find((b) => b.id === o.booking_id)
                          : undefined;
                        return (
                          <tr
                            key={o.id}
                            className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-3 px-6 text-xs text-slate-700">
                              {o.order_source ?? "Restaurant"}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {booking ? (
                                <span>
                                  {booking.rooms?.room_number
                                    ? `Room ${booking.rooms.room_number}`
                                    : "No room"}
                                  {" · "}
                                  {booking.guests?.full_name ?? "Guest"}
                                  {" · "}
                                  {booking.reference_number}
                                </span>
                              ) : (
                                <span className="text-slate-400">Not linked</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {o.status ?? (booking ? "Charged to Room" : "Paid")}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {o.created_at
                                ? new Date(o.created_at).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="py-3 px-6 text-right font-semibold text-[#07008A]">
                              ₱{Number(o.total_amount ?? 0).toFixed(0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
