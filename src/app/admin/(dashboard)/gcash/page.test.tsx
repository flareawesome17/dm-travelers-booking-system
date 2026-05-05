import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsProvider } from "@/context/PermissionsContext";
import GcashPage from "./page";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("GcashPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/gcash/summary") {
        return {
          ok: true,
          json: async () => ({
            booking_gcash_total: 1000,
            restaurant_gcash_total: 250,
            receivable_gcash_total: 300,
            gcash_expenses_total: 50,
            manual_cash_in_total: 500,
            manual_load_total: 200,
            service_charges_total: 40,
            opening_adjustments_total: 1000,
            available_gcash: 1900,
          }),
        } as Response;
      }
      if (url === "/api/gcash/transactions") {
        return {
          ok: true,
          json: async () => ({
            transactions: [{
              id: "entry-1",
              direction: "debit",
              entry_type: "cash_in",
              amount: 500,
              service_charge: 20,
              effective_at: "2026-05-06T02:00:00.000Z",
              transaction_reference: "GC-123",
              customer_name: "Juan Dela Cruz",
              recipient_number: "09171234567",
              description: "GCash cash-in",
              note: "Customer cash-in",
              performed_by_name: "Front Desk A",
            }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
  });

  it("loads the GCash summary and ledger", async () => {
    render(
      <PermissionsProvider permissions={["gcash.read", "gcash.transact", "gcash.adjust"]}>
        <GcashPage />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("GCash")).toBeInTheDocument();
    });

    expect(screen.getByText("Available GCash")).toBeInTheDocument();
    expect(screen.getByText("Tagged Payments")).toBeInTheDocument();
    expect(screen.getByText("GCash Ledger")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("GC-123")).toBeInTheDocument();
    expect(screen.getByText("Record Transaction")).toBeInTheDocument();
  });
});
