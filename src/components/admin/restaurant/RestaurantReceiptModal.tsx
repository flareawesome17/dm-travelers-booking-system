import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type RestaurantOrder = {
  id: string;
  customer_name?: string | null;
  order_source?: string | null;
  payment_method?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  service_charge?: number | null;
  created_at?: string | null;
  items?: OrderItem[];
};

type ReceiptModalProps = {
  order: any | null;
  onClose: () => void;
};

export function RestaurantReceiptModal({ order: initialOrder, onClose }: ReceiptModalProps) {
  const [order, setOrder] = useState<RestaurantOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialOrder?.id) {
      fetchOrderDetails(initialOrder.id);
    } else {
      setOrder(null);
    }
  }, [initialOrder]);

  const fetchOrderDetails = async (id: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/restaurant/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (error) {
      console.error("Failed to fetch order details", error);
    } finally {
      setLoading(false);
    }
  };

  if (!initialOrder) return null;

  return (
    <Dialog open={!!initialOrder} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:max-w-none print:shadow-none print:border-none print:top-0 print:translate-y-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>Restaurant Receipt</DialogTitle>
          <DialogDescription>
            Print this receipt for the customer.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#07008A] mb-4" />
            <p className="text-sm text-slate-500">Loading order details...</p>
          </div>
        ) : order ? (
          <div className="p-6 bg-white text-slate-900 mx-auto w-full border border-slate-100 rounded-lg print:border-none print:p-0">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
              <img src="/logo.png" alt="D&M Travelers Inn" className="h-12 mx-auto mb-2 object-contain" />
              <h1 className="text-lg font-bold uppercase tracking-tight">D&M Travelers Inn</h1>
              <p className="text-[10px] text-slate-500">Looc Proper, Plaridel, Misamis Occidental</p>
              <p className="text-[10px] text-slate-500">+63 951 868 3018</p>
            </div>

            {/* Order Info */}
            <div className="text-[11px] space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No:</span>
                <span className="font-mono font-medium">{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold">{order.customer_name || "Walk-in Guest"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span>{order.order_source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="font-medium">{order.payment_method}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="border-t border-b border-dashed border-slate-300 py-3 mb-4">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 text-center font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{item.name}</div>
                      </td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right font-medium">₱{Number(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="space-y-1.5 mb-6">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Subtotal</span>
                <span>₱{Number(order.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(order.service_charge || 0) > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Service Charge</span>
                  <span>₱{Number(order.service_charge).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100">
                <span>TOTAL</span>
                <span className="text-[#07008A] print:text-black">₱{Number(order.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-[9px] text-slate-400 pt-4 border-t border-dashed border-slate-200">
              <p>Thank you for dining with us!</p>
              <p>Please come again.</p>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">Failed to load order.</div>
        )}

        <div className="flex justify-end gap-3 px-6 pb-6 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button 
            disabled={loading || !order} 
            onClick={() => window.print()} 
            className="bg-[#07008A] hover:bg-[#05006a] text-white"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
