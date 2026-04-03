"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Mail,
  PhoneCall,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";
import { cn } from "@/lib/utils";

type RoomTypeOption = {
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  total_rooms: number;
  available_rooms: number | null;
  max_capacity: number | null;
};

type RoomReservation = {
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  rate_plan_kind: string | null;
};

type RoomTypeAvailabilityResponse = {
  room_type: string;
  room_ids: string[];
  reservations: RoomReservation[];
};

function fallbackImageForRoomType(roomType: string) {
  const value = roomType.toLowerCase();
  if (value.includes("suite")) return "/images/room-suite.jpg";
  if (value.includes("deluxe")) return "/images/room-deluxe.jpg";
  if (value.includes("standard")) return "/images/room-standard.jpg";
  return "/images/room-standard.jpg";
}

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toYmd(date: Date) {
  const d = toDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDisplayDate(ymd?: string) {
  if (!ymd) return "";
  const parsed = parseYmd(ymd);
  if (Number.isNaN(parsed.getTime())) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
}

const bookingSteps = ["Room", "Details", "Verify", "Confirmed"];

export default function BookingPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    checkin: "",
    checkout: "",
    guests: "1",
    request: "",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [roomAvailability, setRoomAvailability] = useState<RoomTypeAvailabilityResponse | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [prefillProcessed, setPrefillProcessed] = useState(false);

  const preselectedRoomParam = useMemo(
    () => (searchParams.get("roomType") || "").trim(),
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);

    fetch("/api/public/room-types")
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          throw new Error(json?.error || "Failed to load rooms.");
        }

        const list = Array.isArray(json?.room_types) ? json.room_types : [];
        if (!cancelled) {
          setRoomTypes(list);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Failed to load rooms.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRoomData = useMemo(
    () => roomTypes.find((room) => room.room_type === selectedRoom),
    [roomTypes, selectedRoom],
  );
  const normalizedRoomTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    roomTypes.forEach((room) => {
      map.set(room.room_type.trim().toLowerCase(), room.room_type);
    });
    return map;
  }, [roomTypes]);

  useEffect(() => {
    if (prefillProcessed || !preselectedRoomParam || loadingRooms) return;

    const normalized = preselectedRoomParam.toLowerCase();
    const matchedRoomType = normalizedRoomTypeMap.get(normalized);
    if (!matchedRoomType) {
      setPrefillProcessed(true);
      return;
    }

    setSelectedRoom(matchedRoomType);
    setStep((current) => (current < 2 ? 2 : current));
    setPrefillProcessed(true);
  }, [
    loadingRooms,
    normalizedRoomTypeMap,
    prefillProcessed,
    preselectedRoomParam,
  ]);

  useEffect(() => {
    if (!selectedRoom) {
      setRoomAvailability(null);
      setCalendarError("");
      return;
    }

    let cancelled = false;
    setLoadingAvailability(true);
    setCalendarError("");

    const params = new URLSearchParams({ room_type: selectedRoom });
    fetch(`/api/public/room-types/availability?${params.toString()}`)
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          throw new Error(json?.error || "Failed to load room availability.");
        }
        if (!cancelled) {
          const roomIds = Array.isArray(json?.room_ids)
            ? json.room_ids.map((id: unknown) => String(id))
            : [];
          const reservations = Array.isArray(json?.reservations)
            ? json.reservations
                .map((reservation: any) => ({
                  room_id: String(reservation?.room_id || ""),
                  check_in_date: String(reservation?.check_in_date || "").slice(0, 10),
                  check_out_date: String(reservation?.check_out_date || "").slice(0, 10),
                  rate_plan_kind: reservation?.rate_plan_kind
                    ? String(reservation.rate_plan_kind)
                    : null,
                }))
                .filter((reservation: RoomReservation) =>
                  !!reservation.room_id && !!reservation.check_in_date && !!reservation.check_out_date)
            : [];

          setRoomAvailability({
            room_type: String(json?.room_type || selectedRoom),
            room_ids: roomIds,
            reservations,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRoomAvailability(null);
          setCalendarError(error instanceof Error ? error.message : "Failed to load room availability.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRoom]);

  const reservedRangesByRoom = useMemo(() => {
    const roomIds = roomAvailability?.room_ids ?? [];
    const map = new Map<string, Array<{ start: Date; end: Date }>>();

    roomIds.forEach((roomId) => map.set(roomId, []));

    (roomAvailability?.reservations ?? []).forEach((reservation) => {
      const checkIn = toDateOnly(parseYmd(reservation.check_in_date));
      const checkOut = toDateOnly(parseYmd(reservation.check_out_date));
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return;
      }

      const isShortStay = String(reservation.rate_plan_kind || "").trim().toLowerCase() !== "24h";
      const start = checkIn;
      const end = isShortStay ? checkIn : addDays(checkOut, -1);
      const normalizedRange = start <= end ? { start, end } : { start: end, end: start };

      if (!map.has(reservation.room_id)) {
        map.set(reservation.room_id, []);
      }
      map.get(reservation.room_id)?.push(normalizedRange);
    });

    return map;
  }, [roomAvailability]);

  const today = useMemo(() => toDateOnly(new Date()), []);

  const isRoomReservedOnDay = useCallback((roomId: string, day: Date) => {
    const d = toDateOnly(day);
    const ranges = reservedRangesByRoom.get(roomId) ?? [];
    return ranges.some((range) => d >= range.start && d <= range.end);
  }, [reservedRangesByRoom]);

  const isDayFullyBooked = useCallback((day: Date) => {
    const roomIds = roomAvailability?.room_ids ?? [];
    if (!roomIds.length) return true;
    return roomIds.every((roomId) => isRoomReservedOnDay(roomId, day));
  }, [isRoomReservedOnDay, roomAvailability?.room_ids]);

  const hasContinuousRoomForRange = useCallback((startYmd: string, endYmd: string) => {
    const roomIds = roomAvailability?.room_ids ?? [];
    if (!roomIds.length) return false;

    const startDate = toDateOnly(parseYmd(startYmd));
    const endExclusive = toDateOnly(parseYmd(endYmd));
    const endDate = addDays(endExclusive, -1);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      return false;
    }

    return roomIds.some((roomId) => {
      const ranges = reservedRangesByRoom.get(roomId) ?? [];
      return !ranges.some((range) => range.start <= endDate && range.end >= startDate);
    });
  }, [reservedRangesByRoom, roomAvailability?.room_ids]);

  useEffect(() => {
    if (!form.checkin) return;

    const checkInDate = toDateOnly(parseYmd(form.checkin));
    if (Number.isNaN(checkInDate.getTime())) return;

    if (isDayFullyBooked(checkInDate)) {
      setForm((current) => ({ ...current, checkin: "", checkout: "" }));
      return;
    }

    if (form.checkout && !hasContinuousRoomForRange(form.checkin, form.checkout)) {
      setForm((current) => ({ ...current, checkout: "" }));
    }
  }, [
    form.checkin,
    form.checkout,
    hasContinuousRoomForRange,
    isDayFullyBooked,
  ]);

  const handleNext = () => setStep((current) => Math.min(current + 1, 4));
  const handleBack = () => setStep((current) => Math.max(current - 1, 1));

  const resetBooking = () => {
    const prefilledRoom = normalizedRoomTypeMap.get(preselectedRoomParam.toLowerCase()) || "";
    setStep(prefilledRoom ? 2 : 1);
    setSelectedRoom(prefilledRoom);
    setForm({
      name: "",
      email: "",
      phone: "",
      checkin: "",
      checkout: "",
      guests: "1",
      request: "",
    });
    setVerificationCode("");
    setBookingId("");
    setReferenceNumber("");
  };

  const createBooking = async () => {
    if (!selectedRoom) {
      toast.error("Please select a room.");
      return;
    }

    if (!form.name || !form.email || !form.phone || !form.checkin || !form.checkout) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (new Date(form.checkout).getTime() <= new Date(form.checkin).getTime()) {
      toast.error("Check-out must be after check-in.");
      return;
    }
    if (!hasContinuousRoomForRange(form.checkin, form.checkout)) {
      toast.error("No room available for the selected dates. Please choose different dates.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/public/bookings", {
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create booking.");
      }

      setBookingId(String(payload.booking_id || ""));
      setReferenceNumber(String(payload.reference_number || ""));
      toast.success("We sent a verification code to your email.");
      setStep(3);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking.");
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
      const response = await fetch("/api/public/bookings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          email: form.email,
          code: verificationCode,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Verification failed.");
      }

      toast.success("Booking confirmed.");
      setStep(4);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    if (!bookingId) {
      return;
    }

    try {
      const response = await fetch("/api/public/bookings/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, email: form.email }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to resend code.");
      }

      toast.success("Verification code resent.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code.");
    }
  };

  const dateRangeValid =
    !!form.checkin &&
    !!form.checkout &&
    new Date(form.checkout).getTime() > new Date(form.checkin).getTime();

  const detailsComplete =
    !!selectedRoom &&
    !!form.name &&
    !!form.email &&
    !!form.phone &&
    dateRangeValid;

  return (
    <>
      <PublicPageHero
        description="Reserve in a few clear steps with brighter contrast, cleaner spacing, and a more reassuring booking flow that works better on every screen."
        eyebrow="Book Your Stay"
        imageAlt="Booking at D&M Travelers Inn"
        imageSrc="/images/room-deluxe.jpg"
        stats={[
          { label: "Step flow", value: "4 stage" },
          { label: "Verification", value: "Email code" },
          { label: "Experience", value: "Premium direct booking" },
        ]}
        title="Reserve with confidence in a few clear steps."
      />

      <PublicSection tone="ink" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div className="grid gap-5 lg:grid-cols-[0.34fr_0.66fr]">
            <div className="grid gap-5 self-start lg:sticky lg:top-28">
              <PublicGlassPanel>
                <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                  Reservation Steps
                </p>
                <div className="mt-6 space-y-4">
                  {bookingSteps.map((label, index) => {
                    const stepNumber = index + 1;
                    const active = step === stepNumber;
                    const complete = step > stepNumber;

                    return (
                      <div key={label} className="flex items-center gap-3">
                        <div
                          className={
                            complete
                              ? "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-gold text-secondary"
                              : active
                                ? "flex h-10 w-10 items-center justify-center rounded-full border border-gold-light/30 bg-white/10 text-white"
                                : "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/62"
                          }
                        >
                          {complete ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="font-body text-sm font-semibold">{stepNumber}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-body text-sm text-white/62">Step {stepNumber}</p>
                          <p className="font-heading text-xl text-white">{label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PublicGlassPanel>

              {selectedRoomData ? (
                <PublicGlassPanel className="overflow-hidden p-0">
                  <div className="relative aspect-[4/2.4]">
                    <Image
                      alt={selectedRoomData.room_type}
                      className="object-cover"
                      fill
                      sizes="(max-width: 1024px) 100vw, 34vw"
                      src={selectedRoomData.sample_image_url || fallbackImageForRoomType(selectedRoomData.room_type)}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,rgba(5,14,27,0.82)_100%)]" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.3em] text-gold-light/82">
                        Selected room
                      </p>
                      <p className="mt-2 font-heading text-3xl text-white">
                        {selectedRoomData.room_type}
                      </p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="font-body text-sm leading-7 text-white/80">
                      {selectedRoomData.min_price != null
                        ? `Starting from PHP ${Number(selectedRoomData.min_price).toLocaleString()} per night.`
                        : "Rate available upon inquiry."}
                    </p>
                  </div>
                </PublicGlassPanel>
              ) : null}
            </div>

            <div>
              {step === 1 ? (
                <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }}>
                  <PublicGlassPanel>
                    <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                      Select A Room
                    </p>
                    <h2 className="mt-4 font-heading text-[1.9rem] font-semibold text-white sm:text-3xl">
                      Start by choosing the room category that fits the stay.
                    </h2>

                    <div className="mt-8 space-y-4">
                      {loadingRooms ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]"
                          />
                        ))
                      ) : roomTypes.length === 0 ? (
                        <p className="font-body text-sm text-white/78">No rooms available.</p>
                      ) : (
                        roomTypes.map((room) => (
                          <button
                            key={room.room_type}
                            className={
                              selectedRoom === room.room_type
                                ? "grid w-full gap-4 rounded-[1.5rem] border border-gold-light/30 bg-white/[0.08] p-4 text-left transition-all duration-300 md:grid-cols-[7rem_1fr_auto]"
                                : "grid w-full gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-300 hover:border-white/18 hover:bg-white/[0.06] md:grid-cols-[7rem_1fr_auto]"
                            }
                            onClick={() => setSelectedRoom(room.room_type)}
                            type="button"
                          >
                            <div className="relative h-24 overflow-hidden rounded-[1rem]">
                              <Image
                                alt={room.room_type}
                                className="object-cover"
                                fill
                                sizes="112px"
                                src={room.sample_image_url || fallbackImageForRoomType(room.room_type)}
                              />
                            </div>
                            <div>
                              <p className="font-heading text-2xl text-white">{room.room_type}</p>
                              <p className="mt-2 font-body text-sm text-white/80">
                                {room.min_price != null
                                  ? `From PHP ${Number(room.min_price).toLocaleString()} per night`
                                  : "Rate available upon inquiry"}
                              </p>
                              <p className="mt-3 font-body text-xs uppercase tracking-[0.18em] text-white/60 sm:tracking-[0.24em]">
                                Up to {room.max_capacity ?? "N/A"} guests
                              </p>
                            </div>
                            <div className="flex items-start justify-end">
                              <div
                                className={
                                  selectedRoom === room.room_type
                                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-gold text-secondary"
                                    : "h-9 w-9 rounded-full border border-white/14 bg-white/[0.04]"
                                }
                              >
                                {selectedRoom === room.room_type ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : null}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <Button
                      className="mt-8 h-12 w-full rounded-full bg-gradient-gold font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                      disabled={!selectedRoom}
                      onClick={handleNext}
                    >
                      Continue to guest details
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </PublicGlassPanel>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }}>
                  <PublicGlassPanel>
                    <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                      Guest Details
                    </p>
                    <h2 className="mt-4 font-heading text-[1.9rem] font-semibold text-white sm:text-3xl">
                      Enter reservation details for the stay.
                    </h2>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/12 bg-white/[0.05] px-4 py-3">
                      <p className="font-body text-sm text-white/86">
                        Selected room:{" "}
                        <span className="font-semibold text-white">
                          {selectedRoomData?.room_type || selectedRoom || "Not selected"}
                        </span>
                      </p>
                      <Button
                        className="h-9 rounded-full border-white/16 bg-white/[0.04] px-4 font-body text-xs font-medium text-white hover:bg-white/[0.1]"
                        onClick={() => setStep(1)}
                        type="button"
                        variant="outline"
                      >
                        Change room
                      </Button>
                    </div>

                    {calendarError ? (
                      <p className="mt-3 font-body text-sm text-red-300">{calendarError}</p>
                    ) : null}

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          <UserRound className="h-3.5 w-3.5 text-gold-light" />
                          Full name
                        </span>
                        <input
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          value={form.name}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          <Mail className="h-3.5 w-3.5 text-gold-light" />
                          Email
                        </span>
                        <input
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                          onChange={(event) => setForm({ ...form, email: event.target.value })}
                          type="email"
                          value={form.email}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          <PhoneCall className="h-3.5 w-3.5 text-gold-light" />
                          Phone
                        </span>
                        <input
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                          onChange={(event) => setForm({ ...form, phone: event.target.value })}
                          type="tel"
                          value={form.phone}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          Guests
                        </span>
                        <select
                          className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.04] bg-[length:1.1em_1.1em] bg-[position:right_1rem_center] bg-no-repeat px-4 pr-10 font-body text-sm text-white outline-none transition-colors focus:border-gold-light/30"
                          onChange={(event) => setForm({ ...form, guests: event.target.value })}
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")` }}
                          value={form.guests}
                        >
                          <option className="bg-[#0d1b2a] text-white" value="1">1 guest</option>
                          <option className="bg-[#0d1b2a] text-white" value="2">2 guests</option>
                          <option className="bg-[#0d1b2a] text-white" value="3">3 guests</option>
                          <option className="bg-[#0d1b2a] text-white" value="4">4 guests</option>
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          <CalendarDays className="h-3.5 w-3.5 text-gold-light" />
                          Check-in
                        </span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              className={cn(
                                "h-12 w-full justify-start rounded-2xl border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white hover:bg-white/[0.08]",
                                !form.checkin && "text-white/58",
                              )}
                              disabled={!selectedRoom || loadingAvailability}
                              type="button"
                              variant="outline"
                            >
                              <CalendarDays className="h-4 w-4 text-gold-light" />
                              {form.checkin
                                ? formatDisplayDate(form.checkin)
                                : loadingAvailability
                                  ? "Loading availability..."
                                  : "Select check-in date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-auto border-white/12 bg-secondary/95 p-0 text-white backdrop-blur-xl"
                          >
                            <Calendar
                              classNames={{
                                caption_label: "text-sm font-medium text-white",
                                head_cell: "w-9 rounded-md text-[0.78rem] font-normal text-white/66",
                                nav_button: "h-7 w-7 rounded-md border border-white/14 bg-white/[0.06] p-0 text-white/78 hover:bg-white/[0.12] hover:text-white",
                                day: "h-9 w-9 rounded-md p-0 font-normal text-white hover:bg-white/[0.12]",
                                day_disabled: "text-white/28 opacity-40",
                                day_selected: "bg-gradient-gold text-secondary hover:bg-gradient-gold",
                                day_today: "bg-white/[0.14] text-white",
                              }}
                              disabled={(day) => {
                                const date = toDateOnly(day);
                                if (date < today) return true;
                                return isDayFullyBooked(date);
                              }}
                              mode="single"
                              modifiers={{
                                unavailable: (day) => {
                                  const date = toDateOnly(day);
                                  if (date < today) return false;
                                  return isDayFullyBooked(date);
                                },
                              }}
                              modifiersClassNames={{
                                unavailable: "line-through",
                              }}
                              onSelect={(date) => {
                                if (!date) return;
                                const ymd = toYmd(date);
                                setForm((current) => {
                                  const next = { ...current, checkin: ymd };
                                  if (
                                    next.checkout &&
                                    (new Date(next.checkout).getTime() <= new Date(ymd).getTime() ||
                                      !hasContinuousRoomForRange(ymd, next.checkout))
                                  ) {
                                    next.checkout = "";
                                  }
                                  return next;
                                });
                              }}
                              selected={form.checkin ? parseYmd(form.checkin) : undefined}
                            />
                          </PopoverContent>
                        </Popover>
                      </label>

                      <label className="space-y-2">
                        <span className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                          <CalendarDays className="h-3.5 w-3.5 text-gold-light" />
                          Check-out
                        </span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              className={cn(
                                "h-12 w-full justify-start rounded-2xl border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white hover:bg-white/[0.08]",
                                !form.checkout && "text-white/58",
                              )}
                              disabled={!form.checkin || loadingAvailability}
                              type="button"
                              variant="outline"
                            >
                              <CalendarDays className="h-4 w-4 text-gold-light" />
                              {form.checkout ? formatDisplayDate(form.checkout) : "Select check-out date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-auto border-white/12 bg-secondary/95 p-0 text-white backdrop-blur-xl"
                          >
                            <Calendar
                              classNames={{
                                caption_label: "text-sm font-medium text-white",
                                head_cell: "w-9 rounded-md text-[0.78rem] font-normal text-white/66",
                                nav_button: "h-7 w-7 rounded-md border border-white/14 bg-white/[0.06] p-0 text-white/78 hover:bg-white/[0.12] hover:text-white",
                                day: "h-9 w-9 rounded-md p-0 font-normal text-white hover:bg-white/[0.12]",
                                day_disabled: "text-white/28 opacity-40",
                                day_selected: "bg-gradient-gold text-secondary hover:bg-gradient-gold",
                                day_today: "bg-white/[0.14] text-white",
                              }}
                              disabled={(day) => {
                                if (!form.checkin) return true;
                                const ymd = toYmd(day);
                                if (new Date(ymd).getTime() <= new Date(form.checkin).getTime()) {
                                  return true;
                                }
                                return !hasContinuousRoomForRange(form.checkin, ymd);
                              }}
                              mode="single"
                              modifiers={{
                                unavailable: (day) => {
                                  if (!form.checkin) return false;
                                  const ymd = toYmd(day);
                                  if (new Date(ymd).getTime() <= new Date(form.checkin).getTime()) {
                                    return false;
                                  }
                                  return !hasContinuousRoomForRange(form.checkin, ymd);
                                },
                              }}
                              modifiersClassNames={{
                                unavailable: "line-through",
                              }}
                              onSelect={(date) => {
                                if (!date || !form.checkin) return;
                                const ymd = toYmd(date);
                                if (new Date(ymd).getTime() <= new Date(form.checkin).getTime()) {
                                  return;
                                }
                                if (!hasContinuousRoomForRange(form.checkin, ymd)) {
                                  return;
                                }
                                setForm((current) => ({ ...current, checkout: ymd }));
                              }}
                              selected={form.checkout ? parseYmd(form.checkout) : undefined}
                            />
                          </PopoverContent>
                        </Popover>
                      </label>
                    </div>
                    <p className="mt-3 font-body text-xs text-white/68">
                      Unavailable dates are disabled and crossed out, aligned with live room occupancy.
                    </p>

                    <label className="mt-4 block space-y-2">
                      <span className="font-body text-xs uppercase tracking-[0.18em] text-white/62 sm:tracking-[0.24em]">
                        Special requests
                      </span>
                      <textarea
                        className="min-h-[8rem] w-full rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                        onChange={(event) => setForm({ ...form, request: event.target.value })}
                        placeholder="Arrival notes, room preferences, or special requests"
                        value={form.request}
                      />
                    </label>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <Button
                        className="h-12 rounded-full border-white/14 bg-white/6 px-6 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10 hover:text-white"
                        onClick={handleBack}
                        type="button"
                        variant="outline"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        className="h-12 flex-1 rounded-full bg-gradient-gold font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                        disabled={submitting || loadingAvailability || !detailsComplete}
                        onClick={createBooking}
                      >
                        {submitting ? "Sending verification code..." : "Continue to verification"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </PublicGlassPanel>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }}>
                  <PublicGlassPanel className="mx-auto max-w-xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                      <Mail className="h-7 w-7 text-gold-light" />
                    </div>
                    <p className="mt-6 text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                      Verify Email
                    </p>
                    <h2 className="mt-4 font-heading text-[1.9rem] font-semibold text-white sm:text-3xl">
                      Enter the 6-digit code sent to {form.email}.
                    </h2>
                    <p className="mt-4 font-body text-sm leading-7 text-white/78">
                      This keeps the reservation direct and confirmed before finalizing the booking.
                    </p>

                    <input
                      className="mt-8 h-14 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 text-center font-mono text-xl tracking-[0.2em] text-white outline-none transition-colors placeholder:text-white/24 focus:border-gold-light/30 sm:tracking-[0.34em]"
                      maxLength={6}
                      onChange={(event) =>
                        setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      value={verificationCode}
                    />

                    <p className="mt-4 font-body text-sm text-white/70">
                      Need another code?{" "}
                      <button
                        className="text-gold-light transition-colors duration-300 hover:text-white"
                        onClick={resendCode}
                        type="button"
                      >
                        Resend verification code
                      </button>
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <Button
                        className="h-12 rounded-full border-white/14 bg-white/6 px-6 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10 hover:text-white"
                        onClick={handleBack}
                        type="button"
                        variant="outline"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        className="h-12 flex-1 rounded-full bg-gradient-gold font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                        disabled={verifying || verificationCode.length < 6}
                        onClick={verifyBooking}
                      >
                        {verifying ? "Verifying..." : "Verify and confirm"}
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </PublicGlassPanel>
                </motion.div>
              ) : null}

              {step === 4 ? (
                <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.97 }}>
                  <PublicGlassPanel className="mx-auto max-w-xl text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold/10">
                      <CheckCircle2 className="h-10 w-10 text-gold-light" />
                    </div>
                    <p className="mt-6 text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                      Confirmed
                    </p>
                    <h2 className="mt-4 font-heading text-[2.15rem] font-semibold text-white sm:text-4xl">
                      Your booking is confirmed.
                    </h2>
                    <p className="mt-4 font-body text-sm leading-7 text-white/78">
                      A confirmation email has been sent to {form.email}. Keep the reference below for your records.
                    </p>

                    <div className="mt-8 space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-left">
                      <div className="flex items-center justify-between gap-4 font-body text-sm">
                        <span className="text-white/60">Reference</span>
                        <span className="font-mono text-white">{referenceNumber || "Pending"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-body text-sm">
                        <span className="text-white/60">Room</span>
                        <span className="text-white">{selectedRoomData?.room_type || selectedRoom}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-body text-sm">
                        <span className="text-white/60">Check-in</span>
                        <span className="text-white">{form.checkin}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-body text-sm">
                        <span className="text-white/60">Check-out</span>
                        <span className="text-white">{form.checkout}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-body text-sm">
                        <span className="text-white/60">Guest</span>
                        <span className="text-white">{form.name}</span>
                      </div>
                    </div>

                    <Button
                      className="mt-8 h-12 rounded-full border-white/14 bg-white/6 px-6 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10 hover:text-white"
                      onClick={resetBooking}
                      variant="outline"
                    >
                      Make another booking
                    </Button>
                  </PublicGlassPanel>
                </motion.div>
              ) : null}
            </div>
          </div>
        </PublicGrid>
      </PublicSection>
    </>
  );
}
