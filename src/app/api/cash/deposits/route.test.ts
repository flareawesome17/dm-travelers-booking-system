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
  const bankAccount = {
    id: "bank-1",
    label: "Main BDO",
    bank_name: "BDO",
    account_name: "",
    account_number_masked: "",
    branch_label: null,
    is_active: true,
  };
  const deposit = {
    id: "deposit-1",
    amount: 350,
    deposit_reference: "DEP-350",
    deposited_at: "2026-04-13T01:00:00.000Z",
    bank_account_label: "Main BDO",
    bank_name: "BDO",
    account_number_masked: "",
  };

  const supabase = {
    rpc: rpcMock,
    from: vi.fn((table: string) => {
      if (table === "cash_bank_accounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: bankAccount, error: null })),
            })),
          })),
        };
      }

      if (table === "cash_deposit_requests") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: deposit, error: null })),
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

describe("POST /api/cash/deposits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: 0 });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        amount: 350,
        bank_account_id: "bank-1",
        deposit_reference: "DEP-350",
        deposited_at: "2026-04-13T01:00:00.000Z",
        proof: {
          bucket: "cash-deposit-proofs",
          path: "proofs/deposit-350.pdf",
          filename: "deposit-350.pdf",
          content_type: "application/pdf",
          size: 2048,
        },
        note: "Direct recording",
      },
    });
  });

  it("records the deposit immediately through the rpc and writes an audit log", async () => {
    const state = createSupabaseMock({
      ok: true,
      deposit_id: "deposit-1",
      ledger_entry_id: "entry-1",
      available_cash_after: 1550,
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(state.rpcMock).toHaveBeenCalledWith("record_cash_deposit_request", expect.objectContaining({
      p_amount: 350,
      p_bank_account_id: "bank-1",
      p_deposit_reference: "DEP-350",
      p_admin_id: "admin-1",
    }));
    expect(state.auditInsertMock).toHaveBeenCalled();
    expect(body.available_cash_after).toBe(1550);
  });

  it("returns the rpc business error when the deposit exceeds available cash", async () => {
    const state = createSupabaseMock({
      ok: false,
      error_code: "insufficient_cash",
      error_message: "Recorded deposit exceeds available cash.",
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("insufficient_cash");
    expect(state.auditInsertMock).not.toHaveBeenCalled();
  });
});
