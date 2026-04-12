import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  generateShiftAccountsReceivableWorkbookMock,
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
    generateShiftAccountsReceivableWorkbookMock: vi.fn(),
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

vi.mock("@/lib/accountsReceivableReports", () => ({
  generateShiftAccountsReceivableWorkbook: generateShiftAccountsReceivableWorkbookMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { GET } from "./route";

describe("GET /api/reports/shifts/[id]/accounts-receivable/[bookingId]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: { name: "Ella Joy", email: "ella@example.com" }, error: null });
    generateShiftAccountsReceivableWorkbookMock.mockResolvedValue({
      buffer: Buffer.from("xlsx"),
      fileName: "accounts-receivable-2026-04-12-room-105-ref-1001.xlsx",
    });
  });

  it("returns the permission error when reports.shift_cash.export is missing", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET(
      {} as any,
      { params: Promise.resolve({ id: "shift-log-1", bookingId: "booking-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(generateShiftAccountsReceivableWorkbookMock).not.toHaveBeenCalled();
  });

  it("passes the current admin name into the accounts receivable workbook generator", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });

    const response = await GET(
      {} as any,
      { params: Promise.resolve({ id: "shift-log-9", bookingId: "booking-7" }) },
    );

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("admin_users");
    expect(eqMock).toHaveBeenCalledWith("id", "admin-1");
    expect(generateShiftAccountsReceivableWorkbookMock).toHaveBeenCalledWith({
      reportId: "shift-log-9",
      bookingId: "booking-7",
      preparedByName: "Ella Joy",
    });
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="accounts-receivable-2026-04-12-room-105-ref-1001.xlsx"',
    );
  });
});
