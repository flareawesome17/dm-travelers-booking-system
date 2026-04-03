import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { verifyAdminTokenMock, createAdminSessionSnapshotMock } = vi.hoisted(() => ({
  verifyAdminTokenMock: vi.fn(),
  createAdminSessionSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAdminToken: verifyAdminTokenMock,
}));

vi.mock("@/lib/admin-session", () => ({
  createAdminSessionSnapshot: createAdminSessionSnapshotMock,
}));

import { GET } from "./route";

describe("GET /api/admin/session", () => {
  it("returns the auth error response when no admin session is present", async () => {
    verifyAdminTokenMock.mockReturnValue({
      error: NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 }),
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: { code: "unauthorized" } });
  });

  it("returns the current session snapshot with no-store caching", async () => {
    verifyAdminTokenMock.mockReturnValue({
      payload: {
        sub: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
      },
    });
    createAdminSessionSnapshotMock.mockReturnValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        role_label: "Manager",
      },
      expires_at: "2026-04-01T00:00:00.000Z",
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        role_label: "Manager",
      },
      expires_at: "2026-04-01T00:00:00.000Z",
    });
  });
});
