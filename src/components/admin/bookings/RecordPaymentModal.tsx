import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

type BookingType = {
  id: string;
  reference_number?: string;
  total_amount?: string | number | null;
  deposit_paid?: string | number | null;
  balance_due?: string | number | null;
  restaurant_charges_total?: string | number | null;
  status?: string;
  guests?: { full_name?: string | null };
};

type Props = {
  booking: BookingType;
  onSuccess: () => void;
  onClose: () => void;
};

export function RecordPaymentModal({ booking, onSuccess, onClose }: Props) {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("Cash");
  const [type, setType] = useState<string>("Deposit");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);

  // Grand Total = Room Booking + Restaurant Charges
  const grandTotal = Number(booking.total_amount || 0) + Number(booking.restaurant_charges_total || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : "";
    if (!token) {
      toast.error("Authentication required.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          amount: Number(amount),
          method,
          type,
          transaction_id: transactionId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast.success("Payment recorded successfully.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="bg-slate-50 border rounded-xl p-5 space-y-3 mb-2 shadow-sm">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Booking Reference:</span>
          <span className="font-semibold text-slate-800">{booking.reference_number}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Guest Name:</span>
          <span className="font-medium">{booking.guests?.full_name || "Unknown"}</span>
        </div>
        
        <hr className="border-slate-200 my-3" />
        
        <div className="space-y-2.5">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Room Total:</span>
            <span>₱{Number(booking.total_amount || 0).toFixed(0)}</span>
          </div>
          {Number(booking.restaurant_charges_total) > 0 && (
            <div className="flex justify-between text-sm text-amber-600 font-medium">
              <span>Restaurant Orders:</span>
              <span>+ ₱{Number(booking.restaurant_charges_total).toFixed(0)}</span>
            </div>
          )}
        </div>

        <hr className="border-slate-200 my-3" />
        
        <div className="space-y-2.5">
          <div className="flex justify-between text-sm font-semibold text-slate-800">
            <span>Grand Total:</span>
            <span>₱{grandTotal.toFixed(0)}</span>
          </div>
          {Number(booking.deposit_paid) > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 font-medium pt-1">
              <span>Total Paid So Far:</span>
              <span>- ₱{Number(booking.deposit_paid).toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base font-bold text-[#07008A] bg-blue-50/50 -mx-5 -mb-5 p-5 border-t border-blue-100 rounded-b-xl mt-4">
            <span>Current Balance Due:</span>
            <span className="text-lg">₱{Number(booking.balance_due || 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pay-amount">Amount (₱)</Label>
          <Input 
            id="pay-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`e.g. ${Number(booking.balance_due || 0).toFixed(0)}`}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pay-type">Payment Type</Label>
            <select 
              id="pay-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="Deposit">Deposit (Downpayment)</option>
              <option value="Balance">Balance (Final Settlement)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-method">Payment Method</Label>
            <select 
              id="pay-method"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Card">Credit/Debit Card</option>
              <option value="GCash">GCash</option>
              <option value="PayPal">PayPal</option>
              <option value="Stripe">Stripe Terminal</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-txn">Transaction ID (Optional)</Label>
          <Input 
            id="pay-txn"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g. GCASH-REF-12345"
          />
          <p className="text-xs text-slate-500">Useful for tracking digital payments securely.</p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={loading || !amount}>
            {loading ? "Recording..." : `Record ₱${amount ? Number(amount).toFixed(0) : "0"}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
