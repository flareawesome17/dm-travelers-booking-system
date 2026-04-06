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
import { CalendarDays, Users, Tag, DollarSign, Percent } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type RoomData = {
  id: string;
  capacity?: number;
  max_occupancy?: number;
  room_number?: string;
  room_type?: string;
};

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
  num_adults?: number;
  num_children?: number;
  discount_value?: number;
  discount_type?: string;
  discount_amount?: number;
  discount_id?: string | null;
  cheque_number?: string | null;
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
  const [chequeNumber, setChequeNumber] = useState(booking.cheque_number ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [numAdults, setNumAdults] = useState(booking.num_adults ?? 1);
  const [numChildren, setNumChildren] = useState(booking.num_children ?? 0);
  const [discountValue, setDiscountValue] = useState<number>(booking.discount_value ?? 0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">((booking.discount_type as "fixed" | "percent") ?? "fixed");
  const [discountId, setDiscountId] = useState<string | null>(booking.discount_id ?? null);

  const [roomAvailability, setRoomAvailability] = useState<{ id: string; check_in_date: string; check_out_date: string; status: string; rate_plan_kind?: string | null }[]>([]);

  useEffect(() => {
    if (!booking.room_id) return;
    
    // Fetch individual room details to get capacity
    fetch(`${apiUrl}/api/rooms/${booking.room_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        return r.json();
      })
      .then(data => setRoom(data))
      .catch(err => console.error("Failed to fetch room details:", err));

    fetch(`${apiUrl}/api/rooms/${booking.room_id}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setRoomAvailability(Array.isArray(data) ? data : []))
      .catch(() => setRoomAvailability([]));
  }, [apiUrl, token, booking.room_id]);

  const maxCapacity = room?.capacity || room?.max_occupancy || 2;
  const currentTotalGuests = numAdults + numChildren;

  // Re-calculate discounts if they changed
  const { 
    roomTotal: originalRoomTotal, 
    restaurantTotal, 
    extrasTotal, 
    extensionsTotal, 
    earlyCheckInFee, 
    lateCheckOutFee 
  } = getBookingChargeBreakdown(booking);

  // The original room charge BEFORE discount was subtracted
  const subtotalBeforeDiscount = originalRoomTotal + Number(booking.discount_amount || 0);

  let calculatedDiscount = 0;
  if (discountType === "percent") {
    calculatedDiscount = (subtotalBeforeDiscount * (discountValue || 0)) / 100;
  } else {
    calculatedDiscount = discountValue || 0;
  }

  const newRoomTotal = Math.max(0, subtotalBeforeDiscount - calculatedDiscount);
  const grandTotal = newRoomTotal + restaurantTotal + extrasTotal + extensionsTotal + earlyCheckInFee + lateCheckOutFee;
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
          num_children: numChildren,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: calculatedDiscount,
          discount_id: discountId,
          total_amount: newRoomTotal,
          num_adults: numAdults,
          cheque_number: chequeNumber.trim() || null,
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
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
      <div className="space-y-4">
        {/* Reservation Status Section */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
           <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3 block">Reservation Status</Label>
           <select
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
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

        {/* Schedule Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Check-in Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal h-11 px-3 rounded-lg border-slate-200", !checkIn && "text-muted-foreground")}
                >
                  <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
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
            <Label className="text-xs font-medium text-slate-700">Check-out Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!checkIn}
                  className={cn("w-full justify-start text-left font-normal h-11 px-3 rounded-lg border-slate-200", !checkOut && "text-muted-foreground")}
                >
                  <CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
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

        {/* Occupancy Section */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Users className="h-4 w-4 text-slate-400" />
            Guest Allocation
          </Label>
          <select
            className="flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
            value={currentTotalGuests}
            onChange={(e) => {
              const total = parseInt(e.target.value);
              setNumAdults(total);
              setNumChildren(0); // Simplify by keeping all as adults for total count
            }}
          >
            {[...Array(maxCapacity)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? 'Guest' : 'Guests'} {i + 1 === maxCapacity ? '(Max Capacity)' : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-1">
             <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Room Rating:</span>
             <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none h-5 px-1.5 text-[10px]">
               Max {maxCapacity} person(s)
             </Badge>
          </div>
        </div>

        {/* Cheque Support */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3 block">Payment Information</Label>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-700">Cheque Number (If applicable)</Label>
              <Input
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number..."
                className="h-11 rounded-lg border-slate-200 focus:ring-[#07008A]/20"
              />
            </div>
          </div>
        </div>

        {/* Notes & Requests */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">Notes / Special Requests</Label>
          <Textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Add specific guest instructions or notes..."
            className="min-h-[80px] rounded-lg border-slate-200 resize-none text-sm placeholder:text-slate-400"
          />
        </div>

        {/* Financial Overview (Simplified) */}
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-medium text-slate-600">Total Deposit Paid (PHP)</Label>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Payments Locked</span>
          </div>
          <Input
            type="number"
            disabled
            value={depositPaid}
            className="h-11 bg-white/50 border-blue-200 text-blue-900 font-bold text-lg rounded-lg"
          />
          {/* Discounts (Feature 7) */}
          <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                Apply Discount
              </label>
              <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    discountType === "fixed"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Fixed (₱)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    discountType === "percent"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Percent (%)
                </button>
              </div>
            </div>
            <div className="relative group">
              <input
                type="number"
                min="0"
                max={discountType === "percent" ? 100 : undefined}
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-900 placeholder:text-gray-400 group-hover:border-gray-300 shadow-sm"
                placeholder={discountType === "fixed" ? "Enter peso amount..." : "Enter percentage (0-100)..."}
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors">
                {discountType === "fixed" ? <DollarSign className="w-4 h-4" /> : <Percent className="w-4 h-4" />}
              </div>
            </div>
          </div>

          <div className="flex justify-between text-xs pt-1">
             <span className="text-slate-500 font-medium">Grand Total: PHP {grandTotal.toLocaleString()}</span>
             <span className={cn("font-bold", balanceDue > 0 ? "text-amber-600" : "text-emerald-600")}>
               {balanceDue > 0 ? `Unpaid: PHP ${balanceDue.toLocaleString()}` : "Fully Paid"}
             </span>
          </div>
        </div>

        {/* Special Overrides Section */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer",
            isLguBooking ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
          )} onClick={() => setIsLguBooking(!isLguBooking)}>
            <input
              type="checkbox"
              checked={isLguBooking}
              readOnly
              className="h-4 w-4 rounded-md border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs font-semibold text-slate-700">LGU Tier</span>
          </div>

          <div className={cn(
            "flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer",
            isSpecialBooking ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
          )} onClick={() => setIsSpecialBooking(!isSpecialBooking)}>
            <input
              type="checkbox"
              checked={isSpecialBooking}
              readOnly
              className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-700">Special Agency</span>
          </div>
        </div>

        {isSpecialBooking && (
          <div className="space-y-2 animate-in slide-in-from-top-2">
            <Label className="text-xs font-medium text-indigo-900">Organization / Agency Name</Label>
            <Input
              value={specialBookingLabel}
              onChange={(e) => setSpecialBookingLabel(e.target.value)}
              placeholder="e.g. DOT Promo, Corporate VIP"
              className="h-10 border-indigo-200 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      <DialogFooter className="pt-4 mt-6 border-t border-slate-100">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onClose} 
          className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={submitting} 
          className="bg-[#07008A] hover:bg-[#05006a] text-white font-semibold px-8 rounded-lg shadow-md hover:shadow-blue-900/20"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : "Apply Updates"}
        </Button>
      </DialogFooter>
    </form>
  );
}
