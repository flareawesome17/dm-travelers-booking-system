import { describe, expect, it } from "vitest";
import {
  filterAdminBookings,
  getFiltersForBookingAnalyticsCard,
  summarizeBookingAnalytics,
} from "./bookingAnalytics";

describe("summarizeBookingAnalytics", () => {
  it("computes booking counts and room occupancy using the configured timezone", () => {
    const summary = summarizeBookingAnalytics({
      today: "2026-04-09",
      timezone: "Asia/Manila",
      bookings: [
        {
          status: "Checked-In",
          actual_check_in_at: "2026-04-08T16:30:00.000Z",
          is_lgu_booking: true,
        },
        {
          status: "Checked-Out",
          actual_check_out_at: "2026-04-09T01:10:00.000Z",
          is_special_booking: true,
        },
        {
          status: "Pending Payment",
        },
        {
          status: "Checked-In",
          actual_check_in_at: "2026-04-07T12:00:00.000Z",
        },
      ],
      rooms: [
        { status: "Occupied", is_active: true },
        { status: "Available", is_active: true },
        { status: "Dirty", is_active: true },
        { status: "Maintenance", is_active: true },
        { status: "Available", is_active: false },
      ],
    });

    expect(summary.checkedInToday).toBe(1);
    expect(summary.checkedOutToday).toBe(1);
    expect(summary.totalBookings).toBe(4);
    expect(summary.lguBookings).toBe(1);
    expect(summary.specialBookings).toBe(1);
    expect(summary.pendingPayment).toBe(1);
    expect(summary.activeRooms).toBe(4);
    expect(summary.roomsExcludedFromOccupancy).toBe(1);
    expect(summary.availableRoomsToday).toBe(1);
    expect(summary.occupancyPercent).toBe(33);
  });

  it("avoids divide-by-zero when there are no usable rooms", () => {
    const summary = summarizeBookingAnalytics({
      today: "2026-04-09",
      bookings: [],
      rooms: [
        { status: "Maintenance", is_active: true },
        { status: "Available", is_active: false },
      ],
    });

    expect(summary.occupancyPercent).toBe(0);
    expect(summary.availableRoomsToday).toBe(0);
  });
});

describe("filterAdminBookings", () => {
  const bookings = [
    {
      status: "Checked-In",
      actual_check_in_at: "2026-04-08T16:30:00.000Z",
      reference_number: "REF-TODAY-IN",
      is_lgu_booking: true,
      guests: { full_name: "Today In" },
      rooms: { room_number: "101", room_type: "Deluxe" },
    },
    {
      status: "Checked-In",
      actual_check_in_at: "2026-04-07T16:30:00.000Z",
      reference_number: "REF-OLD-IN",
      guests: { full_name: "Old In" },
      rooms: { room_number: "102", room_type: "Suite" },
    },
    {
      status: "Pending Payment",
      reference_number: "REF-PENDING",
      is_special_booking: true,
      special_booking_label: "Special Booking",
      guests: { full_name: "Special Guest" },
      rooms: { room_number: "201", room_type: "Family" },
    },
  ];

  it("filters by today scope using actual check-in timestamps for checked-in rows", () => {
    const filtered = filterAdminBookings({
      bookings,
      statusFilter: "Checked-In",
      typeFilter: "all",
      search: "",
      dateScope: "today",
      today: "2026-04-09",
      timezone: "Asia/Manila",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.reference_number).toBe("REF-TODAY-IN");

    const clearedDateScope = filterAdminBookings({
      bookings,
      statusFilter: "Checked-In",
      typeFilter: "all",
      search: "",
      dateScope: "all",
      today: "2026-04-09",
      timezone: "Asia/Manila",
    });

    expect(clearedDateScope).toHaveLength(2);
  });

  it("keeps search and type filters working with the extracted helper", () => {
    const filtered = filterAdminBookings({
      bookings,
      statusFilter: "all",
      typeFilter: "special",
      search: "special guest",
      dateScope: "all",
      today: "2026-04-09",
      timezone: "Asia/Manila",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.reference_number).toBe("REF-PENDING");
  });
});

describe("getFiltersForBookingAnalyticsCard", () => {
  it("maps quick-filter cards to the expected page filter state", () => {
    expect(getFiltersForBookingAnalyticsCard("checkedInToday")).toEqual({
      statusFilter: "Checked-In",
      typeFilter: "all",
      dateScope: "today",
    });
    expect(getFiltersForBookingAnalyticsCard("pendingPayment")).toEqual({
      statusFilter: "Pending Payment",
      typeFilter: "all",
      dateScope: "all",
    });
    expect(getFiltersForBookingAnalyticsCard("occupancyPercent")).toBeNull();
  });
});
