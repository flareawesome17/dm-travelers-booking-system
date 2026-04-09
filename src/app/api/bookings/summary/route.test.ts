import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  manilaDateStringMock,
  getGlobalTimeConfigMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  manilaDateStringMock: vi.fn(),
  getGlobalTimeConfigMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/ledgerDate", () => ({
  manilaDateString: manilaDateStringMock,
}));

vi.mock("@/lib/settings", () => ({
  getGlobalTimeConfig: getGlobalTimeConfigMock,
}));

import { GET } from "./route";

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn(async () => ({
            data: [
              {
                status: "Checked-In",
                actual_check_in_at: "2026-04-08T16:30:00.000Z",
                is_lgu_booking: true,
                is_special_booking: false,
              },
              {
                status: "Checked-Out",
                actual_check_out_at: "2026-04-09T01:00:00.000Z",
                is_lgu_booking: false,
                is_special_booking: true,
              },
              {
                status: "Pending Payment",
                is_lgu_booking: false,
                is_special_booking: false,
              },
            ],
            error: null,
          })),
        };
      }

      if (table === "rooms") {
        return {
          select: vi.fn(async () => ({
            data: [
              { status: "Occupied", is_active: true },
              { status: "Available", is_active: true },
              { status: "Maintenance", is_active: true },
            ],
            error: null,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("GET /api/bookings/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    manilaDateStringMock.mockResolvedValue("2026-04-09");
    getGlobalTimeConfigMock.mockResolvedValue({ timezone: "Asia/Manila", offset: "+08:00" });
  });

  it("returns the permission error before querying data", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns the computed booking analytics summary", async () => {
    getSupabaseAdminMock.mockReturnValue(createSupabaseMock());

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      today: "2026-04-09",
      timezone: "Asia/Manila",
      checkedInToday: 1,
      checkedOutToday: 1,
      totalBookings: 3,
      lguBookings: 1,
      specialBookings: 1,
      pendingPayment: 1,
      occupiedRooms: 1,
      activeRooms: 3,
      roomsExcludedFromOccupancy: 1,
      availableRoomsToday: 1,
      occupancyPercent: 50,
    });
  });
});
