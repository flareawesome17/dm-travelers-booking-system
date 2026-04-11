import { describe, expect, it } from "vitest";
import {
  buildCollectibleTurnovers,
  getRestaurantChargeBreakdown,
  type ShiftCashReportRow,
  type ShiftCashTurnoverRow,
} from "./shiftCashReports";

function createActivityRow(overrides: Partial<ShiftCashReportRow> = {}): ShiftCashReportRow {
  return {
    booking_id: "booking-1",
    room_no: "101",
    guest_name: "Guest One",
    check_in_at: "2026-04-11T06:00:00.000Z",
    check_out_at: null,
    room_rate: 2380,
    extra_bed_amount: 0,
    extra_person_amount: 0,
    linens_amount: 0,
    charge_amount: 0,
    minimart_amount: 0,
    food_amount: 0,
    early_checkin_amount: 0,
    late_checkout_amount: 0,
    cash_amount: 500,
    gcash_amount: 0,
    card_amount: 0,
    cheque_amount: 0,
    qrph_amount: 0,
    total_amount: 500,
    payment_count: 1,
    reference_numbers: [],
    latest_activity_at: "2026-04-11T07:00:00.000Z",
    ...overrides,
  };
}

function createTurnoverRow(overrides: Partial<ShiftCashTurnoverRow> = {}): ShiftCashTurnoverRow {
  return {
    booking_id: "booking-1",
    room_no: "101",
    guest_name: "Guest One",
    check_in_at: "2026-04-11T06:00:00.000Z",
    check_out_at: null,
    room_rate: 2380,
    extra_bed_amount: 0,
    extra_person_amount: 0,
    linens_amount: 0,
    charge_amount: 0,
    minimart_amount: 0,
    food_amount: 0,
    early_checkin_amount: 0,
    late_checkout_amount: 0,
    total_amount: 500,
    collectible_amount: 500,
    latest_activity_at: "2026-04-11T07:00:00.000Z",
    source_shift_log_id: "shift-log-1",
    source_shift_name: "Morning Shift",
    ...overrides,
  };
}

describe("buildCollectibleTurnovers", () => {
  it("splits restaurant charges between food and minimart from order-item snapshots", () => {
    const result = getRestaurantChargeBreakdown([
      { order_id: "order-1", line_total: 120, is_minimart: false } as any,
      { order_id: "order-1", line_total: 45, is_minimart: true } as any,
      { order_id: "order-1", line_total: 30, is_minimart: null } as any,
    ]);

    expect(result).toEqual({
      food_amount: 150,
      minimart_amount: 45,
      has_snapshot_lines: true,
    });
  });

  it("continues carrying an incoming turnover booking even without new shift payments", () => {
    const result = buildCollectibleTurnovers({
      activityRows: [],
      incomingTurnoverRows: [createTurnoverRow()],
      bookingsById: new Map([
        ["booking-1", {
          id: "booking-1",
          room_no: "101",
          guest_name: "Guest One",
          total_amount: 2380,
          balance_due: 300,
          restaurant_charges_total: 0,
          actual_check_in_at: "2026-04-11T06:00:00.000Z",
          actual_check_out_at: null,
        } as any],
      ]),
      bookingExtrasById: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      booking_id: "booking-1",
      collectible_amount: 300,
      total_amount: 300,
      check_in_at: "2026-04-11T06:00:00.000Z",
      check_out_at: null,
    });
  });

  it("only carries checked-in bookings that still have collectible balance", () => {
    const result = buildCollectibleTurnovers({
      activityRows: [
        createActivityRow({ booking_id: "booking-open", room_no: "201", guest_name: "Open Guest" }),
        createActivityRow({ booking_id: "booking-reservation", room_no: "202", guest_name: "Reservation Guest", check_in_at: null }),
        createActivityRow({ booking_id: "booking-checkedout", room_no: "203", guest_name: "Checked Out Guest", check_out_at: "2026-04-11T10:00:00.000Z" }),
        createActivityRow({ booking_id: "booking-settled", room_no: "204", guest_name: "Settled Guest" }),
      ],
      incomingTurnoverRows: [],
      bookingsById: new Map([
        ["booking-open", {
          id: "booking-open",
          room_no: "201",
          guest_name: "Open Guest",
          total_amount: 2380,
          balance_due: 450,
          restaurant_charges_total: 0,
          actual_check_in_at: "2026-04-11T06:00:00.000Z",
          actual_check_out_at: null,
        } as any],
        ["booking-reservation", {
          id: "booking-reservation",
          room_no: "202",
          guest_name: "Reservation Guest",
          total_amount: 2380,
          balance_due: 450,
          restaurant_charges_total: 0,
          actual_check_in_at: null,
          actual_check_out_at: null,
        } as any],
        ["booking-checkedout", {
          id: "booking-checkedout",
          room_no: "203",
          guest_name: "Checked Out Guest",
          total_amount: 2380,
          balance_due: 450,
          restaurant_charges_total: 0,
          actual_check_in_at: "2026-04-11T06:00:00.000Z",
          actual_check_out_at: "2026-04-11T10:00:00.000Z",
        } as any],
        ["booking-settled", {
          id: "booking-settled",
          room_no: "204",
          guest_name: "Settled Guest",
          total_amount: 2380,
          balance_due: 0,
          restaurant_charges_total: 0,
          actual_check_in_at: "2026-04-11T06:00:00.000Z",
          actual_check_out_at: null,
        } as any],
      ]),
      bookingExtrasById: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      booking_id: "booking-open",
      collectible_amount: 450,
    });
  });

  it("preserves current food and minimart allocations on turnover rows", () => {
    const result = buildCollectibleTurnovers({
      activityRows: [createActivityRow()],
      incomingTurnoverRows: [],
      bookingsById: new Map([
        ["booking-1", {
          id: "booking-1",
          room_no: "101",
          guest_name: "Guest One",
          total_amount: 2380,
          balance_due: 300,
          restaurant_charges_total: 195,
          actual_check_in_at: "2026-04-11T06:00:00.000Z",
          actual_check_out_at: null,
        } as any],
      ]),
      bookingExtrasById: new Map(),
      restaurantChargesByBookingId: new Map([
        ["booking-1", {
          food_amount: 150,
          minimart_amount: 45,
          has_snapshot_lines: true,
        }],
      ]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      booking_id: "booking-1",
      food_amount: 150,
      minimart_amount: 45,
      collectible_amount: 300,
    });
  });
});
