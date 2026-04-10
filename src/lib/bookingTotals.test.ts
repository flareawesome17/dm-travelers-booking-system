import { describe, expect, it } from "vitest";

import { calculateBookingRoomSubtotal, getBookingRateForRoom } from "./bookingTotals";

describe("bookingTotals pricing helpers", () => {
  const room = {
    rate_24h_enabled: true,
    rate_24h_price: 2380,
    rate_12h_enabled: true,
    rate_12h_price: 1500,
    lgu_rate_enabled: true,
    lgu_rate_24h_price: 1800,
    lgu_rate_12h_price: 1200,
  };

  it("uses LGU override pricing when the booking is marked as LGU", () => {
    expect(getBookingRateForRoom(room, "24h", true)).toBe(1800);
    expect(getBookingRateForRoom(room, "12h", true)).toBe(1200);
  });

  it("falls back to standard pricing for normal and special bookings", () => {
    expect(getBookingRateForRoom(room, "24h", false)).toBe(2380);
    expect(
      calculateBookingRoomSubtotal({
        room,
        ratePlanKind: "24h",
        checkInDate: "2026-04-10",
        checkOutDate: "2026-04-11",
        isLguBooking: false,
      }),
    ).toBe(2380);
  });
});
