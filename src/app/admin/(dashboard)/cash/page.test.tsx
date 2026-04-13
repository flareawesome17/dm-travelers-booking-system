import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsProvider } from "@/context/PermissionsContext";
import CashPage from "./page";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("CashPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/cash/summary") {
        return {
          ok: true,
          json: async () => ({
            cash_receipts_total: 1000,
            restaurant_cash_total: 200,
            cash_expenses_total: 50,
            approved_deposits_total: 300,
            opening_adjustments_total: 100,
            reversals_total: 20,
            available_cash: 970,
            pending_request_total: 0,
            pending_request_count: 0,
          }),
        } as Response;
      }
      if (url === "/api/cash/bank-accounts") {
        return {
          ok: true,
          json: async () => ({
            accounts: [{
              id: "account-1",
              label: "Main BDO",
              bank_name: "BDO",
              account_name: "D&M Travellers Inn",
              account_number_masked: "******1234",
              branch_label: "Plaridel",
              is_active: true,
            }],
          }),
        } as Response;
      }
      if (url === "/api/cash/deposits") {
        return {
          ok: true,
          json: async () => ({
            deposits: [{
              id: "deposit-1",
              amount: 150,
              deposit_reference: "DEP-123",
              deposited_at: "2026-04-13T02:00:00.000Z",
              bank_account_label: "Main BDO",
              bank_name: "BDO",
              account_name: "D&M Travellers Inn",
              account_number_masked: "******1234",
              branch_label: "Plaridel",
              note: "Cash from front desk",
              status: "approved",
              approval_note: null,
              rejection_note: null,
              cancellation_note: null,
              reversal_reason: null,
              requested_by_name: "Front Desk A",
              approved_by_name: "Front Desk A",
            }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
  });

  it("loads the summary, recent deposits, and bank account cards", async () => {
    render(
      <PermissionsProvider permissions={["cash.read", "cash.deposit.request", "cash.deposit.reverse", "cash.bank_account.manage", "cash.adjust"]}>
        <CashPage />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Hotel Cash")).toBeInTheDocument();
    });

    expect(screen.getByText("Recent Deposits")).toBeInTheDocument();
    expect(screen.getAllByText("Opening Adjustment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main BDO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEP-123").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Record Bank Deposit").length).toBeGreaterThan(0);
  });
});
