import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock, verifyAdminTokenMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  verifyAdminTokenMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminToken: verifyAdminTokenMock,
}));

import { getCurrentAdminPermissions, requirePermission } from "./rbac";

function createActiveAdminQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { is_active: true },
          error: null,
        })),
      })),
    })),
  };
}

describe("rbac helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows active super admins without loading permission tables", async () => {
    verifyAdminTokenMock.mockReturnValue({
      payload: { sub: "admin-1", role_id: 1 },
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "admin_users") return createActiveAdminQuery();
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await requirePermission({} as any, "roles.manage");

    expect("payload" in result).toBe(true);
    expect(getSupabaseAdminMock).toHaveBeenCalledOnce();
  });

  it("returns forbidden when the required permission is absent", async () => {
    verifyAdminTokenMock.mockReturnValue({
      payload: { sub: "admin-2", role_id: 3 },
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "admin_users") return createActiveAdminQuery();
        if (table === "role_permissions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }

        if (table === "admin_user_permissions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await requirePermission({} as any, "users.manage");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it("merges role and user permissions before authorizing access", async () => {
    verifyAdminTokenMock.mockReturnValue({
      payload: { sub: "admin-3", role_id: 2 },
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "admin_users") return createActiveAdminQuery();
        if (table === "role_permissions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ permissions: { name: "bookings.read" } }],
                error: null,
              })),
            })),
          };
        }

        if (table === "admin_user_permissions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ permissions: { name: "users.manage" } }],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await requirePermission({} as any, "users.manage");

    expect("payload" in result).toBe(true);
  });

  it("returns the full permission list for super admins", async () => {
    verifyAdminTokenMock.mockReturnValue({
      payload: { sub: "admin-4", role_id: 1 },
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "admin_users") return createActiveAdminQuery();
        if (table === "permissions") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [{ name: "bookings.read" }, { name: "roles.manage" }],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await getCurrentAdminPermissions({} as any);

    expect("permissions" in result).toBe(true);
    if ("permissions" in result) {
      expect(result.permissions).toEqual(["bookings.read", "roles.manage"]);
    }
  });
});
