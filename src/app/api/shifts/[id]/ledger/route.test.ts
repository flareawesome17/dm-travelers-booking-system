import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

const { requirePermissionMock, getSupabaseAdminMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { GET } from "./route";

function makeRequest() {
  return {} as unknown as NextRequest;
}

function createSupabaseMock(options?: {
  shiftLog?: Record<string, unknown> | null;
  shiftLogError?: { message: string } | null;
  transactions?: Array<Record<string, unknown>>;
  transactionsError?: { message: string } | null;
}) {
  const shiftLogData = options?.shiftLog !== undefined
    ? options.shiftLog
    : {
        id: "log-1",
        date: "2026-03-30",
        status: "CLOSED",
        opened_by: "admin-1",
        closed_by: "admin-1",
        closed_at: "2026-03-30T22:00:00Z",
        close_notes: "Normal close",
        total_income: 3000,
        total_expense: 500,
        net_total: 2500,
        shifts: { id: "shift-1", name: "Morning", start_time: "06:00", end_time: "14:00" },
      };

  const transactions = options?.transactions ?? [
    { id: "tx-1", source: "booking", reference_id: "booking-1", description: "Room payment", amount: 3000, type: "INCOME", category: null, performed_by: "admin-1", created_at: "2026-03-30T10:00:00Z" },
    { id: "tx-2", source: "expense", reference_id: null, description: "Supplies", amount: 500, type: "EXPENSE", category: "supplies", performed_by: "admin-1", created_at: "2026-03-30T11:00:00Z" },
  ];

  const orderMock = vi.fn(async () => ({
    data: transactions,
    error: options?.transactionsError ?? null,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "shift_logs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: shiftLogData,
                error: options?.shiftLogError ?? null,
              })),
            })),
          })),
        };
      }

      if (table === "shift_transactions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: orderMock,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, orderMock };
}

describe("GET /api/shifts/[id]/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when the caller lacks shifts.read", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET(makeRequest(), { params: { id: "log-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the shift log does not exist", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({ shiftLog: null });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest(), { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Shift log not found");
  });

  it("returns 400 when the shift is still open", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({
      shiftLog: { id: "log-open", status: "OPEN", net_total: 0 },
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest(), { params: { id: "log-open" } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/still open/i);
  });

  it("returns full ledger with recomputed summary for a closed shift", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest(), { params: { id: "log-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.shift_log.id).toBe("log-1");
    expect(body.transactions).toHaveLength(2);
    expect(body.income_transactions).toHaveLength(1);
    expect(body.expense_transactions).toHaveLength(1);
    expect(body.summary.total_income).toBe(3000);
    expect(body.summary.total_expense).toBe(500);
    expect(body.summary.net_total).toBe(2500);
    expect(body.summary.transaction_count).toBe(2);
    expect(body.readonly).toBe(true);
  });

  it("flags a discrepancy when computed net differs from stored net by more than 0.01", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({
      shiftLog: {
        id: "log-disc",
        status: "CLOSED",
        net_total: 9999, // wrong stored value
        shifts: null,
      },
      transactions: [
        { id: "tx-1", amount: 3000, type: "INCOME", source: "booking" },
        { id: "tx-2", amount: 500, type: "EXPENSE", source: "expense" },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest(), { params: { id: "log-disc" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.has_discrepancy).toBe(true);
    expect(body.summary.stored_net_total).toBe(9999);
    expect(body.summary.net_total).toBe(2500);
  });

  it("returns 500 when the database query fails", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({ shiftLogError: { message: "db failure" } });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest(), { params: { id: "log-1" } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db failure");
  });
});
