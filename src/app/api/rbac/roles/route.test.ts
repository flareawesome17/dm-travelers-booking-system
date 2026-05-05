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

import { GET } from "./route";

function createSupabaseMock() {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "roles") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                { id: 2, name: "Manager", description: "Ops" },
                { id: 3, name: "Staff", description: "Front desk" },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "permissions") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                { id: 10, name: "roles.manage" },
                { id: 50, name: "gcash.read" },
                { id: 51, name: "gcash.transact" },
                { id: 52, name: "gcash.adjust" },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "role_permissions") {
        return {
          select: vi.fn(async () => ({
            data: [
              { role_id: 2, permission_id: 50 },
              { role_id: 2, permission_id: 51 },
              { role_id: 2, permission_id: 52 },
              { role_id: 3, permission_id: 50 },
              { role_id: 3, permission_id: 51 },
            ],
            error: null,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase };
}

describe("GET /api/rbac/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when a non-authorized role hits the route", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
  });

  it("returns role and permission state for authorized administrators", async () => {
    const supabaseState = createSupabaseMock();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      roles: [
        { id: 2, name: "Manager", description: "Ops" },
        { id: 3, name: "Staff", description: "Front desk" },
      ],
      permissions: [
        { id: 10, name: "roles.manage" },
        { id: 50, name: "gcash.read" },
        { id: 51, name: "gcash.transact" },
        { id: 52, name: "gcash.adjust" },
      ],
      role_permissions: [
        { role_id: 2, permission_id: 50 },
        { role_id: 2, permission_id: 51 },
        { role_id: 2, permission_id: 52 },
        { role_id: 3, permission_id: 50 },
        { role_id: 3, permission_id: 51 },
      ],
    });
  });
});
