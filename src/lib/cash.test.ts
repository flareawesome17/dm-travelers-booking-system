import { describe, expect, it } from "vitest";
import { buildCashSummary } from "./cash";

describe("buildCashSummary", () => {
  it("builds the available cash summary from cash sources, expenses, deposits, reversals, and opening adjustment", () => {
    const summary = buildCashSummary({
      paymentRows: [{ amount: 1000 }, { amount: 250.5 }],
      restaurantRows: [{ total_amount: 300 }],
      expenseRows: [{ amount: 125.25 }],
      ledgerRows: [
        { direction: "credit", entry_type: "opening_adjustment", amount: 200 },
        { direction: "debit", entry_type: "bank_deposit", amount: 600 },
        { direction: "credit", entry_type: "deposit_reversal", amount: 100 },
      ],
      pendingRows: [{ amount: 80 }, { amount: 20 }],
    });

    expect(summary).toEqual({
      cash_receipts_total: 1250.5,
      restaurant_cash_total: 300,
      cash_expenses_total: 125.25,
      approved_deposits_total: 600,
      opening_adjustments_total: 200,
      reversals_total: 100,
      available_cash: 1125.25,
      pending_request_total: 100,
      pending_request_count: 2,
    });
  });

  it("exposes negative opening adjustments through the signed ledger effect", () => {
    const summary = buildCashSummary({
      paymentRows: [],
      restaurantRows: [],
      expenseRows: [],
      ledgerRows: [{ direction: "debit", entry_type: "opening_adjustment", amount: 50 }],
      pendingRows: [],
    });

    expect(summary.opening_adjustments_total).toBe(-50);
    expect(summary.available_cash).toBe(-50);
  });
});
