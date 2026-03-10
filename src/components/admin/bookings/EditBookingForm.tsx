import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

type BookingRow = {
  id: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  special_requests?: string | null;
  deposit_paid?: number;
  total_amount?: number;
  balance_due?: number;
};

type EditBookingFormProps = {
  apiUrl: string;
  token: string;
  booking: BookingRow;
  onSuccess: (booking: unknown) => void;
  onClose: () => void;
};

const STATUS_OPTIONS = [
  "Pending Verification",
  "Pending Payment",
  "Confirmed",
  "Checked-In",
  "Checked-Out",
  "Cancelled",
  "No Show",
];

export function EditBookingForm({ apiUrl, token, booking, onSuccess, onClose }: EditBookingFormProps) {
  const [status, setStatus] = useState(booking.status ?? "Confirmed");
  const [checkIn, setCheckIn] = useState(booking.check_in_date?.slice(0, 10) ?? "");
  const [checkOut, setCheckOut] = useState(booking.check_out_date?.slice(0, 10) ?? "");
  const [specialRequests, setSpecialRequests] = useState(booking.special_requests ?? "");
  const [depositPaid, setDepositPaid] = useState(String(booking.deposit_paid ?? 0));
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = Number(booking.total_amount ?? 0);
  const deposit = Number(depositPaid) || 0;
  const balanceDue = Math.max(0, totalAmount - deposit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      toast.error("Check-in and check-out dates are required.");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error("Check-out must be after check-in.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          check_in_date: checkIn,
          check_out_date: checkOut,
          special_requests: specialRequests.trim() || null,
          deposit_paid: deposit,
          balance_due: balanceDue,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to update booking.");
        return;
      }

      toast.success("Booking updated.");
      onSuccess(data);
      onClose();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Check-in date</Label>
          <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Check-out date</Label>
          <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Special requests</Label>
        <Input
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label>Deposit paid (₱)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={depositPaid}
          onChange={(e) => setDepositPaid(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          Total ₱{totalAmount.toFixed(0)} — Balance due ₱{balanceDue.toFixed(0)}
        </p>
      </div>
      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
