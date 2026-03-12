import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";

type RoomOption = {
  id: string;
  room_number?: string;
  room_type?: string;
  rate_24h_enabled?: boolean;
  rate_24h_price?: number | null;
  rate_12h_enabled?: boolean;
  rate_12h_price?: number | null;
  rate_5h_enabled?: boolean;
  rate_5h_price?: number | null;
  rate_3h_enabled?: boolean;
  rate_3h_price?: number | null;
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
  const [numAdults, setNumAdults] = useState("1");
  const [numChildren, setNumChildren] = useState("0");
  const [specialRequests, setSpecialRequests] = useState("");
  const [depositPaid, setDepositPaid] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [roomAvailability, setRoomAvailability] = useState<
    { check_in_date: string; check_out_date: string; status: string; rate_plan_kind?: string | null }[]
  >([]);
  const [isLguBooking, setIsLguBooking] = useState(false);
  const [usePerGuestRate, setUsePerGuestRate] = useState(false);

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

  const reservedRanges = roomAvailability
    .map((b) => {
      const s = parseYmd(b.check_in_date);
      const e = parseYmd(b.check_out_date);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
      const start = toDateOnly(s);
      const end = toDateOnly(e);
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
    if (selectedRoom.rate_24h_enabled && selectedRoom.rate_24h_price != null)
      availableRatesForRoom.push({ kind: "24h", label: "24-hour", price: Number(selectedRoom.rate_24h_price) });
    if (selectedRoom.rate_12h_enabled && selectedRoom.rate_12h_price != null)
      availableRatesForRoom.push({ kind: "12h", label: "12-hour", price: Number(selectedRoom.rate_12h_price) });
    if (selectedRoom.rate_5h_enabled && selectedRoom.rate_5h_price != null)
      availableRatesForRoom.push({ kind: "5h", label: "5-hour", price: Number(selectedRoom.rate_5h_price) });
    if (selectedRoom.rate_3h_enabled && selectedRoom.rate_3h_price != null)
      availableRatesForRoom.push({ kind: "3h", label: "3-hour", price: Number(selectedRoom.rate_3h_price) });
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

  const baseAmount = selectedRate ? selectedRate.price * blocks : 0;
  const totalGuests = (Number(numAdults) || 0) + (Number(numChildren) || 0);
  let totalAmount = baseAmount;
  if (usePerGuestRate && perGuestPrice != null) {
    const guests = totalGuests || 0;
    totalAmount = perGuestPrice * guests;
  }
  const deposit = Number(depositPaid) || 0;
  const balanceDue = Math.max(0, totalAmount - deposit);

  const rateHelper = is24h
    ? "24-hour bookings require check-in and check-out dates. Total is based on nights."
    : "Short-stay (12h/5h/3h) bookings use one booking date. Total is one block for the selected rate.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Guest name and email are required.");
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
        toast.error("Please enter at least one guest (adults/children) for the per guest rate.");
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
          full_name: fullName.trim(),
          email: email.trim(),
          phone_number: phone.trim() || null,
          room_id: roomId,
          check_in_date: checkInToSend,
          check_out_date: checkOutToSend,
          rate_plan_kind: ratePlan,
          num_adults: Number(numAdults) || 1,
          num_children: Number(numChildren) || 0,
          special_requests: specialRequests.trim() || null,
          deposit_paid: deposit,
          assign_room: true,
          is_lgu_booking: isLguBooking,
          use_per_guest: usePerGuestRate,
          per_guest_count: totalGuests,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to create booking.");
        return;
      }

      toast.success("Booking created successfully.");
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Guest name</Label>
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
            placeholder="guest@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-2 bg-slate-50/70">
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
              When enabled, total is based on the room&apos;s per guest rate × total guests (adults + children).
              Uses the 24-hour or 12-hour per guest price, depending on the selected rate plan.
            </p>
          </div>
        </label>
        {usePerGuestRate && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1 text-xs text-slate-600">
              <div className="font-medium">Per guest price</div>
              <div>
                {perGuestPrice != null && perGuestPrice > 0
                  ? `₱${perGuestPrice.toFixed(0)} per guest`
                  : "This room has no per guest rate configured."}
              </div>
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="font-medium">Total guests for per guest rate</div>
              <div>{totalGuests} guest(s) (adults + children)</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-slate-50/70">
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
            Use this for local government unit / LGU-sponsored stays so they can be reported separately.
          </p>
        </div>
      </div>
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
        <Label htmlFor="room">Room</Label>
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
                Total <span className="font-semibold text-[#07008A]">₱{Number(totalAmount).toFixed(0)}</span>
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
                    <div className="text-sm font-semibold text-[#07008A]">₱{r.price.toFixed(0)}</div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="num_adults">Adults</Label>
          <Input
            id="num_adults"
            type="number"
            min={1}
            value={numAdults}
            onChange={(e) => setNumAdults(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="num_children">Children</Label>
          <Input
            id="num_children"
            type="number"
            min={0}
            value={numChildren}
            onChange={(e) => setNumChildren(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="special_requests">Special requests (optional)</Label>
        <Input
          id="special_requests"
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Late check-in, extra pillows..."
        />
      </div>

      <div className="rounded-lg border bg-slate-50/50 p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700">Pricing summary</p>
        <div className="text-sm text-slate-600 space-y-1">
          {usePerGuestRate && perGuestPrice != null && perGuestPrice > 0 ? (
            <>
              <p>
                Per guest: {totalGuests} guest(s) × ₱{perGuestPrice.toFixed(0)} = ₱
                {(perGuestPrice * totalGuests).toFixed(0)}
              </p>
              <p className="text-xs text-slate-500">
                Using the room&apos;s per guest rate instead of the standard {ratePlan} room rate.
              </p>
            </>
          ) : (
            <p>
              {ratePlan === "24h" ? `${nights} night(s)` : `${blocks} block(s)`} × ₱
              {selectedRate?.price.toFixed(0) ?? "0"} = ₱{totalAmount.toFixed(0)}
            </p>
          )}
          <div className="space-y-2 mt-2">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-semibold">₱{totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-2">
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
                className="w-28"
              />
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Balance due</span>
              <span className="font-semibold">₱{balanceDue.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || loadingRooms}>
          {submitting ? "Creating..." : "Create booking"}
        </Button>
      </DialogFooter>
    </form>
  );
}
