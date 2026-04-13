import { describe, expect, it } from "vitest";
import {
  buildCollectibleTurnovers,
  createBaseRow,
  formatReferenceNumbersForWorkbook,
  getReservationScheduleDisplay,
  getRestaurantChargeBreakdown,
  mergeIncomingTurnoversIntoActivityRows,
  type ShiftCashReportRow,
  type ShiftCashTurnoverRow,
} from "./shiftCashReports";

function createActivityRow(overrides: Partial<ShiftCashReportRow> = {}): ShiftCashReportRow {
  return {
    booking_id: "booking-1",
    room_no: "101",
    guest_name: "Guest One",
    scheduled_check_in_at: null,
    scheduled_check_out_at: null,
    remaining_balance_due: 0,
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
    scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
    scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
    remaining_balance_due: 300,
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
  it("keeps reservation schedule fields on live activity rows built from bookings", () => {
    const row = createBaseRow({
      id: "booking-1",
      room_no: "204",
      guest_name: "Reservation Guest",
      total_amount: 1930,
      balance_due: 700,
      actual_check_in_at: null,
      actual_check_out_at: null,
      reserved_checkin_datetime: "2026-04-12T06:00:00.000Z",
      reserved_checkout_datetime: "2026-04-13T04:00:00.000Z",
    } as any, []);

    expect(row).toMatchObject({
      scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
      scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
      remaining_balance_due: 700,
      check_in_at: null,
    });
  });

  it("formats reservation schedule text for reservations that are not yet checked in, regardless of payment status", () => {
    expect(getReservationScheduleDisplay(createActivityRow({
      scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
      scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
      remaining_balance_due: 700,
      check_in_at: null,
      latest_activity_at: "2026-04-11T05:00:00.000Z",
    }))).toContain("CI:");

    expect(getReservationScheduleDisplay(createActivityRow({
      scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
      scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
      remaining_balance_due: 0,
      check_in_at: null,
      latest_activity_at: "2026-04-11T05:00:00.000Z",
    }))).toContain("CI:");

    expect(getReservationScheduleDisplay(createActivityRow({
      scheduled_check_in_at: "2026-04-10T06:00:00.000Z",
      scheduled_check_out_at: "2026-04-11T04:00:00.000Z",
      remaining_balance_due: 700,
      check_in_at: null,
      latest_activity_at: "2026-04-11T05:00:00.000Z",
    }))).toContain("CI:");

    expect(getReservationScheduleDisplay(createActivityRow({
      scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
      scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
      remaining_balance_due: 700,
      check_in_at: "2026-04-11T06:00:00.000Z",
    }))).toBe("");
  });

  it("shortens workbook reference numbers to the last four digits", () => {
    expect(formatReferenceNumbersForWorkbook([
      "TXN-1775905057294-326",
      "QR-123",
      "cash",
      "TXN-1775905057294-326",
    ])).toBe("4326, 123");
  });

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

  it("allocates collectible rows to the remaining unpaid components instead of the original booking total", () => {
    const result = buildCollectibleTurnovers({
      activityRows: [createActivityRow({
        booking_id: "booking-1",
        room_no: "105",
        guest_name: "Lucky Webon",
        card_amount: 200,
        total_amount: 200,
      })],
      incomingTurnoverRows: [],
      bookingsById: new Map([
        ["booking-1", {
          id: "booking-1",
          room_no: "105",
          guest_name: "Lucky Webon",
          total_amount: 1180,
          balance_due: 200,
          restaurant_charges_total: 0,
          actual_check_in_at: "2026-04-11T14:00:00.000Z",
          actual_check_out_at: null,
        } as any],
      ]),
      bookingExtrasById: new Map([
        ["booking-1", [
          {
            booking_id: "booking-1",
            extra_type: "other",
            total_price: 200,
          } as any,
        ]],
      ]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      booking_id: "booking-1",
      room_rate: 0,
      charge_amount: 200,
      collectible_amount: 200,
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

  it("folds incoming turnover rows into the main activity sheet when the booking has no new shift payment", () => {
    const mergedRows = mergeIncomingTurnoversIntoActivityRows(
      [createActivityRow({ booking_id: "booking-2", room_no: "102" })],
      [createTurnoverRow({
        booking_id: "booking-1",
        room_no: "105",
        guest_name: "Lucky Webon",
        charge_amount: 200,
        remaining_balance_due: 200,
        collectible_amount: 200,
      })],
    );

    expect(mergedRows).toHaveLength(2);
    expect(mergedRows.find((row) => row.booking_id === "booking-1")).toMatchObject({
      room_no: "105",
      charge_amount: 200,
      cash_amount: 0,
      card_amount: 0,
      total_amount: 0,
      remaining_balance_due: 200,
    });
  });
});
