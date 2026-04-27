export type BookingAnalyticsRow = {
  status?: string | null;
  is_lgu_booking?: boolean | null;
  is_special_booking?: boolean | null;
  special_booking_label?: string | null;
  reference_number?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  actual_check_in_at?: string | null;
  actual_check_out_at?: string | null;
  rate_plan_kind?: string | null;
  booking_source?: string | null;
  external_reference?: string | null;
  guests?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  rooms?: {
    room_number?: string | null;
    room_type?: string | null;
  } | null;
};

export type BookingAnalyticsRoom = {
  status?: string | null;
  is_active?: boolean | null;
};

export type BookingDateScope = "all" | "today";

export type BookingAnalyticsCardKey =
  | "checkedInToday"
  | "checkedOutToday"
  | "totalBookings"
  | "lguBookings"
  | "specialBookings"
  | "pendingPayment"
  | "occupancyPercent"
  | "availableRoomsToday";

export type BookingAnalyticsSummary = {
  today: string;
  timezone: string;
  checkedInToday: number;
  checkedOutToday: number;
  totalBookings: number;
  lguBookings: number;
  specialBookings: number;
  pendingPayment: number;
  occupancyPercent: number;
  availableRoomsToday: number;
  occupiedRooms: number;
  activeRooms: number;
  roomsExcludedFromOccupancy: number;
};

export type BookingAnalyticsFilterState = {
  statusFilter: string;
  typeFilter: string;
  dateScope: BookingDateScope;
};

export function getDateStringInTimeZone(
  value: string | Date | null | undefined,
  timeZone = "Asia/Manila",
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function summarizeBookingAnalytics(params: {
  bookings: BookingAnalyticsRow[];
  rooms: BookingAnalyticsRoom[];
  today: string;
  timezone?: string;
}): BookingAnalyticsSummary {
  const timezone = params.timezone || "Asia/Manila";
  const activeRooms = params.rooms.filter((room) => room.is_active !== false);
  const roomsExcludedFromOccupancy = activeRooms.filter((room) => String(room.status || "") === "Maintenance").length;
  const usableRooms = activeRooms.filter((room) => String(room.status || "") !== "Maintenance");
  const occupiedRooms = usableRooms.filter((room) => String(room.status || "") === "Occupied").length;
  const availableRoomsToday = usableRooms.filter((room) => String(room.status || "") === "Available").length;

  return {
    today: params.today,
    timezone,
    checkedInToday: params.bookings.filter((booking) => {
      return (
        String(booking.status || "") === "Checked-In" &&
        getDateStringInTimeZone(booking.actual_check_in_at, timezone) === params.today
      );
    }).length,
    checkedOutToday: params.bookings.filter((booking) => {
      return (
        String(booking.status || "") === "Checked-Out" &&
        getDateStringInTimeZone(booking.actual_check_out_at, timezone) === params.today
      );
    }).length,
    totalBookings: params.bookings.length,
    lguBookings: params.bookings.filter((booking) => !!booking.is_lgu_booking).length,
    specialBookings: params.bookings.filter((booking) => !!booking.is_special_booking).length,
    pendingPayment: params.bookings.filter((booking) => String(booking.status || "") === "Pending Payment").length,
    occupancyPercent: usableRooms.length > 0 ? Math.round((occupiedRooms / usableRooms.length) * 100) : 0,
    availableRoomsToday,
    occupiedRooms,
    activeRooms: activeRooms.length,
    roomsExcludedFromOccupancy,
  };
}

export function getFiltersForBookingAnalyticsCard(
  key: BookingAnalyticsCardKey,
): BookingAnalyticsFilterState | null {
  switch (key) {
    case "checkedInToday":
      return { statusFilter: "Checked-In", typeFilter: "all", dateScope: "today" };
    case "checkedOutToday":
      return { statusFilter: "Checked-Out", typeFilter: "all", dateScope: "today" };
    case "totalBookings":
      return { statusFilter: "all", typeFilter: "all", dateScope: "all" };
    case "lguBookings":
      return { statusFilter: "all", typeFilter: "lgu", dateScope: "all" };
    case "specialBookings":
      return { statusFilter: "all", typeFilter: "special", dateScope: "all" };
    case "pendingPayment":
      return { statusFilter: "Pending Payment", typeFilter: "all", dateScope: "all" };
    default:
      return null;
  }
}

function matchesTodayScope(
  booking: BookingAnalyticsRow,
  statusFilter: string,
  today: string,
  timezone: string,
) {
  if (statusFilter === "Checked-In") {
    return getDateStringInTimeZone(booking.actual_check_in_at, timezone) === today;
  }

  if (statusFilter === "Checked-Out") {
    return getDateStringInTimeZone(booking.actual_check_out_at, timezone) === today;
  }

  return true;
}

export function filterAdminBookings(params: {
  bookings: BookingAnalyticsRow[];
  statusFilter: string;
  typeFilter: string;
  search: string;
  dateScope: BookingDateScope;
  today: string;
  timezone?: string;
}): BookingAnalyticsRow[] {
  const timezone = params.timezone || "Asia/Manila";
  const term = params.search.trim().toLowerCase();

  return params.bookings.filter((booking) => {
    const matchesStatus =
      params.statusFilter === "all"
        ? true
        : String(booking.status || "").toLowerCase() === params.statusFilter.toLowerCase();

    let matchesType = true;
    if (params.typeFilter === "lgu") matchesType = !!booking.is_lgu_booking;
    else if (params.typeFilter === "special") matchesType = !!booking.is_special_booking;
    else if (params.typeFilter === "normal") matchesType = !booking.is_lgu_booking && !booking.is_special_booking;
    else if (params.typeFilter === "booking.com") matchesType = String(booking.booking_source || "").toLowerCase() === "booking.com";

    const matchesSearch = !term
      ? true
      : [
          booking.reference_number,
          booking.guests?.full_name,
          booking.guests?.email,
          booking.rooms?.room_number,
          booking.rooms?.room_type,
          booking.rate_plan_kind,
          booking.is_lgu_booking ? "lgu booking" : "",
          booking.is_special_booking ? "special booking" : "",
          booking.special_booking_label,
          booking.booking_source,
          booking.external_reference,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);

    const matchesDateScope =
      params.dateScope === "all"
        ? true
        : matchesTodayScope(booking, params.statusFilter, params.today, timezone);

    return matchesStatus && matchesType && matchesSearch && matchesDateScope;
  });
}
