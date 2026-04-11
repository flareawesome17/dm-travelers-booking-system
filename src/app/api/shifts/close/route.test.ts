import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  getOrCreateActiveShiftLogMock,
  finalizeShiftCashReportMock,
  broadcastSystemMessageMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  getOrCreateActiveShiftLogMock: vi.fn(),
  finalizeShiftCashReportMock: vi.fn(),
  broadcastSystemMessageMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/shiftUtils", () => ({
  getOrCreateActiveShiftLog: getOrCreateActiveShiftLogMock,
}));

vi.mock("@/lib/shiftCashReports", () => ({
  finalizeShiftCashReport: finalizeShiftCashReportMock,
}));

vi.mock("@/lib/activity-hub", () => ({
  broadcastSystemMessage: broadcastSystemMessageMock,
}));

import { POST } from "./route";

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "shift_transactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                { type: "INCOME", amount: 1000 },
                { type: "EXPENSE", amount: 200 },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "shift_logs") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: "shift-log-1", status: "CLOSED" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "audit_log") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("POST /api/shifts/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    getOrCreateActiveShiftLogMock.mockResolvedValue({
      shift: { id: "shift-1", name: "Morning" },
      shiftLog: { id: "shift-log-1", date: "2026-04-10", status: "OPEN" },
    });
    getSupabaseAdminMock.mockReturnValue(createSupabaseMock());
    finalizeShiftCashReportMock.mockResolvedValue({ report_id: "report-1" });
    broadcastSystemMessageMock.mockResolvedValue(undefined);
  });

  it("closes the shift and finalizes the report snapshot", async () => {
    const response = await POST({
      json: async () => ({ close_notes: "Done" }),
    } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({
      total_income: 1000,
      total_expense: 200,
      net_total: 800,
    });
    expect(body.report_warning).toBeNull();
    expect(finalizeShiftCashReportMock).toHaveBeenCalledWith(
      "shift-log-1",
      expect.objectContaining({ supabase: expect.any(Object) }),
    );
  });

  it("keeps the shift closure successful even when snapshot finalization fails", async () => {
    finalizeShiftCashReportMock.mockRejectedValue(new Error("snapshot failed"));

    const response = await POST({
      json: async () => ({ close_notes: "Done" }),
    } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report_warning).toContain("cash report snapshot");
  });

  it("returns the permission error when shifts.close is missing", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });
});
