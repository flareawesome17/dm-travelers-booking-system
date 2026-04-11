import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requirePermissionMock, getCurrentShiftCashReportMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getCurrentShiftCashReportMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/shiftCashReports", () => ({
  getCurrentShiftCashReport: getCurrentShiftCashReportMock,
}));

import { GET } from "./route";

describe("GET /api/reports/shifts/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when reports.shift_cash.read is missing", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getCurrentShiftCashReportMock).not.toHaveBeenCalled();
  });

  it("returns the current shift report", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    getCurrentShiftCashReportMock.mockResolvedValue({
      shift_log: { id: "shift-log-1", date: "2026-04-10", status: "OPEN" },
      summary: { cash_on_hand: 1200 },
      activity_rows: [],
      turnover_rows: [],
      expense_summary: { cash_paid: 0, non_cash_paid: 0, total: 0, expense_count: 0 },
      export_template_version: 1,
      report_mode: "live",
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.shift_log.id).toBe("shift-log-1");
    expect(body.summary.cash_on_hand).toBe(1200);
  });
});
