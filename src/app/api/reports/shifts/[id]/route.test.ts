import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requirePermissionMock, getShiftCashReportByIdMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getShiftCashReportByIdMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/shiftCashReports", () => ({
  getShiftCashReportById: getShiftCashReportByIdMock,
}));

import { GET } from "./route";

describe("GET /api/reports/shifts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when reports.shift_cash.read is missing", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({} as any, { params: Promise.resolve({ id: "shift-log-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getShiftCashReportByIdMock).not.toHaveBeenCalled();
  });

  it("returns the requested shift report", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    getShiftCashReportByIdMock.mockResolvedValue({
      shift_log: { id: "shift-log-9", date: "2026-04-09", status: "CLOSED" },
      summary: { cash_on_hand: 800 },
      activity_rows: [{ room_no: "101", guest_name: "Jane Doe" }],
      turnover_rows: [],
      expense_summary: { cash_paid: 0, non_cash_paid: 0, total: 0, expense_count: 0 },
      export_template_version: 1,
      report_mode: "snapshot",
    });

    const response = await GET({} as any, { params: Promise.resolve({ id: "shift-log-9" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getShiftCashReportByIdMock).toHaveBeenCalledWith("shift-log-9");
    expect(body.shift_log.id).toBe("shift-log-9");
    expect(body.report_mode).toBe("snapshot");
  });
});
