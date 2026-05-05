import { describe, expect, it } from "vitest";
import { buildGcashSummary, calculateGcashServiceCharge } from "./gcash";

describe("calculateGcashServiceCharge", () => {
  it("charges PHP 20 for every 1-1000 amount tier", () => {
    expect(calculateGcashServiceCharge(1)).toBe(20);
    expect(calculateGcashServiceCharge(1000)).toBe(20);
    expect(calculateGcashServiceCharge(1001)).toBe(40);
    expect(calculateGcashServiceCharge(2500)).toBe(60);
  });
});

describe("buildGcashSummary", () => {
  it("builds GCash balance from tagged inflows, expenses, and manual wallet outflows", () => {
    const summary = buildGcashSummary({
      paymentRows: [{ amount: 1000 }, { amount: 300 }],
      restaurantRows: [{ total_amount: 250 }],
      receivableRows: [
        { amount: 400, notes: "Direct AR payment" },
        { amount: 999, notes: "Synced from booking payment TXN-1" },
      ],
      expenseRows: [{ amount: 100 }],
      ledgerRows: [
        { direction: "credit", entry_type: "opening_adjustment", amount: 500 },
        { direction: "debit", entry_type: "cash_in", amount: 700, service_charge: 20 },
        { direction: "debit", entry_type: "load", amount: 1200, service_charge: 40 },
      ],
    });

    expect(summary).toEqual({
      booking_gcash_total: 1300,
      restaurant_gcash_total: 250,
      receivable_gcash_total: 400,
      gcash_expenses_total: 100,
      manual_cash_in_total: 700,
      manual_load_total: 1200,
      service_charges_total: 60,
      opening_adjustments_total: 500,
      available_gcash: 450,
    });
  });
});
