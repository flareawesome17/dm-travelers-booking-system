"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { Clock, CalendarPlus, ArrowRight } from "lucide-react";

type ExtendStayModalProps = {
  open: boolean;
  onClose: () => void;
  booking: {
    id: string;
    room_id?: string;
    check_out_date?: string;
    reserved_checkout_datetime?: string;
    rate_plan_kind?: string;
    is_lgu_booking?: boolean;
    rooms?: {
      rate_24h_price?: number | null;
      rate_12h_price?: number | null;
      rate_5h_price?: number | null;
      rate_3h_price?: number | null;
      lgu_rate_enabled?: boolean;
      lgu_rate_24h_price?: number | null;
      lgu_rate_12h_price?: number | null;
      lgu_rate_5h_price?: number | null;
      lgu_rate_3h_price?: number | null;
    } | null;
  };
  token: string;
  onSuccess: () => void;
};

export function ExtendStayModal({ open, onClose, booking, token, onSuccess }: ExtendStayModalProps) {
  const [durationType, setDurationType] = useState<"hours" | "days">("hours");
  const [durationValue, setDurationValue] = useState("3");
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState<{
    state: "checking" | "available" | "conflict" | "idle";
    conflictCount: number;
    firstConflictStart: string | null;
    conflictReference: string | null;
  }>({
    state: "idle",
    conflictCount: 0,
    firstConflictStart: null,
    conflictReference: null,
  });

  const ratePlan = booking.rate_plan_kind || "24h";
  const room = booking.rooms;

  // Auto-calculate cost from room rate
  const hourlyRate = (() => {
    if (!room) return 0;
    const useLgu = booking.is_lgu_booking && room.lgu_rate_enabled;
    const p24 = useLgu && room.lgu_rate_24h_price != null ? room.lgu_rate_24h_price : room.rate_24h_price;
    const p12 = useLgu && room.lgu_rate_12h_price != null ? room.lgu_rate_12h_price : room.rate_12h_price;
    const p5 = useLgu && room.lgu_rate_5h_price != null ? room.lgu_rate_5h_price : room.rate_5h_price;
    const p3 = useLgu && room.lgu_rate_3h_price != null ? room.lgu_rate_3h_price : room.rate_3h_price;
    
    const r24 = Number(p24 || 0);
    const r12 = Number(p12 || 0);
    const r5 = Number(p5 || 0);
    const r3 = Number(p3 || 0);
    // Use the current rate plan to derive hourly cost
    if (ratePlan === "3h" && r3 > 0) return r3 / 3;
    if (ratePlan === "5h" && r5 > 0) return r5 / 5;
    if (ratePlan === "12h" && r12 > 0) return r12 / 12;
    if (r24 > 0) return r24 / 24;
    if (r12 > 0) return r12 / 12;
    if (r5 > 0) return r5 / 5;
    if (r3 > 0) return r3 / 3;
    return 0;
  })();

  const useLguConfig = booking.is_lgu_booking && room?.lgu_rate_enabled;
  const p24Daily = useLguConfig && room?.lgu_rate_24h_price != null ? room.lgu_rate_24h_price : room?.rate_24h_price;
  const dailyRate = Number(p24Daily || 0) || hourlyRate * 24;
  const dv = Number(durationValue) || 0;
  const additionalCost = durationType === "hours" ? hourlyRate * dv : dailyRate * dv;

  // Calculate new checkout
  const currentCheckout = booking.reserved_checkout_datetime || booking.check_out_date || "";
  const newCheckout = (() => {
    if (!currentCheckout || !dv) return "";
    const d = new Date(currentCheckout);
    if (isNaN(d.getTime())) return "";
    if (durationType === "hours") d.setHours(d.getHours() + dv);
    else d.setDate(d.getDate() + dv);
    return d.toISOString();
  })();

  const checkRoomAvailability = useCallback(async (checkout: string) => {
    if (!checkout || !booking.id) return;
    try {
      const res = await fetch(`/api/bookings/${booking.id}/extensions?check_only=true&new_checkout=${encodeURIComponent(checkout)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setAvailability({ state: "idle", conflictCount: 0, firstConflictStart: null, conflictReference: null });
        return;
      }
      if (data.available) {
        setAvailability({
          state: "available",
          conflictCount: Number(data.conflict_count || 0),
          firstConflictStart: data.first_conflict_start || null,
          conflictReference: data.conflict_reference || null,
        });
      } else {
        setAvailability({
          state: "conflict",
          conflictCount: Number(data.conflict_count || 0),
          firstConflictStart: data.first_conflict_start || null,
          conflictReference: data.conflict_reference || null,
        });
      }
    } catch {
      setAvailability({ state: "idle", conflictCount: 0, firstConflictStart: null, conflictReference: null });
    }
  }, [booking.id, token]);

  // Debounce availability check
  useEffect(() => {
    if (!newCheckout || !dv || dv <= 0) {
      setAvailability({ state: "idle", conflictCount: 0, firstConflictStart: null, conflictReference: null });
      return;
    }
    setAvailability({ state: "checking", conflictCount: 0, firstConflictStart: null, conflictReference: null });
    const timer = setTimeout(() => {
      checkRoomAvailability(newCheckout);
    }, 500);
    return () => clearTimeout(timer);
  }, [checkRoomAvailability, durationType, dv, newCheckout]);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch { return iso; }
  };

  const handleSubmit = async () => {
    if (!dv || dv <= 0) { toast.error("Enter a valid duration."); return; }
    if (!newCheckout) { toast.error("Cannot compute new checkout date."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          duration_type: durationType,
          duration_value: dv,
          additional_cost: Math.round(additionalCost * 100) / 100,
          new_checkout_date: newCheckout,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(getErrorMessage(data) || "Failed to extend stay."); return; }
      toast.success("Stay extended successfully!");
      onSuccess();
      onClose();
    } catch { toast.error("Something went wrong."); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#07008A]/10 text-[#07008A]">
              <CalendarPlus className="h-4 w-4" />
            </div>
            Extend Stay
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the new checkout time, additional extension cost, and room availability before confirming the stay extension.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current checkout info */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current checkout</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{formatDate(currentCheckout)}</p>
          </div>

          {/* Duration type */}
          <div className="space-y-2">
            <Label>Extension type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["hours", "days"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDurationType(t)}
                  className={`rounded-lg border p-3 text-sm font-medium transition-all ${
                    durationType === t
                      ? "border-[#07008A] bg-[#07008A]/5 text-[#07008A]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Clock className="h-4 w-4 mb-1 inline-block mr-1" />
                  {t === "hours" ? "Hours" : "Days"}
                </button>
              ))}
            </div>
          </div>

          {/* Duration value */}
          <div className="space-y-2">
            <Label htmlFor="ext-duration">Duration ({durationType})</Label>
            <Input
              id="ext-duration"
              type="number"
              min={1}
              max={durationType === "hours" ? 72 : 30}
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
            />
          </div>

          {/* Cost and preview */}
          <div className="rounded-xl bg-gradient-to-br from-[#07008A]/5 to-[#FED501]/10 border border-[#07008A]/10 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Rate per {durationType === "hours" ? "hour" : "day"}</span>
              <span className="font-semibold text-slate-800">₱{(durationType === "hours" ? hourlyRate : dailyRate).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Extension</span>
              <span className="text-slate-800">{dv} {durationType}</span>
            </div>
            <div className="border-t border-[#07008A]/10 pt-2 flex justify-between">
              <span className="text-sm font-semibold text-[#07008A]">Additional cost</span>
              <span className="text-lg font-bold text-[#07008A]">₱{additionalCost.toFixed(0)}</span>
            </div>
            {newCheckout && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>New checkout</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-semibold text-slate-800">{formatDate(newCheckout)}</span>
                </div>
                
                {availability.state === "checking" && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 animate-pulse">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                    Checking room availability...
                  </div>
                )}
                {availability.state === "available" && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-medium">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Room is available for this extension
                  </div>
                )}
                {availability.state === "conflict" && (
                  <div className="space-y-1 rounded border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-700">
                    <div className="flex items-center gap-2 font-bold">
                      <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      Conflict detected: room is reserved for another guest.
                    </div>
                    {availability.firstConflictStart && (
                      <p className="pl-4 font-medium">
                        First conflict starts {formatDate(availability.firstConflictStart)}
                        {availability.conflictReference ? ` (${availability.conflictReference})` : ""}.
                      </p>
                    )}
                    {availability.conflictCount > 1 && (
                      <p className="pl-4 font-medium">{availability.conflictCount} blocking reservations found.</p>
                    )}
                  </div>
                )}
                {availability.state === "idle" && newCheckout && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                    Waiting for a valid extension window.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !dv || dv <= 0 || availability.state === "conflict" || availability.state === "checking"}
            className={cn(
              "text-white",
              availability.state === "conflict"
                ? "bg-slate-300 hover:bg-slate-300 text-slate-600"
                : "bg-[#07008A] hover:bg-[#05006a]",
            )}
          >
            {submitting ? "Extending..." : availability.state === "conflict" ? "Cannot Extend" : "Confirm Extension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
