import { addHours } from "date-fns";
import { getGlobalTimeConfig } from "@/lib/settings";

type SettingsRow = {
  key: string;
  value: string | null;
};

export type ExtensionConflictBooking = {
  id: string;
  room_id?: string | null;
  reference_number?: string | null;
  status?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  reserved_checkin_datetime?: string | null;
  reserved_checkout_datetime?: string | null;
  actual_check_in_at?: string | null;
  rate_plan_kind?: string | null;
  verification_code_expires_at?: string | null;
};

type BookingClockConfig = {
  offset: string;
  checkInTime: string;
  checkOutTime: string;
};

export type ExtensionConflictResult = {
  available: boolean;
  conflict_count: number;
  first_conflict_start: string | null;
  conflict_booking_id: string | null;
  conflict_reference: string | null;
};

function parseDateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getBookingClockConfig(supabase: any): Promise<BookingClockConfig> {
  const [{ offset }, settingsResult] = await Promise.all([
    getGlobalTimeConfig(supabase),
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["check_in_time", "check_out_time"]),
  ]);

  const rows = (settingsResult?.data ?? []) as SettingsRow[];
  const checkInTime = rows.find((row) => row.key === "check_in_time")?.value?.trim() || "14:00";
  const checkOutTime = rows.find((row) => row.key === "check_out_time")?.value?.trim() || "12:00";

  return {
    offset: offset || "+08:00",
    checkInTime,
    checkOutTime,
  };
}

function resolveCheckInDateTime(booking: ExtensionConflictBooking, config: BookingClockConfig) {
  const reserved = parseDateValue(booking.reserved_checkin_datetime);
  if (reserved) return reserved;

  const actualCheckIn = parseDateValue(booking.actual_check_in_at);
  if (actualCheckIn) return actualCheckIn;

  const rawCheckIn = String(booking.check_in_date || "").trim();
  if (!rawCheckIn) return null;
  if (rawCheckIn.length === 10) {
    return parseDateValue(`${rawCheckIn}T${config.checkInTime}:00${config.offset}`);
  }
  return parseDateValue(rawCheckIn);
}

function resolveCheckOutDateTime(booking: ExtensionConflictBooking, config: BookingClockConfig) {
  const reserved = parseDateValue(booking.reserved_checkout_datetime);
  if (reserved) return reserved;

  const rawCheckOut = String(booking.check_out_date || "").trim();
  if (!rawCheckOut) return null;

  if (rawCheckOut.length !== 10) {
    return parseDateValue(rawCheckOut);
  }

  const ratePlan = String(booking.rate_plan_kind || "24h");
  if (ratePlan === "12h" || ratePlan === "5h" || ratePlan === "3h") {
    const start = resolveCheckInDateTime(booking, config);
    const durationHours = Number.parseInt(ratePlan.replace(/\D/g, ""), 10);
    if (start && Number.isFinite(durationHours) && durationHours > 0) {
      return addHours(start, durationHours);
    }
  }

  return parseDateValue(`${rawCheckOut}T${config.checkOutTime}:00${config.offset}`);
}

export function blocksExtension(booking: ExtensionConflictBooking, nowIso: string) {
  const status = String(booking.status || "");
  if (["Cancelled", "No Show", "Checked-Out"].includes(status)) {
    return false;
  }

  if (status === "Pending Verification") {
    const expiresAt = String(booking.verification_code_expires_at || "");
    if (expiresAt && expiresAt < nowIso) return false;
  }

  return true;
}

export function detectExtensionConflicts(params: {
  currentBooking: ExtensionConflictBooking;
  otherBookings: ExtensionConflictBooking[];
  newCheckout: string;
  nowIso: string;
  config: BookingClockConfig;
}): ExtensionConflictResult {
  const currentResolvedCheckout = resolveCheckOutDateTime(params.currentBooking, params.config);
  const requestedCheckout = parseDateValue(params.newCheckout);

  if (!currentResolvedCheckout || !requestedCheckout) {
    return {
      available: true,
      conflict_count: 0,
      first_conflict_start: null,
      conflict_booking_id: null,
      conflict_reference: null,
    };
  }

  const conflicts = params.otherBookings
    .filter((booking) => blocksExtension(booking, params.nowIso))
    .map((booking) => {
      const start = resolveCheckInDateTime(booking, params.config);
      const end = resolveCheckOutDateTime(booking, params.config);
      if (!start || !end) return null;
      if (!(start < requestedCheckout && end > currentResolvedCheckout)) return null;

      return {
        booking,
        start,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      return a.start.getTime() - b.start.getTime();
    }) as Array<{ booking: ExtensionConflictBooking; start: Date }>;

  const firstConflict = conflicts[0];

  return {
    available: conflicts.length === 0,
    conflict_count: conflicts.length,
    first_conflict_start: firstConflict ? firstConflict.start.toISOString() : null,
    conflict_booking_id: firstConflict?.booking.id || null,
    conflict_reference: firstConflict?.booking.reference_number || null,
  };
}

export async function getExtensionConflictResult(params: {
  supabase: any;
  currentBooking: ExtensionConflictBooking;
  newCheckout: string;
  now?: Date;
}): Promise<ExtensionConflictResult> {
  if (!params.currentBooking.room_id) {
    return {
      available: true,
      conflict_count: 0,
      first_conflict_start: null,
      conflict_booking_id: null,
      conflict_reference: null,
    };
  }

  const [config, bookingsResult] = await Promise.all([
    getBookingClockConfig(params.supabase),
    params.supabase
      .from("bookings")
      .select(
        "id, room_id, reference_number, status, check_in_date, check_out_date, reserved_checkin_datetime, reserved_checkout_datetime, actual_check_in_at, rate_plan_kind, verification_code_expires_at",
      )
      .eq("room_id", params.currentBooking.room_id)
      .neq("id", params.currentBooking.id)
      .order("check_in_date", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    throw bookingsResult.error;
  }

  return detectExtensionConflicts({
    currentBooking: params.currentBooking,
    otherBookings: (bookingsResult.data ?? []) as ExtensionConflictBooking[],
    newCheckout: params.newCheckout,
    nowIso: (params.now || new Date()).toISOString(),
    config,
  });
}
