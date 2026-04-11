import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarDays, 
  User, 
  BedDouble, 
  CreditCard, 
  FileText, 
  Users, 
  Sparkles,
  Tag,
  DollarSign,
  Percent
} from "lucide-react";

const EXTRA_TYPES = ["Extra Bed", "Extra Pillow", "Extra Blanket", "Extra Towel - Bath", "Extra Towel - Hand", "Extra Person"] as const;
type ExtraType = (typeof EXTRA_TYPES)[number];
const TYPE_TO_KEY: Record<ExtraType, string> = {
  "Extra Bed": "extra_bed_price",
  "Extra Pillow": "extra_pillow_price",
  "Extra Blanket": "extra_blanket_price",
  "Extra Towel - Bath": "extra_towel_price",
  "Extra Towel - Hand": "extra_towel_hand_price",
  "Extra Person": "extra_person_price",
};

type RoomOption = {
  id: string;
  room_number?: string;
  room_type?: string;
  capacity?: number | null;
  max_occupancy?: number | null;
  rate_24h_enabled?: boolean;
  rate_24h_price?: number | null;
  rate_12h_enabled?: boolean;
  rate_12h_price?: number | null;
  rate_5h_enabled?: boolean;
  rate_5h_price?: number | null;
  rate_3h_enabled?: boolean;
  rate_3h_price?: number | null;
  // LGU rate overrides
  lgu_rate_enabled?: boolean;
  lgu_rate_24h_price?: number | null;
  lgu_rate_12h_price?: number | null;
  lgu_rate_5h_price?: number | null;
  lgu_rate_3h_price?: number | null;
  // raw rate_plans jsonb from backend (for per-guest rate, etc.)
  rate_plans?: unknown;
};

type BookingFormProps = {
  apiUrl: string;
  token: string;
  onSuccess: (booking: unknown) => void;
  onClose: () => void;
};

