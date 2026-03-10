import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

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

  useEffect(() => {
    fetch(`${apiUrl}/api/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [apiUrl, token]);

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
  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const hours = checkIn && checkOut
    ? (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60)
    : 0;

  let blocks = 1;
  if (ratePlan === "24h") blocks = Math.max(1, nights);
  else if (ratePlan === "12h") blocks = Math.max(1, Math.ceil(hours / 12));
  else if (ratePlan === "5h") blocks = Math.max(1, Math.ceil(hours / 5));
  else if (ratePlan === "3h") blocks = Math.max(1, Math.ceil(hours / 3));

  const totalAmount = selectedRate ? selectedRate.price * blocks : 0;
  const deposit = Number(depositPaid) || 0;
  const balanceDue = Math.max(0, totalAmount - deposit);

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
    if (!checkIn || !checkOut) {
      toast.error("Check-in and check-out dates are required.");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error("Check-out must be after check-in.");
      return;
    }
    if (!selectedRate || !availableRates.some((r) => r.kind === ratePlan)) {
      toast.error("Selected rate is not available for this room.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/bookings`, {
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
          check_in_date: checkIn,
          check_out_date: checkOut,
          rate_plan_kind: ratePlan,
          num_adults: Number(numAdults) || 1,
          num_children: Number(numChildren) || 0,
          special_requests: specialRequests.trim() || null,
          deposit_paid: deposit,
          assign_room: true,
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="check_in">Check-in date</Label>
          <Input
            id="check_in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="check_out">Check-out date</Label>
          <Input
            id="check_out"
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />
        </div>
      </div>

      {availableRates.length > 0 && (
        <div className="space-y-2">
          <Label>Rate plan</Label>
          <div className="flex flex-wrap gap-3">
            {availableRates.map((r) => (
              <label key={r.kind} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rate_plan"
                  checked={ratePlan === r.kind}
                  onChange={() => setRatePlan(r.kind)}
                />
                <span className="text-sm font-medium">
                  {r.label} — ₱{r.price.toFixed(0)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

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
          <p>
            {ratePlan === "24h" ? `${nights} night(s)` : `${blocks} block(s)`} × ₱{selectedRate?.price.toFixed(0) ?? "0"} = ₱{totalAmount.toFixed(0)}
          </p>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-semibold">₱{totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="deposit" className="text-xs">Deposit paid (₱)</Label>
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
