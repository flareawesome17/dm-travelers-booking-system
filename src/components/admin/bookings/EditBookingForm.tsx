import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { calculateBookingRoomSubtotal, getBookingChargeBreakdown } from "@/lib/bookingTotals";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Users, Tag, DollarSign, Percent, User, BedDouble, Sparkles, ReceiptText, Globe } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type RoomData = {
  id: string;
  name?: string;
  capacity?: number;
  max_occupancy?: number;
  room_number?: string;
  room_type?: string;
  status?: string;
  is_active?: boolean;
  rate_24h_enabled?: boolean;
  rate_24h_price?: number | null;
  rate_12h_enabled?: boolean;
  rate_12h_price?: number | null;
  rate_5h_enabled?: boolean;
  rate_5h_price?: number | null;
  rate_3h_enabled?: boolean;
  rate_3h_price?: number | null;
  lgu_rate_enabled?: boolean;
  lgu_rate_24h_price?: number | null;
  lgu_rate_12h_price?: number | null;
  lgu_rate_5h_price?: number | null;
  lgu_rate_3h_price?: number | null;
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
  booking_source?: string | null;
  external_reference?: string | null;
  num_adults?: number;
  num_children?: number;
  discount_value?: number;
  discount_type?: string;
  discount_amount?: number;
  discount_id?: string | null;
  cheque_number?: string | null;
  guests?: {
    id: string;
    full_name?: string;
    email?: string;
    phone_number?: string;
  };
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
  const originalRoomId = booking.room_id ?? "";
  const [status, setStatus] = useState(booking.status ?? "Confirmed");
  const [checkIn, setCheckIn] = useState(booking.check_in_date?.slice(0, 10) ?? "");
  const [checkOut, setCheckOut] = useState(booking.check_out_date?.slice(0, 10) ?? "");
  const [specialRequests, setSpecialRequests] = useState(booking.special_requests ?? "");
  const [depositPaid, setDepositPaid] = useState(String(booking.deposit_paid ?? 0));
  const [isLguBooking, setIsLguBooking] = useState(booking.is_lgu_booking ?? false);
  const [isSpecialBooking, setIsSpecialBooking] = useState(booking.is_special_booking ?? false);
  const [specialBookingLabel, setSpecialBookingLabel] = useState(booking.special_booking_label ?? "");
  const [chequeNumber, setChequeNumber] = useState(booking.cheque_number ?? "");
  const [bookingSource, setBookingSource] = useState<"Walk-in" | "Booking.com" | "Online" | "Phone" | "Other">((booking.booking_source as any) ?? "Walk-in");
  const [externalReference, setExternalReference] = useState(booking.external_reference ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomId, setRoomId] = useState(booking.room_id ?? "");
  const [ratePlan, setRatePlan] = useState<"24h" | "12h" | "5h" | "3h">((booking.rate_plan_kind as any) ?? "24h");
  const [usePerGuestRate, setUsePerGuestRate] = useState(false);

  const [numAdults, setNumAdults] = useState(booking.num_adults ?? 1);
  const [numChildren, setNumChildren] = useState(booking.num_children ?? 0);
  const [discountValue, setDiscountValue] = useState<number>(booking.discount_value ?? 0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">((booking.discount_type as "fixed" | "percent") ?? "fixed");
  const [discountId, setDiscountId] = useState<string | null>(booking.discount_id ?? null);
  
  // Guest Details
  const [guestName, setGuestName] = useState(booking.guests?.full_name ?? "");
  const [guestEmail, setGuestEmail] = useState(booking.guests?.email ?? "");
  const [guestPhone, setGuestPhone] = useState(booking.guests?.phone_number ?? "");

  const [roomAvailability, setRoomAvailability] = useState<{ id: string; check_in_date: string; check_out_date: string; status: string; rate_plan_kind?: string | null }[]>([]);

  useEffect(() => {
    setLoadingRooms(true);
    fetch(`${apiUrl}/api/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [apiUrl, token]);

  useEffect(() => {
    if (!roomId) {
      setRoomAvailability([]);
      return;
    }
    fetch(`${apiUrl}/api/rooms/${roomId}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setRoomAvailability(Array.isArray(data) ? data : []))
      .catch(() => setRoomAvailability([]));
  }, [apiUrl, token, roomId]);

  const selectedRoom = rooms.find((r) => r.id === roomId) || null;
  const isRoomTransfer = Boolean(roomId && roomId !== originalRoomId);
  const isCheckedInTransfer = isRoomTransfer && booking.status === "Checked-In";
  const transferableRooms = rooms.filter((r) => r.id === originalRoomId || (r.is_active !== false && r.status === "Available"));
  const maxCapacity = selectedRoom?.capacity || selectedRoom?.max_occupancy || 2;
  const currentTotalGuests = numAdults + numChildren;

  // Derive Rates
  const availableRatesForRoom: { kind: "24h" | "12h" | "5h" | "3h"; label: string; price: number }[] = [];
  if (selectedRoom) {
    const useLgu = isLguBooking && selectedRoom.lgu_rate_enabled;
    const p24 = useLgu && selectedRoom.lgu_rate_24h_price != null ? selectedRoom.lgu_rate_24h_price : selectedRoom.rate_24h_price;
    const p12 = useLgu && selectedRoom.lgu_rate_12h_price != null ? selectedRoom.lgu_rate_12h_price : selectedRoom.rate_12h_price;
    const p5 = useLgu && selectedRoom.lgu_rate_5h_price != null ? selectedRoom.lgu_rate_5h_price : selectedRoom.rate_5h_price;
    const p3 = useLgu && selectedRoom.lgu_rate_3h_price != null ? selectedRoom.lgu_rate_3h_price : selectedRoom.rate_3h_price;

    if (selectedRoom.rate_24h_enabled && p24 != null) availableRatesForRoom.push({ kind: "24h", label: "24-hour", price: Number(p24) });
    if (selectedRoom.rate_12h_enabled && p12 != null) availableRatesForRoom.push({ kind: "12h", label: "12-hour", price: Number(p12) });
    if (selectedRoom.rate_5h_enabled && p5 != null) availableRatesForRoom.push({ kind: "5h", label: "5-hour", price: Number(p5) });
    if (selectedRoom.rate_3h_enabled && p3 != null) availableRatesForRoom.push({ kind: "3h", label: "3-hour", price: Number(p3) });
  }
  const availableRates = availableRatesForRoom;
  const selectedRate = availableRates.find((r) => r.kind === ratePlan);
  const is24h = ratePlan === "24h";

  const perGuestPlan = selectedRoom && Array.isArray((selectedRoom as any).rate_plans) ? ((selectedRoom as any).rate_plans as any[]).find((p) => p && typeof p === "object" && p.kind === "per_guest") : null;
  const perGuestPrice = (() => {
    if (!perGuestPlan) return null;
    const anyPlan = perGuestPlan as any;
    if (ratePlan === "24h" && anyPlan.price_24h != null) return Number(anyPlan.price_24h);
    if (ratePlan === "12h" && anyPlan.price_12h != null) return Number(anyPlan.price_12h);
    if (anyPlan.base_price != null) return Number(anyPlan.base_price);
    return null;
  })();

  useEffect(() => {
    if (!is24h && checkIn) setCheckOut(checkIn);
  }, [is24h, checkIn]);

  const durationEndDate = is24h ? checkOut : checkIn || "";
  const nights = checkIn && durationEndDate ? Math.ceil((new Date(durationEndDate).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000)) : 0;
  const hours = checkIn && durationEndDate ? (new Date(durationEndDate).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60) : 0;
  let blocks = 1;
  if (ratePlan === "24h") blocks = Math.max(1, nights);
  else if (ratePlan === "12h") blocks = Math.max(1, Math.ceil(hours / 12));
  else if (ratePlan === "5h") blocks = Math.max(1, Math.ceil(hours / 5));
  else if (ratePlan === "3h") blocks = Math.max(1, Math.ceil(hours / 3));

  const baseAmount = selectedRate ? selectedRate.price * blocks : 0;
  const subtotalBeforeDiscount = usePerGuestRate && perGuestPrice != null ? perGuestPrice * currentTotalGuests : baseAmount;

  // We bring over existing extras/extensions to sum them
  const { 
    restaurantTotal, 
    extrasTotal, 
    extensionsTotal, 
    earlyCheckInFee, 
    lateCheckOutFee 
  } = getBookingChargeBreakdown(booking);

  let calculatedDiscount = 0;
  if (discountType === "percent") {
    calculatedDiscount = (subtotalBeforeDiscount * (discountValue || 0)) / 100;
  } else {
    calculatedDiscount = discountValue || 0;
  }

  const newRoomTotal = Math.max(0, subtotalBeforeDiscount - calculatedDiscount);
  const previewRoomTotal = isCheckedInTransfer ? Number(booking.total_amount || 0) : newRoomTotal;
  const grandTotal = previewRoomTotal + restaurantTotal + extrasTotal + extensionsTotal + earlyCheckInFee + lateCheckOutFee;

  const rateHelper = is24h
    ? "24-hour bookings require check-in and check-out dates. Total is based on nights."
    : "Short-stay (12h/5h/3h) bookings use one booking date. Total is one block for the selected rate.";
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
    if (!roomId) {
      toast.error("Please select a room.");
      return;
    }
    if (!checkIn) {
      toast.error("Please select a booking date.");
      return;
    }
    if (is24h) {
      if (!checkOut) {
        toast.error("For 24-hour bookings, check-in and check-out dates are required.");
        return;
      }
      if (new Date(checkOut) <= new Date(checkIn)) {
        toast.error("Check-out must be after check-in for 24-hour bookings.");
        return;
      }
    }
    if (!selectedRate || !availableRates.some((r) => r.kind === ratePlan)) {
      toast.error("Selected rate is not available for this room.");
      return;
    }

    if (usePerGuestRate) {
      if (perGuestPrice == null || perGuestPrice <= 0) {
        toast.error("This room does not have a per guest rate configured.");
        return;
      }
      if (currentTotalGuests <= 0) {
        toast.error("Please enter at least one guest for the per guest rate.");
        return;
      }
    }

    const checkInToSend = checkIn;
    const checkOutToSend = is24h ? checkOut : checkIn;
    if (selectionOverlaps(checkInToSend, checkOutToSend)) {
      toast.error("Selected dates overlap an existing booking for this room.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/bookings/${booking.id}${isRoomTransfer ? "/transfer-room" : ""}`, {
        method: isRoomTransfer ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isRoomTransfer
            ? { target_room_id: roomId }
            : {
                status,
                room_id: roomId,
                rate_plan_kind: ratePlan,
                check_in_date: checkInToSend,
                check_out_date: checkOutToSend,
                special_requests: specialRequests,
                deposit_paid: deposit,
                cheque_number: (deposit > 0 && chequeNumber.trim()) ? chequeNumber.trim() : null,
                is_lgu_booking: isLguBooking,
                is_special_booking: isSpecialBooking,
                special_booking_label: isSpecialBooking ? specialBookingLabel.trim() : null,
                booking_source: bookingSource,
                external_reference: bookingSource === "Booking.com" ? externalReference.trim() || null : null,
                num_adults: numAdults,
                num_children: numChildren,
                discount_value: discountValue,
                discount_type: discountType,
                total_amount: newRoomTotal,
                guest: {
                  full_name: guestName.trim(),
                  email: guestEmail.trim() || null,
                  phone_number: guestPhone.trim() || null,
                }
              },
        ),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to update booking.");
        return;
      }

      if (isRoomTransfer) {
        toast.success("Room transferred.");
      } else {
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
      
      {/* ── Section 1: Guest Information ─────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <User className="h-4 w-4" />
          Guest Information
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Full name *</Label>
            <Input 
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="h-10 rounded-lg border-slate-200"
              placeholder="Guest full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Email</Label>
            <Input 
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="h-10 rounded-lg border-slate-200"
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Phone (optional)</Label>
            <Input 
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="h-10 rounded-lg border-slate-200"
              placeholder="+63 912 345 6789"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Number of guests</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={currentTotalGuests}
              onChange={(e) => {
                const total = parseInt(e.target.value);
                setNumAdults(total);
                setNumChildren(0); // Simplify by keeping all as adults for total count
              }}
            >
              {Array.from({ length: maxCapacity }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">Room capacity: {maxCapacity}</p>
          </div>
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* ── Section 2: Room & Schedule ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <BedDouble className="h-4 w-4" />
          Room & Schedule
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">Room *</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={loadingRooms}
          >
            <option value="" disabled>Select a room</option>
            {transferableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_number ? `${r.room_number} — ` : ""}{r.name || r.room_type} - Cap: {r.capacity}
                {r.id === originalRoomId ? " (Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        {isRoomTransfer && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
            {isCheckedInTransfer
              ? "Room transfer detected. The guest stays checked in, linked booking data stays attached, the old room becomes Available, and the new room becomes Occupied. Save any other booking detail changes after the transfer completes."
              : "Room transfer detected. Linked booking data stays attached to this booking, and the room total will be repriced against the selected room. Save any other booking detail changes after the transfer completes."}
          </div>
        )}

        {availableRates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Label>Rate plan</Label>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div className="font-medium text-slate-700">
                  {is24h ? `${Math.max(1, nights || 0)} night(s)` : `${ratePlan} block`}
                </div>
                <div>
                  Base Rate <span className="font-semibold text-[#07008A]">₱{Number(baseAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableRates.map((r) => {
                const selected = ratePlan === r.kind;
                return (
                  <button
                    key={r.kind}
                    type="button"
                    className={cn(
                      "group relative rounded-xl border p-4 text-left transition-colors",
                      selected
                        ? "border-[#07008A] bg-[#07008A]/[0.04]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                    onClick={() => setRatePlan(r.kind)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border",
                            selected ? "border-[#07008A]" : "border-slate-300",
                          )}
                        >
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full transition-colors",
                              selected ? "bg-[#07008A]" : "bg-transparent",
                            )}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{r.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {r.kind === "24h" ? "Needs check-in & check-out dates" : "Uses one booking date"}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-[#07008A]">₱{r.price.toFixed(2)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">{is24h ? "Check-in date" : "Booking date"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 px-3 rounded-lg border-slate-200",
                    !checkIn && "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {checkIn ? formatDisplay(checkIn) : is24h ? "Select check-in date" : "Select booking date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn ? parseYmd(checkIn) : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    if (isReservedDate(d)) return;
                    const ymd = toYmd(d);
                    setCheckIn(ymd);
                    if (!is24h) setCheckOut(ymd);
                    if (is24h && checkOut && new Date(ymd) >= new Date(checkOut)) {
                      setCheckOut("");
                    }
                  }}
                  disabled={(day) => isReservedDate(day)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {!is24h && (
              <p className="text-xs text-slate-500">
                For {ratePlan} bookings, this single date is used for the stay.
              </p>
            )}
          </div>
          {is24h && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-700">Check-out date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!checkIn}
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 px-3 rounded-lg border-slate-200",
                      !checkOut && "text-muted-foreground",
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {checkOut ? formatDisplay(checkOut) : "Select check-out date"}
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
                      return selectionOverlaps(checkIn, ymd);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-slate-500">Total nights are calculated from these dates.</p>
            </div>
          )}
        </div>
        <p className="text-[10px] text-blue-600/80 italic">{rateHelper}</p>
      </div>

      <hr className="border-slate-200" />

      {/* ── Section 3: Booking Options ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <Sparkles className="h-4 w-4" />
          Booking Options
        </div>

        <div className="space-y-2 rounded-lg border px-3 py-2.5 bg-slate-50/70">
          <label className="flex items-center gap-2">
            <input
              id="use_per_guest"
              type="checkbox"
              checked={usePerGuestRate}
              onChange={(e) => setUsePerGuestRate(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-slate-800">Use per guest rate (if available)</span>
              <p className="text-xs text-slate-500">
                Total is based on the room&apos;s per guest rate × number of guests.
              </p>
            </div>
          </label>
          {usePerGuestRate && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 text-xs text-slate-600">
                <div className="font-medium">Per guest price</div>
                <div>
                  {perGuestPrice != null && perGuestPrice > 0
                    ? `₱${perGuestPrice.toFixed(2)} per guest`
                    : "This room has no per guest rate configured."}
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <div className="font-medium">Total guests for per guest rate</div>
                <select
                  className="mt-1 flex h-8 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={currentTotalGuests}
                  onChange={(e) => {
                    const total = parseInt(e.target.value);
                    setNumAdults(total);
                    setNumChildren(0); // Simplify by keeping all as adults for total count
                  }}
                >
                  {Array.from({ length: Math.min(maxCapacity, 6) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Discounts */}
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
                    ? "bg-emerald-600 text-white shadow-sm"
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
                    ? "bg-emerald-600 text-white shadow-sm"
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder:text-gray-400 group-hover:border-gray-300 shadow-sm"
              placeholder={discountType === "fixed" ? "Enter peso amount..." : "Enter percentage (0-100)..."}
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-emerald-500 transition-colors">
              {discountType === "fixed" ? <DollarSign className="w-4 h-4" /> : <Percent className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 bg-slate-50/70">
          <input
            id="is_lgu_booking"
            type="checkbox"
            checked={isLguBooking}
            onChange={(e) => {
               setIsLguBooking(e.target.checked);
               if (e.target.checked) {
                 setIsSpecialBooking(false);
                 setSpecialBookingLabel("");
               }
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          <div className="space-y-0.5">
            <Label htmlFor="is_lgu_booking" className="text-sm font-medium text-slate-800">
              Mark as LGU booking
            </Label>
            <p className="text-xs text-slate-500">
              LGU-sponsored stays use predefined rates and delay payment collection.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 border rounded-lg px-3 py-2.5 bg-slate-50/70">
          <input
            id="is_special_booking"
            type="checkbox"
            checked={isSpecialBooking}
            onChange={(e) => {
               setIsSpecialBooking(e.target.checked);
               if (e.target.checked) setIsLguBooking(false);
               else setSpecialBookingLabel("");
            }}
            className="h-4 w-4 rounded border-slate-300 mt-1"
          />
          <div className="space-y-2 flex-1">
            <div>
              <Label htmlFor="is_special_booking" className="text-sm font-medium text-slate-800">
                Special Booking (Delayed Payment)
              </Label>
              <p className="text-xs text-slate-500 mt-0.5">
                For x-deals, agency agreements, or delayed payment arrangements.
              </p>
            </div>
            {isSpecialBooking && (
              <div className="pt-1">
                <Label htmlFor="special_booking_label" className="text-xs mb-1 block">Special Label / Organization</Label>
                <Input
                  id="special_booking_label"
                  value={specialBookingLabel}
                  onChange={(e) => setSpecialBookingLabel(e.target.value)}
                  placeholder="e.g., DOT Promo, VIP Deal"
                  className="h-8 text-sm max-w-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

        {/* ── Booking Source ──────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" />
            <Label className="text-sm font-medium text-slate-700">Booking Source</Label>
          </div>
          <select
            value={bookingSource}
            onChange={(e) => setBookingSource(e.target.value as typeof bookingSource)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="Walk-in">Walk-in</option>
            <option value="Booking.com">Booking.com</option>
            <option value="Online">Online (Website)</option>
            <option value="Phone">Phone</option>
            <option value="Other">Other</option>
          </select>
          {bookingSource === "Booking.com" && (
            <div className="space-y-1.5">
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-1.5">
                📌 Tagged as a <strong>Booking.com</strong> reservation.
              </p>
              <div className="space-y-1">
                <Label htmlFor="edit_external_reference" className="text-xs font-medium text-slate-600">Booking.com Confirmation #</Label>
                <Input
                  id="edit_external_reference"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. 4291837265"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>

      <hr className="border-slate-200" />

      {/* ── Section 4: Validation & Payment ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <ReceiptText className="h-4 w-4" />
          Status & Documentation
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Reservation Status *</Label>
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

          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">Cheque Number (If applicable)</Label>
            <Input
              value={chequeNumber}
              onChange={(e) => setChequeNumber(e.target.value)}
              placeholder="Enter cheque number..."
              className="h-10 border-slate-200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">Notes / Special Requests</Label>
          <Textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Add specific guest instructions or notes..."
            className="min-h-[80px] rounded-lg border-slate-200 resize-none text-sm placeholder:text-slate-400"
          />
        </div>

        {/* Financial Recalculation Overview */}
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
            <span className="text-xs text-slate-600">{isCheckedInTransfer ? "Room Total (Preserved)" : `Base Room Rate (${blocks} blocks)`}</span>
            <span className="text-xs font-medium">₱{(isCheckedInTransfer ? previewRoomTotal : subtotalBeforeDiscount).toLocaleString()}</span>
          </div>
          {calculatedDiscount > 0 && (
          <div className="flex justify-between items-center pb-2 border-b border-blue-100/50 text-emerald-600">
            <span className="text-xs">Discount</span>
            <span className="text-xs font-medium">- ₱{calculatedDiscount.toLocaleString()}</span>
          </div>
          )}
          {(restaurantTotal > 0 || extrasTotal > 0 || extensionsTotal > 0 || earlyCheckInFee > 0 || lateCheckOutFee > 0) && (
            <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
              <span className="text-xs text-slate-600 cursor-help" title="Manage these in Extras tab">Synced Extras/Extensions</span>
              <span className="text-xs font-medium">₱{(restaurantTotal + extrasTotal + extensionsTotal + earlyCheckInFee + lateCheckOutFee).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
             <span className="text-slate-700 font-bold text-sm">{isCheckedInTransfer ? "Grand Total (Preserved)" : "Grand Total (Recalculated)"}</span>
             <span className="text-[#07008A] font-bold text-sm">₱{grandTotal.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center pt-2">
             <span className="text-xs text-slate-500 font-medium">Deposit Paid (Locked)</span>
             <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">₱{deposit.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-blue-100/50">
             <span className="text-xs text-slate-500 font-medium pb-2">Final Balance Expected</span>
             <span className={cn("font-bold text-sm border px-2 py-0.5 rounded shadow-sm", balanceDue > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200")}>
               {balanceDue > 0 ? `₱${balanceDue.toLocaleString()}` : "Fully Paid"}
             </span>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4 mt-6 border-t border-slate-100 space-x-2">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onClose} 
          className="text-slate-500 hover:text-slate-800"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={submitting} 
          className="bg-[#07008A] hover:bg-[#05006a] text-white font-semibold shadow-md"
        >
          {submitting ? (isRoomTransfer ? "Transferring..." : "Saving...") : (isRoomTransfer ? "Transfer Room" : "Update")}
        </Button>
      </DialogFooter>
    </form>
  );
}
