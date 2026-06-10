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
    url: "http://localhost/api/admin/messages?mode=broadcast&limit=100",
  } as any;
}

describe("GET /api/admin/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1", role_id: 5 },
    });
  });

  it.each([
    ["anonymous", 401],
    ["staff without permission", 403],
  ])("rejects %s access", async (_label, status) => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: "denied" }, { status }),
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(status);
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("keeps authorized admin and staff reads working through the API", async () => {
    const messages = [{
      id: "message-1",
      content: "Internal update",
      recipient_id: null,
      created_at: "2026-06-10T00:00:00.000Z",
    }];
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: messages, error: null })),
            })),
          })),
        })),
      })),
    });

    const response = await GET(createRequest());
    const body = await response.json();

    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "activity_hub.read");
    expect(response.status).toBe(200);
    expect(body).toEqual({ messages, hasMore: false });
  });
});
