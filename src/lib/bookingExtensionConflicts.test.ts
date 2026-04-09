import { describe, expect, it } from "vitest";
import { blocksExtension, detectExtensionConflicts } from "./bookingExtensionConflicts";

const config = {
  offset: "+08:00",
  checkInTime: "14:00",
  checkOutTime: "12:00",
};

describe("blocksExtension", () => {
  it("excludes only unavailable statuses and expired pending verification", () => {
    expect(blocksExtension({ id: "1", status: "Confirmed" }, "2026-04-09T00:00:00.000Z")).toBe(true);
    expect(blocksExtension({ id: "2", status: "Pending Payment" }, "2026-04-09T00:00:00.000Z")).toBe(true);
    expect(blocksExtension({ id: "3", status: "Pending Verification", verification_code_expires_at: "2026-04-08T00:00:00.000Z" }, "2026-04-09T00:00:00.000Z")).toBe(false);
    expect(blocksExtension({ id: "4", status: "Cancelled" }, "2026-04-09T00:00:00.000Z")).toBe(false);
    expect(blocksExtension({ id: "5", status: "No Show" }, "2026-04-09T00:00:00.000Z")).toBe(false);
    expect(blocksExtension({ id: "6", status: "Checked-Out" }, "2026-04-09T00:00:00.000Z")).toBe(false);
  });
});

describe("detectExtensionConflicts", () => {
  it("blocks future confirmed and pending payment reservations and ignores expired pending verification", () => {
    const result = detectExtensionConflicts({
      currentBooking: {
        id: "current",
        room_id: "room-207",
        check_out_date: "2026-04-09",
        reserved_checkout_datetime: null,
      },
      otherBookings: [
        {
          id: "future-confirmed",
          room_id: "room-207",
          reference_number: "REF-CONF",
          status: "Confirmed",
          check_in_date: "2026-04-11",
          check_out_date: "2026-04-12",
        },
        {
          id: "future-pending",
          room_id: "room-207",
          reference_number: "REF-PAY",
          status: "Pending Payment",
          check_in_date: "2026-04-13",
          check_out_date: "2026-04-14",
        },
        {
          id: "expired-pv",
          room_id: "room-207",
          status: "Pending Verification",
          check_in_date: "2026-04-10",
          check_out_date: "2026-04-11",
          verification_code_expires_at: "2026-04-08T00:00:00.000Z",
        },
      ],
      newCheckout: "2026-04-15T12:00:00.000Z",
      nowIso: "2026-04-09T00:00:00.000Z",
      config,
    });

    expect(result.available).toBe(false);
    expect(result.conflict_count).toBe(2);
    expect(result.conflict_booking_id).toBe("future-confirmed");
    expect(result.conflict_reference).toBe("REF-CONF");
    expect(result.first_conflict_start).toBe("2026-04-11T06:00:00.000Z");
  });

  it("uses fallback datetimes when reserved datetimes are null", () => {
    const result = detectExtensionConflicts({
      currentBooking: {
        id: "current",
        room_id: "room-207",
        check_out_date: "2026-04-09",
        reserved_checkout_datetime: null,
      },
      otherBookings: [
        {
          id: "future",
          room_id: "room-207",
          status: "Confirmed",
          check_in_date: "2026-04-11",
          check_out_date: "2026-04-12",
          reserved_checkin_datetime: null,
          reserved_checkout_datetime: null,
        },
      ],
      newCheckout: "2026-04-14T12:00:00.000Z",
      nowIso: "2026-04-09T00:00:00.000Z",
      config,
    });

    expect(result.available).toBe(false);
    expect(result.conflict_count).toBe(1);
  });
});
