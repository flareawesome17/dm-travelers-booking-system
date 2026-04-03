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

import { POST } from "./route";

function createSupabaseMock(options?: {
  roomStatus?: string;
  lockedRoom?: Array<Record<string, unknown>>;
}) {
  const roomLockLimitMock = vi.fn(async () => ({
    data: options?.lockedRoom ?? [{ id: "room-1" }],
    error: null,
  }));
  const bookingUpdateSingleMock = vi.fn(async () => ({
    data: {
      id: "booking-1",
      status: "Checked-In",
      actual_check_in_at: "2026-04-01T09:00:00.000Z",
    },
    error: null,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "booking-1",
                  room_id: "room-1",
                  status: "Confirmed",
                  rate_plan_kind: "24h",
                  check_in_date: "2026-04-01",
                  balance_due: 1000,
                  rooms: {
                    status: options?.roomStatus ?? "Available",
                    rate_24h_early_checkin_fee: 200,
                  },
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: bookingUpdateSingleMock,
              })),
            })),
          })),
        };
      }

      if (table === "rooms") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  limit: roomLockLimitMock,
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    bookingUpdateSingleMock,
  };
}

describe("POST /api/bookings/[id]/check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when the caller cannot update bookings", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
  });

  it("rejects check-in when the assigned room is not available", async () => {
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    const supabaseState = createSupabaseMock({ roomStatus: "Dirty" });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      {
        json: async () => ({ actual_check_in_at: "2026-04-01T09:00:00.000Z" }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Room is not ready for check-in. Current status: Dirty.",
    });
  });

  it("applies early check-in fees and transitions the room to occupied for valid check-ins", async () => {
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      {
        json: async () => ({ actual_check_in_at: "2026-04-01T00:00:00.000Z" }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.bookingUpdateSingleMock).toHaveBeenCalledOnce();
    expect(body.id).toBe("booking-1");
    expect(body.status).toBe("Checked-In");
    expect(body.early_checkin_fee_applied).toBeGreaterThan(0);
  });
});