export function BookingForm({ apiUrl, token, onSuccess, onClose }: BookingFormProps) {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [ratePlan, setRatePlan] = useState<"24h" | "12h" | "5h" | "3h">("24h");
  const [numGuests, setNumGuests] = useState("1");
  const [specialRequests, setSpecialRequests] = useState("");
  const [notes, setNotes] = useState("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountId, setDiscountId] = useState<string | null>(null);
  const [globalDiscountName, setGlobalDiscountName] = useState<string | null>(null);
  const [depositPaid, setDepositPaid] = useState("0");
  const [depositMethod, setDepositMethod] = useState<"Cash" | "GCash" | "Card" | "Cheque">("Cash");
  const [chequeNumber, setChequeNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [roomAvailability, setRoomAvailability] = useState<
    { check_in_date: string; check_out_date: string; status: string; rate_plan_kind?: string | null }[]
  >([]);
  const [isLguBooking, setIsLguBooking] = useState(false);
  const [isSpecialBooking, setIsSpecialBooking] = useState(false);
  const [specialBookingLabel, setSpecialBookingLabel] = useState("");
  const [usePerGuestRate, setUsePerGuestRate] = useState(false);
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [selectedExtras, setSelectedExtras] = useState<Record<ExtraType, { checked: boolean; quantity: number }>>({
    "Extra Bed": { checked: false, quantity: 1 },
    "Extra Pillow": { checked: false, quantity: 1 },
    "Extra Blanket": { checked: false, quantity: 1 },
    "Extra Towel - Bath": { checked: false, quantity: 1 },
    "Extra Towel - Hand": { checked: false, quantity: 1 },
    "Extra Person": { checked: false, quantity: 1 },
  });

  const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parseYmd = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(s);
  };
  const toYmd = (d: Date) => {
    const dd = toDateOnly(d);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, "0");
    const day = String(dd.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const formatDisplay = (ymd?: string) => {
    if (!ymd) return "";
    const d = parseYmd(ymd);
    if (Number.isNaN(d.getTime())) return ymd;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(d);
  };

  useEffect(() => {
    fetch("/api/public/discounts")
      .then((res) => res.json())
      .then((data) => {
        const roomDiscounts = Array.isArray(data) ? data.filter((d: any) => d.apply_to_rooms && d.is_active) : [];
        if (roomDiscounts.length > 0) {
          const best = roomDiscounts[0];
          setDiscountType(best.type);
          setDiscountValue(best.value);
          setDiscountId(best.id);
          setGlobalDiscountName(best.name);
        }
      })
      .catch((err) => console.error("Failed to fetch global discounts", err));
  }, []);

  const reservedRanges = roomAvailability
    .map((b) => {
      const s = parseYmd(b.check_in_date);
      const e = parseYmd(b.check_out_date);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;

      const start = toDateOnly(s);

      const isShortStay =
        String(b.rate_plan_kind || "")
          .toLowerCase()
          .trim() !== "24h";

      if (isShortStay) {
        return { start, end: start };
      }

      const endExclusive = toDateOnly(e);
      const end = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
      if (Number.isNaN(end.getTime())) return { start, end: start };
      return start <= end ? { start, end } : { start: end, end: start };
    })
    .filter(Boolean) as { start: Date; end: Date }[];

  const isReservedDate = (day: Date) => {
    const d = toDateOnly(day);
    return reservedRanges.some((r) => d >= r.start && d <= r.end);
  };

  const selectionOverlaps = (startYmd: string, endYmd: string) => {
    const s = toDateOnly(parseYmd(startYmd));
    const e = toDateOnly(parseYmd(endYmd));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
    const start = s <= e ? s : e;
    const end = s <= e ? e : s;
    return reservedRanges.some((r) => r.start <= end && r.end >= start);
  };

  useEffect(() => {
    setLoadingRooms(true);
    fetch(`/api/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
      
    fetch(`/api/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const prices: Record<string, number> = {};
        if (data && typeof data === "object") {
          for (const type of EXTRA_TYPES) {
            const key = TYPE_TO_KEY[type];
            if (Array.isArray(data)) {
              const row = data.find((s: { key: string }) => s.key === key);
              prices[type] = row ? Number(row.value) || 0 : 0;
            } else if (data[key]) {
              prices[type] = Number(data[key]) || 0;
            }
          }
        }
        setDefaultPrices(prices);
      })
      .catch(() => {});
  }, [apiUrl, token]);

  useEffect(() => {
    if (!roomId) {
      setRoomAvailability([]);
      return;
    }
    fetch(`/api/rooms/${roomId}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setRoomAvailability(Array.isArray(data) ? data : []))
      .catch(() => setRoomAvailability([]));
  }, [apiUrl, token, roomId]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const availableRatesForRoom: { kind: "24h" | "12h" | "5h" | "3h"; label: string; price: number }[] = [];
  if (selectedRoom) {
    const useLgu = isLguBooking && selectedRoom.lgu_rate_enabled;
    const p24 = useLgu && selectedRoom.lgu_rate_24h_price != null ? selectedRoom.lgu_rate_24h_price : selectedRoom.rate_24h_price;
    const p12 = useLgu && selectedRoom.lgu_rate_12h_price != null ? selectedRoom.lgu_rate_12h_price : selectedRoom.rate_12h_price;
    const p5 = useLgu && selectedRoom.lgu_rate_5h_price != null ? selectedRoom.lgu_rate_5h_price : selectedRoom.rate_5h_price;
    const p3 = useLgu && selectedRoom.lgu_rate_3h_price != null ? selectedRoom.lgu_rate_3h_price : selectedRoom.rate_3h_price;

    if (selectedRoom.rate_24h_enabled && p24 != null)
      availableRatesForRoom.push({ kind: "24h", label: "24-hour", price: Number(p24) });
    if (selectedRoom.rate_12h_enabled && p12 != null)
      availableRatesForRoom.push({ kind: "12h", label: "12-hour", price: Number(p12) });
    if (selectedRoom.rate_5h_enabled && p5 != null)
      availableRatesForRoom.push({ kind: "5h", label: "5-hour", price: Number(p5) });
    if (selectedRoom.rate_3h_enabled && p3 != null)
      availableRatesForRoom.push({ kind: "3h", label: "3-hour", price: Number(p3) });
  }

  const availableRates = availableRatesForRoom;

  const selectedRate = availableRates.find((r) => r.kind === ratePlan);
  const is24h = ratePlan === "24h";
  const perGuestPlan =
    selectedRoom && Array.isArray((selectedRoom as any).rate_plans)
      ? ((selectedRoom as any).rate_plans as any[]).find((p) => p && typeof p === "object" && p.kind === "per_guest")
      : null;
  const perGuestPrice = (() => {
    if (!perGuestPlan) return null;
    const anyPlan = perGuestPlan as any;
    if (ratePlan === "24h" && anyPlan.price_24h != null) return Number(anyPlan.price_24h);
    if (ratePlan === "12h" && anyPlan.price_12h != null) return Number(anyPlan.price_12h);
    if (anyPlan.base_price != null) return Number(anyPlan.base_price);
    return null;
  })();

  useEffect(() => {
    // Short-stay rates use a single date; keep check-out aligned.
    if (!is24h && checkIn) setCheckOut(checkIn);
  }, [is24h, checkIn]);

  const durationEndDate = is24h ? checkOut : checkIn || "";
  const nights =
    checkIn && durationEndDate
      ? Math.ceil((new Date(durationEndDate).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000))
      : 0;
  const hours =
    checkIn && durationEndDate
      ? (new Date(durationEndDate).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60)
      : 0;

  let blocks = 1;
  if (ratePlan === "24h") blocks = Math.max(1, nights);
  else if (ratePlan === "12h") blocks = Math.max(1, Math.ceil(hours / 12));
  else if (ratePlan === "5h") blocks = Math.max(1, Math.ceil(hours / 5));
  else if (ratePlan === "3h") blocks = Math.max(1, Math.ceil(hours / 3));

  const extrasTotal = EXTRA_TYPES.reduce((sum, type) => {
    const active = selectedExtras[type];
    if (!active.checked) return sum;
    const price = defaultPrices[type] || 0;
    return sum + (price * active.quantity);
  }, 0);

  const baseAmount = selectedRate ? selectedRate.price * blocks : 0;
  const totalGuests = Number(numGuests) || 1;
  const roomCapacity = selectedRoom?.capacity || selectedRoom?.max_occupancy || 10;
  
  const subtotal = usePerGuestRate && perGuestPrice != null ? perGuestPrice * totalGuests : baseAmount;
  const totalWithExtras = subtotal + extrasTotal;

  let calculatedDiscount = 0;
  if (discountType === "percent") {
    calculatedDiscount = (totalWithExtras * (discountValue || 0)) / 100;
  } else {
    calculatedDiscount = discountValue || 0;
  }

  const totalAmount = Math.max(0, totalWithExtras - calculatedDiscount);
  const deposit = Number(depositPaid) || 0;
  const balanceDue = Math.max(0, totalAmount - deposit);

  const rateHelper = is24h
    ? "24-hour bookings require check-in and check-out dates. Total is based on nights."
    : "Short-stay (12h/5h/3h) bookings use one booking date. Total is one block for the selected rate.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Guest name is required.");
      return;
    }
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
      if (totalGuests <= 0) {
        toast.error("Please enter at least one guest for the per guest rate.");
        return;
      }
    }

    const checkInToSend = checkIn;
    const checkOutToSend = is24h ? checkOut : checkIn;
    // Frontend safeguard: prevent overlapping bookings for the same room.
    if (selectionOverlaps(checkInToSend, checkOutToSend)) {
      toast.error("This room already has a booking that overlaps the selected dates.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          guest: {
            full_name: fullName.trim(),
            email: email.trim() || null,
            phone_number: phone.trim() || null,
          },
          room_id: roomId,
          check_in_date: checkInToSend,
          check_out_date: checkOutToSend,
          rate_plan_kind: ratePlan,
          num_adults: totalGuests,
          num_children: 0,
          total_amount: totalAmount,
          deposit_paid: deposit,
          deposit_method: deposit > 0 ? depositMethod : null,
          cheque_number: (deposit > 0 && depositMethod === "Cheque") ? chequeNumber.trim() || null : null,
          special_requests: [notes.trim(), specialRequests.trim()].filter(Boolean).join(" | ") || null,
          is_lgu_booking: isLguBooking,
          is_special_booking: isSpecialBooking,
          special_booking_label: isSpecialBooking ? specialBookingLabel.trim() || null : null,
          discount_value: discountValue,
          discount_type: discountType,
          discount_amount: calculatedDiscount,
          discount_id: discountId,
          extras: EXTRA_TYPES.filter(t => selectedExtras[t].checked).map(t => ({
            extra_type: t,
            quantity: selectedExtras[t].quantity,
            unit_price: defaultPrices[t] || 0
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to create booking.");
        return;
      }

      if (data?._shift_sync_warning) {
        toast.warning("Booking created but the deposit was not recorded in the shift ledger. Use 'Record Payment' to sync it.", { duration: 8000 });
      } else {
        toast.success("Booking created successfully.");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Section 1: Guest Information ─────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <User className="h-4 w-4" />
          Guest Information
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-[#07008A] transition-all"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+63 912 345 6789"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="num_guests">Number of guests</Label>
            <select
              id="num_guests"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={numGuests}
              onChange={(e) => setNumGuests(e.target.value)}
            >
              {Array.from({ length: roomCapacity }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
            {selectedRoom && (
              <p className="text-[11px] text-slate-400">Room capacity: {roomCapacity}</p>
            )}
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
          <Label htmlFor="room">Room *</Label>
          <select
            id="room"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={roomId}
            onChange={(e) => {
              const newRoomId = e.target.value;
              setRoomId(newRoomId);
              const newRoom = rooms.find((r) => r.id === newRoomId);
              if (newRoom) {
                const kinds: ("24h" | "12h" | "5h" | "3h")[] = [];
                if (newRoom.rate_24h_enabled && newRoom.rate_24h_price != null) kinds.push("24h");
                if (newRoom.rate_12h_enabled && newRoom.rate_12h_price != null) kinds.push("12h");
                if (newRoom.rate_5h_enabled && newRoom.rate_5h_price != null) kinds.push("5h");
                if (newRoom.rate_3h_enabled && newRoom.rate_3h_price != null) kinds.push("3h");
                if (kinds.length > 0 && !kinds.includes(ratePlan)) setRatePlan(kinds[0]);
              }
            }}
            required
            disabled={loadingRooms}
          >
            <option value="">Select a room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_number} — {r.room_type}
              </option>
            ))}
          </select>
        </div>

        {availableRates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Label>Rate plan</Label>
                <p className="mt-1 text-xs text-slate-500">{rateHelper}</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div className="font-medium text-slate-700">
                  {is24h ? `${Math.max(1, nights || 0)} night(s)` : `${ratePlan} block`}
                </div>
                <div>
                  Total <span className="font-semibold text-[#07008A]">₱{Number(totalAmount).toFixed(2)}</span>
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
            <Label htmlFor="check_in">{is24h ? "Check-in date" : "Booking date"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !checkIn && "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="h-4 w-4" />
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
              <Label htmlFor="check_out">Check-out date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!checkIn}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkOut && "text-muted-foreground",
                    )}
                  >
                    <CalendarDays className="h-4 w-4" />
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
                      if (selectionOverlaps(checkIn, ymd)) return;
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
                  value={numGuests}
                  onChange={(e) => setNumGuests(e.target.value)}
                >
                  {Array.from({ length: Math.min(roomCapacity, 6) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

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
            {globalDiscountName && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                Global: {globalDiscountName}
              </span>
            )}
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
            onChange={(e) => setIsLguBooking(e.target.checked)}
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
            onChange={(e) => setIsSpecialBooking(e.target.checked)}
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

        <div className="space-y-3">
          <Label>Booking Extras</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border rounded-lg p-3 bg-slate-50/50">
            {EXTRA_TYPES.map((type) => {
              const isChecked = selectedExtras[type].checked;
              const price = defaultPrices[type] || 0;
              return (
                <div key={type} className={cn("flex items-center justify-between p-2 rounded-lg border ring-1 ring-transparent transition-colors", isChecked ? "bg-white border-[#07008A]/30 ring-[#07008A]/10 shadow-sm" : "bg-transparent border-slate-200")}>
                  <label className="flex items-center gap-2 cursor-pointer pr-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[#07008A] focus:ring-[#07008A]"
                      checked={isChecked}
                      onChange={(e) => {
                        setSelectedExtras(prev => ({
                          ...prev,
                          [type]: { ...prev[type], checked: e.target.checked }
                        }));
                      }}
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-slate-700 leading-none">{type}</div>
                      <div className="text-[10px] text-slate-400">₱{price.toFixed(2)}</div>
                    </div>
                  </label>
                  {isChecked && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        className="h-7 w-14 text-xs px-2"
                        value={selectedExtras[type].quantity}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setSelectedExtras(prev => ({
                            ...prev,
                            [type]: { ...prev[type], quantity: val }
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* ── Section 4: Notes ────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <FileText className="h-4 w-4" />
          Notes & Requests
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special notes about this booking..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special_requests">Special requests (optional)</Label>
          <Input
            id="special_requests"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Late check-in, late check-out..."
          />
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* ── Section 5: Pricing & Payment ───────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#07008A]">
          <CreditCard className="h-4 w-4" />
          Pricing & Payment
        </div>

        <div className="rounded-xl border bg-gradient-to-b from-slate-50/80 to-white p-5 space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Pricing summary</p>
          <div className="text-sm text-slate-600 space-y-1">
            {usePerGuestRate && perGuestPrice != null && perGuestPrice > 0 ? (
              <>
                <p>
                  Per guest: {totalGuests} guest(s) × ₱{perGuestPrice.toFixed(2)} = ₱
                  {(perGuestPrice * totalGuests).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  Using the room&apos;s per guest rate instead of the standard {ratePlan} room rate.
                </p>
              </>
            ) : (
              <p>
                {ratePlan === "24h" ? `${nights} night(s)` : `${blocks} block(s)`} × ₱
                {selectedRate?.price.toFixed(0) ?? "0"} = ₱{baseAmount.toFixed(2)}
              </p>
            )}
            {extrasTotal > 0 && (
              <p className="text-slate-500">
                Booking extras = ₱{extrasTotal.toFixed(2)}
              </p>
            )}
          </div>

          <hr className="border-slate-200/80" />

          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600 items-baseline">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">
                ₱{totalWithExtras.toLocaleString()}
              </span>
            </div>

            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium items-baseline animate-in fade-in slide-in-from-right-2 duration-300">
                <span className="flex items-center gap-1.5">
                  Discount ({discountType === "percent" ? `${discountValue}%` : "Fixed"})
                </span>
                <span>- ₱{calculatedDiscount.toLocaleString()}</span>
              </div>
            )}
            
            <div className="h-px bg-gray-100 my-1" />
            
            <div className="flex justify-between text-lg text-gray-900 font-bold items-baseline">
              <span>Total Amount</span>
              <span className="text-emerald-600">
                ₱{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="deposit" className="text-xs">
                Deposit paid (₱)
              </Label>
              <Input
                id="deposit"
                type="number"
                min={0}
                step="0.01"
                value={depositPaid}
                onChange={(e) => setDepositPaid(e.target.value)}
                className="w-28 h-9"
              />
              <select
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value as "Cash" | "GCash" | "Card" | "Cheque")}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#07008A]/20"
                disabled={deposit <= 0}
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            {depositMethod === "Cheque" && deposit > 0 && (
              <div className="flex items-center gap-2">
                <Label htmlFor="cheque_number" className="text-xs whitespace-nowrap">Cheque #</Label>
                <Input
                  id="cheque_number"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="Enter cheque number"
                  className="h-9 max-w-xs"
                />
              </div>
            )}
            <div className="flex justify-between items-center bg-[#07008A]/[0.04] border border-[#07008A]/10 rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium text-slate-700">Balance due</span>
              <span className="text-base font-bold text-[#07008A]">₱{balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || loadingRooms} className="bg-[#07008A] hover:bg-[#05006a]">
          {submitting ? "Creating..." : "Create booking"}
        </Button>
      </DialogFooter>
    </form>
  );
}
