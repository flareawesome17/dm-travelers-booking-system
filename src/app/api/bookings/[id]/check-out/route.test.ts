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
  bookingUpdateError?: { message: string } | null;
  roomUpdateError?: { message: string } | null;
  lateCheckoutFeeRate?: number;
}) {
  const roomUpdateMock = vi.fn(() => ({
    eq: vi.fn(async () => ({
      error: options?.roomUpdateError ?? null,
    })),
  }));

  const bookingRollbackEqMock = vi.fn(async () => ({ error: null }));

  const bookingSelectSingleMock = vi.fn(async () => ({
    data: {
      id: "booking-1",
      room_id: "room-1",
      status: "Checked-In",
      actual_check_out_at: null,
      late_checkout_fee_applied: 0,
      balance_due: 200,
      rate_plan_kind: "24h",
      check_out_date: "2026-03-31",
      rooms: {
        rate_24h_late_checkout_fee: options?.lateCheckoutFeeRate ?? 0,
      },
    },
    error: null,
  }));

  const bookingUpdateSingleMock = vi.fn(async () => ({
    data: options?.bookingUpdateError
      ? null
      : {
          id: "booking-1",
          status: "Checked-Out",
          actual_check_out_at: "2026-03-31T12:15:00.000Z",
        },
    error: options?.bookingUpdateError ?? null,
  }));

  const bookingUpdateSelectMock = vi.fn(() => ({
    single: bookingUpdateSingleMock,
  }));

  const bookingUpdateEqMock = vi.fn(() => ({
    select: bookingUpdateSelectMock,
  }));

  const bookingUpdateMock = vi
    .fn()
    .mockImplementationOnce(() => ({
      eq: bookingUpdateEqMock,
    }))
    .mockImplementationOnce(() => ({
      eq: bookingRollbackEqMock,
    }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: bookingSelectSingleMock,
            })),
          })),
          update: bookingUpdateMock,
        };
      }

      if (table === "rooms") {
        return {
          update: roomUpdateMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    roomUpdateMock,
    bookingRollbackEqMock,
    bookingUpdateMock,
  };
}

describe("POST /api/bookings/[id]/check-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
  });

  it("does not dirty the room when the booking update fails", async () => {
    const supabaseState = createSupabaseMock({
      bookingUpdateError: { message: "booking update failed" },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      {
        json: async () => ({ actual_check_out_at: "2026-03-31T12:15:00.000Z" }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "booking update failed" });
    expect(supabaseState.roomUpdateMock).not.toHaveBeenCalled();
  });

  it("rolls the booking back when dirtying the room fails", async () => {
    const supabaseState = createSupabaseMock({
      roomUpdateError: { message: "room update failed" },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      {
        json: async () => ({ actual_check_out_at: "2026-03-31T12:15:00.000Z" }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to update room status. Check-out has been reverted." });
    expect(supabaseState.roomUpdateMock).toHaveBeenCalledOnce();
    expect(supabaseState.bookingUpdateMock).toHaveBeenCalledTimes(2);
    expect(supabaseState.bookingRollbackEqMock).toHaveBeenCalledWith("id", "booking-1");
  });

  it("returns the permission error when the caller cannot update bookings", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("applies late checkout fees after the grace period and dirties the room on success", async () => {
    const supabaseState = createSupabaseMock({
      lateCheckoutFeeRate: 200,
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      {
        json: async () => ({ actual_check_out_at: "2026-03-31T13:31:00.000Z" }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.roomUpdateMock).toHaveBeenCalledOnce();
    expect(body.id).toBe("booking-1");
    expect(body.status).toBe("Checked-Out");
    expect(body.late_checkout_fee_applied).toBeGreaterThan(0);
  });
});
