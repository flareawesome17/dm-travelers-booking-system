import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

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

import { PUT } from "./route";

function createSupabaseMock() {
  const deleteEqMock = vi.fn(async () => ({ error: null }));
  const insertMock = vi.fn(async () => ({ error: null }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table !== "admin_user_permissions") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        delete: vi.fn(() => ({
          eq: deleteEqMock,
        })),
        insert: insertMock,
      };
    }),
  };

  return {
    supabase,
    deleteEqMock,
    insertMock,
  };
}

describe("PUT /api/rbac/users/[id]/permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error for callers without roles.manage", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await PUT(
      {} as any,
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
  });

  it("replaces explicit user permission grants for authorized admins", async () => {
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await PUT(
      {
        json: async () => ({ permission_ids: [10, 11, "skip-me"] }),
      } as any,
      { params: Promise.resolve({ id: "admin-2" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.deleteEqMock).toHaveBeenCalledWith("admin_id", "admin-2");
    expect(supabaseState.insertMock).toHaveBeenCalledWith([
      { admin_id: "admin-2", permission_id: 10 },
      { admin_id: "admin-2", permission_id: 11 },
    ]);
    expect(body).toEqual({
      admin_id: "admin-2",
      permission_ids: [10, 11],
    });
  });
});
