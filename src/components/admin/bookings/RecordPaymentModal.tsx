import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/utils";
import { getBookingChargeBreakdown, getBookingTotalPaid } from "@/lib/bookingTotals";

type BookingType = {
  id: string;
  reference_number?: string;
  total_amount?: string | number | null;
  deposit_paid?: string | number | null;
  balance_due?: string | number | null;
  restaurant_charges_total?: string | number | null;
  extras_total?: string | number | null;
  extensions_total?: string | number | null;
  early_checkin_fee_applied?: string | number | null;
  late_checkout_fee_applied?: string | number | null;
  status?: string;
  guests?: { full_name?: string | null };
};

type Props = {
  booking: BookingType;
  onSuccess: () => void;
  onClose: () => void;
};

export function RecordPaymentModal({ booking, onSuccess, onClose }: Props) {
  const breakdown = getBookingChargeBreakdown(booking);
  const totalPaidSoFar = getBookingTotalPaid(booking);

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("Cash");
  const [type, setType] = useState<string>(totalPaidSoFar > 0 ? "Balance" : "Deposit");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);


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
      if (!res.ok) throw new Error(getErrorMessage(data) || "Failed to record payment");

      toast.success("Payment recorded successfully.");
      onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err) || "An unexpected error occurred.");
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
            <span>PHP {breakdown.roomTotal.toFixed(2)}</span>
          </div>
          {breakdown.restaurantTotal > 0 && (
            <div className="flex justify-between text-sm text-amber-600 font-medium">
              <span>Restaurant Orders:</span>
              <span>+ PHP {breakdown.restaurantTotal.toFixed(2)}</span>
            </div>
          )}
          {breakdown.extrasTotal > 0 && (
            <div className="flex justify-between text-sm text-blue-600 font-medium">
              <span>Extras:</span>
              <span>+ PHP {breakdown.extrasTotal.toFixed(2)}</span>
            </div>
          )}
          {breakdown.extensionsTotal > 0 && (
            <div className="flex justify-between text-sm text-violet-600 font-medium">
              <span>Extensions:</span>
              <span>+ PHP {breakdown.extensionsTotal.toFixed(2)}</span>
            </div>
          )}
          {breakdown.earlyCheckInFee > 0 && (
            <div className="flex justify-between text-sm text-slate-600 font-medium">
              <span>Early Check-in Fee:</span>
              <span>+ PHP {breakdown.earlyCheckInFee.toFixed(2)}</span>
            </div>
          )}
          {breakdown.lateCheckOutFee > 0 && (
            <div className="flex justify-between text-sm text-slate-600 font-medium">
              <span>Late Check-out Fee:</span>
              <span>+ PHP {breakdown.lateCheckOutFee.toFixed(2)}</span>
            </div>
          )}
        </div>

        <hr className="border-slate-200 my-3" />

        <div className="space-y-2.5">
          <div className="flex justify-between text-sm font-semibold text-slate-800">
            <span>Grand Total:</span>
            <span>PHP {breakdown.grandTotal.toFixed(2)}</span>
          </div>
          {totalPaidSoFar > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 font-medium pt-1">
              <span>Total Paid So Far:</span>
              <span>- PHP {totalPaidSoFar.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base font-bold text-[#07008A] bg-blue-50/50 -mx-5 -mb-5 p-5 border-t border-blue-100 rounded-b-xl mt-4">
            <span>Current Balance Due:</span>
            <span className="text-lg">PHP {Number(booking.balance_due || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="pay-amount">Amount (PHP)</Label>
            {Number(booking.balance_due || 0) > 0 && (
              <button 
                type="button" 
                onClick={() => setAmount(Number(booking.balance_due || 0).toFixed(2))}
                className="text-[11px] font-medium text-[#07008A] bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
              >
                Fill Remaining Balance
              </button>
            )}
          </div>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`e.g. ${Number(booking.balance_due || 0).toFixed(2)}`}
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
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-txn">{method === "Cheque" ? "Cheque Number" : "Transaction ID"} (Optional)</Label>
          <Input
            id="pay-txn"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder={method === "Cheque" ? "Enter cheque number" : "e.g. GCASH-REF-12345"}
          />
          <p className="text-xs text-slate-500">
            {method === "Cheque" ? "Record the cheque number for tracking purposes." : "Useful for tracking digital payments securely."}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={loading || !amount}>
            {loading ? "Recording..." : `Record PHP ${amount ? Number(amount).toFixed(2) : "0.00"}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
