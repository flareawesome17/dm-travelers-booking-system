import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { getBookingChargeBreakdown } from "@/lib/bookingTotals";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";

type BookingRow = {
  id: string;
  status?: string;
  room_id?: string;
  rate_plan_kind?: string;
  check_in_date?: string;
  check_out_date?: string;
  special_requests?: string | null;
  deposit_paid?: number;
  total_amount?: number;
  balance_due?: number;
  restaurant_charges_total?: number;
  extras_total?: number;
  extensions_total?: number;
  early_checkin_fee_applied?: number;
  late_checkout_fee_applied?: number;
  is_lgu_booking?: boolean;
  is_special_booking?: boolean;
  special_booking_label?: string | null;
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
  const [isLguBooking, setIsLguBooking] = useState(booking.is_lgu_booking ?? false);
  const [isSpecialBooking, setIsSpecialBooking] = useState(booking.is_special_booking ?? false);
  const [specialBookingLabel, setSpecialBookingLabel] = useState(booking.special_booking_label ?? "");
  const [submitting, setSubmitting] = useState(false);


  const [roomAvailability, setRoomAvailability] = useState<{ id: string; check_in_date: string; check_out_date: string; status: string; rate_plan_kind?: string | null }[]>([]);

  useEffect(() => {
    if (!booking.room_id) return;
    fetch(`${apiUrl}/api/rooms/${booking.room_id}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setRoomAvailability(Array.isArray(data) ? data : []))
      .catch(() => setRoomAvailability([]));
  }, [apiUrl, token, booking.room_id]);

  const { grandTotal } = getBookingChargeBreakdown(booking);
  const deposit = Number(depositPaid) || 0;
  const balanceDue = Math.max(0, grandTotal - deposit);

  const parseYmd = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(s);
  };
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  
  const reservedRanges = roomAvailability
    .filter(b => b.id !== booking.id)
    .map((b) => {
      const from = parseYmd(b.check_in_date);
      let toStr = b.check_out_date;
      if (b.rate_plan_kind && b.rate_plan_kind !== "24h") {
        toStr = b.check_in_date;
      }
      return { from, to: parseYmd(toStr || b.check_in_date) };
    });

  const isReservedDate = (day: Date) => {
    const dStr = toYmd(day);
    return reservedRanges.some((r) => {
      const { from, to } = r;
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
      const fStr = toYmd(from);
      const tStr = toYmd(to);
      return dStr >= fStr && dStr < tStr;
    });
  };

  const selectionOverlaps = (start: string, end: string) => {
    if (!start || !end) return false;
    const sStr = toYmd(parseYmd(start));
    const eStr = toYmd(parseYmd(end));
    return reservedRanges.some((r) => {
      const { from, to } = r;
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
      const fStr = toYmd(from);
      const tStr = toYmd(to);
      return Math.max(new Date(sStr).getTime(), new Date(fStr).getTime()) < Math.min(new Date(eStr).getTime(), new Date(tStr).getTime());
    });
  };
  
  const formatDisplay = (ymd?: string) => {
    if (!ymd) return "";
    const d = parseYmd(ymd);
    if (Number.isNaN(d.getTime())) return ymd;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(d);
  };

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
    if (selectionOverlaps(checkIn, checkOut)) {
      toast.error("Selected dates overlap an existing booking for this room.");
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
          is_lgu_booking: isLguBooking,
          is_special_booking: isSpecialBooking,
          special_booking_label: isSpecialBooking ? specialBookingLabel.trim() || null : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to update booking.");
        return;
      }

      const receivableSync = (data as { receivable_sync?: { action?: string } }).receivable_sync;
      const createdOrSyncedReceivable =
        (isLguBooking || isSpecialBooking) &&
        receivableSync &&
        receivableSync.action !== "none" &&
        receivableSync.action !== "deleted" &&
        receivableSync.action !== "archived";

      if (createdOrSyncedReceivable) {
        toast.success(
          <span>
            Receivable created.{" "}
            <Link href="/admin/receivables" className="font-semibold text-[#07008A] underline underline-offset-2">
              View in Ledger -&gt;
            </Link>
          </span>,
        );
      } else {
        toast.success("Booking updated.");
      }
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
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !checkIn && "text-muted-foreground")}
              >
                <CalendarDays className="h-4 w-4" />
                {checkIn ? formatDisplay(checkIn) : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkIn ? parseYmd(checkIn) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  const ymd = toYmd(d);
                  if (isReservedDate(d)) return;
                  setCheckIn(ymd);
                  if (checkOut && new Date(ymd) >= new Date(checkOut)) {
                    setCheckOut("");
                  }
                }}
                disabled={(day) => isReservedDate(day)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Check-out date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={!checkIn}
                className={cn("w-full justify-start text-left font-normal", !checkOut && "text-muted-foreground")}
              >
                <CalendarDays className="h-4 w-4" />
                {checkOut ? formatDisplay(checkOut) : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkOut ? parseYmd(checkOut) : undefined}
                onSelect={(d) => {
                  if (!d || !checkIn) return;
                  const ymd = toYmd(d);
                  if (new Date(ymd) <= new Date(checkIn)) return;
                  if (selectionOverlaps(checkIn, ymd)) {
                    toast.error("Selected range overlaps an existing booking.");
                    return;
                  }
                  setCheckOut(ymd);
                }}
                disabled={(day) => {
                  if (!checkIn) return true;
                  const ymd = toYmd(day);
                  if (new Date(ymd) <= new Date(checkIn)) return true;
                  return isReservedDate(day);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-slate-50/70">
        <input
          id="is_lgu_booking_edit"
          type="checkbox"
          checked={isLguBooking}
          onChange={(e) => setIsLguBooking(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <div className="space-y-0.5">
          <Label htmlFor="is_lgu_booking_edit" className="text-sm font-medium text-slate-800 cursor-pointer">
            Mark as LGU booking
          </Label>
          <p className="text-xs text-slate-500">
            Use this for local government unit stays.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 border rounded-md px-3 py-2 bg-slate-50/70">
        <input
          id="is_special_booking_edit"
          type="checkbox"
          checked={isSpecialBooking}
          onChange={(e) => setIsSpecialBooking(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 mt-1"
        />
        <div className="space-y-2 flex-1">
          <div>
            <Label htmlFor="is_special_booking_edit" className="text-sm font-medium text-slate-800 cursor-pointer">
              Special Booking (Delayed Payment)
            </Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Select this for bookings requiring delayed payments, x-deals, or specific agency agreements.
            </p>
          </div>
          {isSpecialBooking && (
            <div className="pt-1">
              <Label htmlFor="special_booking_label_edit" className="text-xs mb-1 block">Special Label / Organization</Label>
              <Input
                id="special_booking_label_edit"
                value={specialBookingLabel}
                onChange={(e) => setSpecialBookingLabel(e.target.value)}
                placeholder="e.g., DOT Promo, VIP Deal"
                className="h-8 text-sm max-w-sm"
              />
            </div>
          )}
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
        <Label>Deposit paid (PHP)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={depositPaid}
          onChange={(e) => setDepositPaid(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          Total PHP {grandTotal.toFixed(0)} - Balance due PHP {balanceDue.toFixed(0)}
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

