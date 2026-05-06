import { describe, expect, it } from "vitest";
import { buildOtherServicesSummary, calculateOtherServiceTotal } from "./otherServices";

describe("calculateOtherServiceTotal", () => {
  it("calculates fixed-rate service totals", () => {
    expect(calculateOtherServiceTotal(10, 3)).toBe(30);
    expect(calculateOtherServiceTotal(250, 2)).toBe(500);
    expect(calculateOtherServiceTotal(100, 1.5)).toBe(150);
  });
});

describe("buildOtherServicesSummary", () => {
  it("summarizes service revenue by service and payment method", () => {
    const summary = buildOtherServicesSummary([
      {
        id: "record-1",
        service_type_id: "type-1",
        service_code: "parking",
        service_name: "Parking Fee",
        unit_label: "day",
        unit_rate: 10,
        quantity: 2,
        total_amount: 20,
        payment_method: "Cash",
        payment_reference: null,
        customer_name: null,
        room_number: null,
        note: null,
        accounting_date: "2026-05-06",
        recorded_by_admin_id: null,
        created_at: "2026-05-06T00:00:00.000Z",
      },
      {
        id: "record-2",
        service_type_id: "type-2",
        service_code: "laundry",
        service_name: "Laundry Charge",
        unit_label: "load",
        unit_rate: 250,
        quantity: 1,
        total_amount: 250,
        payment_method: "GCash",
        payment_reference: "GC-1",
        customer_name: "Guest",
        room_number: "101",
        note: null,
        accounting_date: "2026-05-06",
        recorded_by_admin_id: null,
        created_at: "2026-05-06T00:00:00.000Z",
      },
    ]);

    expect(summary).toEqual({
      total_revenue: 270,
      transaction_count: 2,
      by_service: {
        "Parking Fee": 20,
        "Laundry Charge": 250,
      },
      by_method: {
        Cash: 20,
        GCash: 250,
      },
    });
  });
});
