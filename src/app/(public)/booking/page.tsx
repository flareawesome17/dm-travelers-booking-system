"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, ArrowRight, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

type RoomTypeOption = {
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  total_rooms: number;
  available_rooms: number | null;
  max_capacity: number | null;
};

function fallbackImageForRoomType(roomType: string) {
  const t = roomType.toLowerCase();
  if (t.includes("suite")) return "/images/room-suite.jpg";
  if (t.includes("deluxe")) return "/images/room-deluxe.jpg";
  if (t.includes("standard")) return "/images/room-standard.jpg";
  return "/images/room-standard.jpg";
}

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", checkin: "", checkout: "", guests: "1", request: "" });
  const [verificationCode, setVerificationCode] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bookingId, setBookingId] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");

  const totalSteps = 4;

  const handleNext = () => setStep((s) => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);
    fetch("/api/public/room-types")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j?.error || "Failed to load rooms.");
        const list = Array.isArray(j?.room_types) ? j.room_types : [];
        if (!cancelled) setRoomTypes(list);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load rooms."))
      .finally(() => {
        if (!cancelled) setLoadingRooms(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRoomData = useMemo(() => roomTypes.find((r) => r.room_type === selectedRoom), [roomTypes, selectedRoom]);

  const createBooking = async () => {
    if (!selectedRoom) {
      toast.error("Please select a room.");
      return;
    }
    if (!form.name || !form.email || !form.phone || !form.checkin || !form.checkout) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.name,
          email: form.email,
          phone_number: form.phone,
          room_type_requested: selectedRoom,
          check_in_date: form.checkin,
          check_out_date: form.checkout,
          num_adults: Number(form.guests || 1),
          num_children: 0,
          special_requests: form.request,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create booking.");
      setBookingId(String(payload.booking_id || ""));
      setReferenceNumber(String(payload.reference_number || ""));
      toast.success("We sent a verification code to your email.");
      setStep(3);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyBooking = async () => {
    if (!bookingId) {
      toast.error("Missing booking info. Please try again.");
      return;
    }
    if (verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/public/bookings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          email: form.email,
          code: verificationCode,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Verification failed.");
      toast.success("Booking confirmed.");
      setStep(4);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    if (!bookingId) return;
    try {
      const res = await fetch("/api/public/bookings/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, email: form.email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to resend code.");
      toast.success("Verification code resent.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to resend code.");
    }
  };

  const goBackFromVerify = () => {
    setStep(2);
    setVerificationCode("");
  };

  return (
    <div className="pt-20 min-h-screen bg-background">
      <section className="bg-secondary py-10 lg:py-14">
        <div className="container mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
            Book Your Stay
          </motion.h1>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
            {["Room", "Details", "Verify", "Confirmed"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-gradient-gold text-secondary" : "bg-secondary-foreground/20 text-secondary-foreground/50"
                }`}>
                  {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                {i < 3 && <div className={`w-8 lg:w-12 h-0.5 ${step > i + 1 ? "bg-primary" : "bg-secondary-foreground/20"}`} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 lg:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Step 1: Select Room */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Select Your Room</h2>
              {loadingRooms ? (
                <div className="text-sm text-muted-foreground">Loading rooms...</div>
              ) : roomTypes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No rooms available.</div>
              ) : roomTypes.map((room) => (
                <button
                  key={room.room_type}
                  onClick={() => setSelectedRoom(room.room_type)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    selectedRoom === room.room_type ? "border-primary shadow-gold bg-primary/5" : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <Image
                    src={room.sample_image_url || fallbackImageForRoomType(room.room_type)}
                    alt={room.room_type}
                    width={80}
                    height={64}
                    className="rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-foreground">{room.room_type}</h3>
                    <p className="text-sm text-muted-foreground">
                      {room.min_price != null ? `Starting at ₱${Number(room.min_price).toLocaleString()}/night` : "Rate not set"}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${selectedRoom === room.room_type ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {selectedRoom === room.room_type && <div className="w-full h-full rounded-full flex items-center justify-center"><CheckCircle className="w-4 h-4 text-primary-foreground" /></div>}
                  </div>
                </button>
              ))}
              <Button onClick={handleNext} disabled={!selectedRoom} className="w-full bg-gradient-gold text-secondary font-semibold h-11 shadow-gold hover:opacity-90 disabled:opacity-50">
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: Guest Details */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Reservation Details</h2>
              <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
                {selectedRoomData && (
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <Image
                      src={selectedRoomData.sample_image_url || fallbackImageForRoomType(selectedRoomData.room_type)}
                      alt=""
                      width={64}
                      height={48}
                      className="rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-semibold text-foreground">{selectedRoomData.room_type}</p>
                      {selectedRoomData.min_price != null ? (
                        <p className="text-sm text-primary font-bold">₱{Number(selectedRoomData.min_price).toLocaleString()}/night</p>
                      ) : null}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone *</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Guests</label>
                    <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>1</option><option>2</option><option>3</option><option>4</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Check-in *</label>
                    <input type="date" value={form.checkin} onChange={(e) => setForm({ ...form, checkin: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Check-out *</label>
                    <input type="date" value={form.checkout} onChange={(e) => setForm({ ...form, checkout: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Special Requests</label>
                  <textarea value={form.request} onChange={(e) => setForm({ ...form, request: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Any special requests?" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleBack} className="border-border text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={createBooking}
                  disabled={submitting || !form.name || !form.email || !form.phone || !form.checkin || !form.checkout}
                  className="flex-1 bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Sending code..." : "Continue"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Verify Email */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center">
              <div className="bg-card rounded-xl p-8 shadow-soft max-w-md mx-auto">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Verify Your Email</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  We&apos;ve sent a 6-digit verification code to <strong className="text-foreground">{form.email}</strong>
                </p>
                <input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 bg-muted rounded-lg text-center text-lg tracking-[0.3em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground mb-4">
                  Didn&apos;t receive it?{" "}
                  <button type="button" onClick={resendCode} className="text-primary font-medium hover:underline">
                    Resend code
                  </button>
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleBack} className="border-border text-foreground">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={verifyBooking}
                    disabled={verifying || verificationCode.length < 6}
                    className="flex-1 bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90 disabled:opacity-50"
                  >
                    {verifying ? "Verifying..." : "Verify & Confirm"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirmed */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="bg-card rounded-xl p-8 shadow-elevated max-w-md mx-auto">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-10 h-10 text-primary" />
                </motion.div>
                <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Your reservation has been confirmed. A confirmation email has been sent to {form.email}.
                </p>
                <div className="bg-muted rounded-lg p-4 text-left space-y-2 text-sm mb-6">
                  <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono font-bold text-foreground">{referenceNumber || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span className="font-semibold text-foreground">{selectedRoomData?.room_type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="text-foreground">{form.checkin}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="text-foreground">{form.checkout}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Guest</span><span className="text-foreground">{form.name}</span></div>
                </div>
                <Button
                  onClick={() => {
                    setStep(1);
                    setSelectedRoom("");
                    setForm({ name: "", email: "", phone: "", checkin: "", checkout: "", guests: "1", request: "" });
                    setVerificationCode("");
                    setBookingId("");
                    setReferenceNumber("");
                  }}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Make Another Booking
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
