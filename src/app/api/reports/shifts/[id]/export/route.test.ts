import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  getShiftCashReportByIdMock,
  generateShiftCashReportWorkbookMock,
  getSupabaseAdminMock,
  maybeSingleMock,
  eqMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    requirePermissionMock: vi.fn(),
    getShiftCashReportByIdMock: vi.fn(),
    generateShiftCashReportWorkbookMock: vi.fn(),
    getSupabaseAdminMock: vi.fn(() => ({ from: fromMock })),
    maybeSingleMock,
    eqMock,
    selectMock,
    fromMock,
  };
});

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/shiftCashReports", () => ({
  getShiftCashReportById: getShiftCashReportByIdMock,
  generateShiftCashReportWorkbook: generateShiftCashReportWorkbookMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { GET } from "./route";

describe("GET /api/reports/shifts/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: { name: "Ella Joy", email: "ella@example.com" }, error: null });
    getShiftCashReportByIdMock.mockResolvedValue({
      shift_log: { id: "shift-log-9", date: "2026-04-09", shifts: { name: "Morning Shift" } },
    });
    generateShiftCashReportWorkbookMock.mockResolvedValue(Buffer.from("xlsx"));
  });

  it("returns the permission error when reports.shift_cash.export is missing", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({} as any, { params: Promise.resolve({ id: "shift-log-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getShiftCashReportByIdMock).not.toHaveBeenCalled();
    expect(generateShiftCashReportWorkbookMock).not.toHaveBeenCalled();
  });

  it("passes the current admin name into the workbook generator", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });

    const response = await GET({} as any, { params: Promise.resolve({ id: "shift-log-9" }) });

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("admin_users");
    expect(eqMock).toHaveBeenCalledWith("id", "admin-1");
    expect(generateShiftCashReportWorkbookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shift_log: expect.objectContaining({ id: "shift-log-9" }),
      }),
      { preparedByName: "Ella Joy" },
    );
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
});
