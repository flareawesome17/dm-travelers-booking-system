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

describe("GET /api/restaurant-categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
  });

  it.each([
    ["unauthenticated", 401],
    ["unauthorized", 403],
  ])("rejects %s requests", async (_label, status) => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: "denied" }, { status }),
    });

    const response = await GET({} as any);

    expect(response.status).toBe(status);
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns only whitelisted category fields for restaurant staff", async () => {
    const selectMock = vi.fn(() => ({
      order: vi.fn(async () => ({
        data: [{ id: "category-1", name: "Main Course", sort_order: 1 }],
        error: null,
      })),
    }));
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ select: selectMock })),
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "restaurant.read");
    expect(selectMock).toHaveBeenCalledWith("id, name, sort_order");
    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "category-1", name: "Main Course", sort_order: 1 }]);
  });
});
