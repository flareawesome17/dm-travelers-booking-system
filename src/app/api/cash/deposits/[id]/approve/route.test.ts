import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  parseAndValidateMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
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
  };
});

import { POST } from "./route";

function createSupabaseMock(result: Record<string, unknown>) {
  const insertMock = vi.fn(async () => ({ error: null }));
  const rpcMock = vi.fn(async () => ({ data: result, error: null }));

  return {
    supabase: {
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === "audit_log") {
          return { insert: insertMock };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    },
    rpcMock,
    insertMock,
  };
}

describe("POST /api/cash/deposits/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-2" } });
    parseAndValidateMock.mockResolvedValue({ success: true, data: { approval_note: "Checked against bank slip" } });
  });

  it("approves the request through the rpc and writes an audit log", async () => {
    const state = createSupabaseMock({
      ok: true,
      ledger_entry_id: "entry-1",
      available_cash_after: 1550,
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any, { params: Promise.resolve({ id: "deposit-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(state.rpcMock).toHaveBeenCalledWith("approve_cash_deposit_request", {
      p_request_id: "deposit-1",
      p_admin_id: "admin-2",
      p_approval_note: "Checked against bank slip",
    });
    expect(state.insertMock).toHaveBeenCalled();
    expect(body.available_cash_after).toBe(1550);
  });

  it("returns the rpc business error when the requester tries to self-approve", async () => {
    const state = createSupabaseMock({
      ok: false,
      error_code: "approval_conflict",
      error_message: "A different authorized admin must approve this deposit.",
    });
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any, { params: Promise.resolve({ id: "deposit-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("approval_conflict");
    expect(state.insertMock).not.toHaveBeenCalled();
  });
});
