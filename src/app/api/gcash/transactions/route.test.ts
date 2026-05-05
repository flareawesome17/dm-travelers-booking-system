import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  parseAndValidateMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
    checkRateLimit: checkRateLimitMock,
  };
});

import { POST } from "./route";

function createSupabaseMock(result: Record<string, unknown>) {
  const auditInsertMock = vi.fn(async () => ({ error: null }));
  const rpcMock = vi.fn(async () => ({ data: result, error: null }));
  const transaction = {
    id: "entry-1",
    entry_type: "cash_in",
    amount: 500,
    service_charge: 20,
    transaction_reference: "GC-123",
    customer_name: "Juan Dela Cruz",
    recipient_number: "09171234567",
  };

  const supabase = {
    rpc: rpcMock,
    from: vi.fn((table: string) => {
      if (table === "gcash_ledger_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: transaction, error: null })),
            })),
          })),
        };
      }

      if (table === "audit_log") {
        return {
          insert: auditInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { supabase, rpcMock, auditInsertMock };
}

describe("POST /api/gcash/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: 0 });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        transaction_type: "cash_in",
        amount: 500,
        transaction_reference: "GC-123",
        customer_name: "Juan Dela Cruz",
        recipient_number: "09171234567",
        note: "Customer cash-in",
      },
    });
  });

  it("records the wallet outflow through the rpc and writes an audit log", async () => {
    const state = createSupabaseMock({
      ok: true,
      ledger_entry_id: "entry-1",
      service_charge: 20,
      total_collected_from_customer: 520,
      available_gcash_after: 1500,
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(state.rpcMock).toHaveBeenCalledWith("record_gcash_transaction", expect.objectContaining({
      p_entry_type: "cash_in",
      p_amount: 500,
      p_admin_id: "admin-1",
    }));
    expect(state.auditInsertMock).toHaveBeenCalled();
    expect(body.service_charge).toBe(20);
    expect(body.available_gcash_after).toBe(1500);
  });

  it("returns the rpc business error when available GCash is insufficient", async () => {
    const state = createSupabaseMock({
      ok: false,
      error_code: "insufficient_gcash",
      error_message: "GCash transaction exceeds available balance.",
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("insufficient_gcash");
    expect(state.auditInsertMock).not.toHaveBeenCalled();
  });
});
