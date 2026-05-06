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

import { PATCH } from "./route";

function createSupabaseMock() {
  const updateMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "type-1",
            code: "laundry",
            name: "Laundry Charge",
            rate_amount: 300,
            unit_label: "load",
            unit_description: "PHP 300 per load up to 5 kilos",
            is_active: true,
            sort_order: 20,
          },
          error: null,
        })),
      })),
    })),
  }));
  const auditInsertMock = vi.fn(async () => ({ error: null }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "other_service_types") {
        return {
          update: updateMock,
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

  return { supabase, updateMock, auditInsertMock };
}

describe("PATCH /api/other-services/types/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        name: "Laundry Charge",
        rate_amount: 300,
        unit_label: "load",
        unit_description: "PHP 300 per load up to 5 kilos",
        is_active: true,
      },
    });
  });

  it("updates a configured service type rate", async () => {
    const state = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await PATCH({} as any, { params: Promise.resolve({ id: "type-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(state.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "Laundry Charge",
      rate_amount: 300,
      unit_label: "load",
      unit_description: "PHP 300 per load up to 5 kilos",
      is_active: true,
    }));
    expect(state.auditInsertMock).toHaveBeenCalled();
    expect(body.service_type.rate_amount).toBe(300);
  });
});
