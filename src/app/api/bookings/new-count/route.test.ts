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

function createRequest() {
  return {
    url: "http://localhost/api/bookings/new-count?since=2026-06-01T00:00:00.000Z",
  } as any;
}

describe("GET /api/bookings/new-count", () => {
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

    const response = await GET(createRequest());

    expect(response.status).toBe(status);
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns the count for admins with bookings.read", async () => {
    const gtMock = vi.fn(async () => ({ count: 4, error: null }));
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          gt: gtMock,
        })),
      })),
    });

    const response = await GET(createRequest());
    const body = await response.json();

    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "bookings.read");
    expect(gtMock).toHaveBeenCalledWith("created_at", "2026-06-01T00:00:00.000Z");
    expect(response.status).toBe(200);
    expect(body).toEqual({ count: 4 });
  });
});
