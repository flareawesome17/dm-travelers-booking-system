import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsProvider } from "@/context/PermissionsContext";
import ReportsPage from "./page";

const { replaceMock, refreshMock, routerMock, adminFetchOrRedirectMock, requireAdminSessionMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  routerMock: {
    replace: vi.fn(),
    refresh: vi.fn(),
  },
  adminFetchOrRedirectMock: vi.fn(),
  requireAdminSessionMock: vi.fn(),
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

vi.mock("@/lib/admin-client", () => ({
  adminFetch: vi.fn(),
  adminFetchOrRedirect: adminFetchOrRedirectMock,
  requireAdminSession: requireAdminSessionMock,
}));

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMock.replace = replaceMock;
    routerMock.refresh = refreshMock;
    requireAdminSessionMock.mockResolvedValue(true);
    adminFetchOrRedirectMock.mockImplementation(async (_router: unknown, url: string) => {
      if (url === "/api/reports/shifts/current") {
        return jsonResponse({
          shift_log: {
            id: "shift-log-1",
            date: "2026-04-11",
            status: "OPEN",
            shift_id: "shift-1",
            shifts: { name: "Morning Shift", start_time: "06:00:00", end_time: "14:00:00" },
          },
          summary: {
            total_cash: 0,
            total_gcash: 0,
            total_card: 0,
            total_cheque: 0,
            total_qrph: 0,
            total_amount: 0,
            total_cash_expenses: 0,
            total_non_cash_expenses: 0,
            total_expenses: 0,
            cash_on_hand: 0,
            activity_row_count: 0,
            turnover_row_count: 0,
          },
          activity_rows: [
            {
              booking_id: "booking-1",
              room_no: "105",
              guest_name: "Lucky Webon",
              scheduled_check_in_at: null,
              scheduled_check_out_at: null,
              remaining_balance_due: 200,
              check_in_at: "2026-04-11T14:00:00.000Z",
              check_out_at: null,
              room_rate: 0,
              extra_bed_amount: 0,
              extra_person_amount: 0,
              linens_amount: 0,
              charge_amount: 200,
              minimart_amount: 0,
              food_amount: 0,
              cash_amount: 0,
              gcash_amount: 0,
              card_amount: 0,
              cheque_amount: 0,
              qrph_amount: 0,
              total_amount: 0,
              payment_count: 0,
              reference_numbers: [],
              latest_activity_at: "2026-04-11T14:00:00.000Z",
            },
          ],
          turnover_rows: [],
          expense_summary: { cash_paid: 0, non_cash_paid: 0, total: 0, expense_count: 0 },
          export_template_version: 1,
          report_mode: "live",
        });
      }

      if (url === "/api/shifts/history?page=1&limit=20") {
        return jsonResponse({
          data: [
            {
              id: "shift-log-0",
              date: "2026-04-10",
              status: "CLOSED",
              closed_at: "2026-04-10T14:00:00.000Z",
              total_income: 1000,
              total_expense: 200,
              net_total: 800,
              shifts: { name: "Morning Shift" },
            },
          ],
        });
      }

      if (url.startsWith("/api/reports/revenue?startDate=")) {
        return jsonResponse({
          total_revenue: 1000,
          room_revenue: 800,
          restaurant_revenue: 200,
          total_expenses: 100,
          net_profit: 900,
          by_method: {},
          by_source: {},
          expenses_list: [],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  it("loads the reports dashboard once on mount without duplicate bootstrap fetches", async () => {
    render(
      <PermissionsProvider permissions={["reports.shift_cash.read", "reports.shift_cash.export", "reports.analytics.read"]}>
        <ReportsPage />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Morning Shift Cash-on-Hand Report")).toBeInTheDocument();
    });

    expect(screen.getByText("Payment Methods")).toBeInTheDocument();
    expect(screen.getAllByText("Lucky Webon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Generate AR IR").length).toBeGreaterThan(0);

    const requestedUrls = adminFetchOrRedirectMock.mock.calls.map((call) => call[1]);
    expect(requestedUrls.filter((url) => url === "/api/reports/shifts/current")).toHaveLength(1);
    expect(requestedUrls.filter((url) => url === "/api/shifts/history?page=1&limit=20")).toHaveLength(1);
    expect(requestedUrls.filter((url) => String(url).startsWith("/api/reports/revenue?startDate="))).toHaveLength(1);
  });
});
