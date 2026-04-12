import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  parseAndValidateMock,
  syncReceivableForBookingMock,
  broadcastSystemMessageMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  syncReceivableForBookingMock: vi.fn(),
  broadcastSystemMessageMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
  };
});

vi.mock("@/lib/receivables", () => ({
  syncReceivableForBooking: syncReceivableForBookingMock,
}));

vi.mock("@/lib/activity-hub", () => ({
  broadcastSystemMessage: broadcastSystemMessageMock,
}));

import { POST } from "./route";

function createSupabaseMock(options?: {
  bookingStatus?: string;
  targetRoomPricing?: Record<string, unknown>;
  rpcResult?: Record<string, unknown>;
}) {
  const rpcMock = vi.fn(async () => ({
    data: options?.rpcResult ?? {
      ok: true,
      old_room_number: "105",
      new_room_number: "103",
      old_room_id: "room-105",
      new_room_id: "room-103",
      repriced: false,
    },
    error: null,
  }));

  let bookingsSelectCount = 0;

  return {
    supabase: {
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => {
                  bookingsSelectCount += 1;
                  if (bookingsSelectCount === 1) {
                    return {
                      data: {
                        id: "booking-1",
                        reference_number: "REF-ROOM",
                        status: options?.bookingStatus ?? "Checked-In",
                        room_id: "room-105",
                        rate_plan_kind: "24h",
                        check_in_date: "2026-04-12",
                        check_out_date: "2026-04-13",
                        total_amount: 1800,
                        deposit_paid: 500,
                        balance_due: 1300,
                        restaurant_charges_total: 200,
                        extras_total: 100,
                        extensions_total: 0,
                        early_checkin_fee_applied: 0,
                        late_checkout_fee_applied: 0,
                        discount_value: 0,
                        discount_type: "fixed",
                        discount_amount: 0,
                        is_lgu_booking: false,
                        is_special_booking: false,
                        special_booking_label: null,
                      },
                      error: null,
                    };
                  }

                  return {
                    data: {
                      id: "booking-1",
                      reference_number: "REF-ROOM",
                      status: options?.bookingStatus ?? "Checked-In",
                      room_id: "room-103",
                      balance_due: options?.bookingStatus === "Checked-In" ? 1300 : 2180,
                      is_lgu_booking: false,
                      is_special_booking: false,
                      special_booking_label: null,
                      guests: null,
                      rooms: { room_number: "103" },
                      restaurant_orders: [],
                    },
                    error: null,
                  };
                }),
              })),
            })),
          };
        }

        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: options?.targetRoomPricing ?? {
                    rate_24h_enabled: true,
                    rate_24h_price: 2380,
                    rate_12h_enabled: false,
                    rate_12h_price: null,
                    rate_5h_enabled: false,
                    rate_5h_price: null,
                    rate_3h_enabled: false,
                    rate_3h_price: null,
                    lgu_rate_enabled: false,
                    lgu_rate_24h_price: null,
                    lgu_rate_12h_price: null,
                    lgu_rate_5h_price: null,
                    lgu_rate_3h_price: null,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
    rpcMock,
  };
}

describe("POST /api/bookings/[id]/transfer-room", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        target_room_id: "room-103",
      },
    });
    syncReceivableForBookingMock.mockResolvedValue({ action: "none", receivableId: null, type: null });
    broadcastSystemMessageMock.mockResolvedValue(undefined);
  });

  it("preserves pricing for checked-in transfers and calls the transfer rpc", async () => {
    const supabaseState = createSupabaseMock({ bookingStatus: "Checked-In" });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.rpcMock).toHaveBeenCalledWith("transfer_booking_room", expect.objectContaining({
      p_booking_id: "booking-1",
      p_target_room_id: "room-103",
      p_reprice: false,
      p_new_total_amount: null,
      p_new_discount_amount: null,
      p_new_balance_due: null,
    }));
    expect(body.transfer.old_room_number).toBe("105");
  });

  it("reprices pre-arrival transfers against the destination room", async () => {
    const supabaseState = createSupabaseMock({ bookingStatus: "Confirmed" });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.rpcMock).toHaveBeenCalledWith("transfer_booking_room", expect.objectContaining({
      p_reprice: true,
      p_new_total_amount: 2380,
      p_new_discount_amount: 0,
      p_new_balance_due: 2180,
    }));
    expect(body.reference_number).toBe("REF-ROOM");
  });

  it("rejects transfers before the rpc when the target room does not support the booking rate plan", async () => {
    const supabaseState = createSupabaseMock({
      bookingStatus: "Confirmed",
      targetRoomPricing: {
        rate_24h_enabled: false,
        rate_24h_price: null,
        rate_12h_enabled: false,
        rate_12h_price: null,
        rate_5h_enabled: false,
        rate_5h_price: null,
        rate_3h_enabled: false,
        rate_3h_price: null,
        lgu_rate_enabled: false,
        lgu_rate_24h_price: null,
        lgu_rate_12h_price: null,
        lgu_rate_5h_price: null,
        lgu_rate_3h_price: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error: {
        code: "unsupported_rate_plan",
        message: "Target room does not support this booking's current rate plan.",
      },
    });
    expect(supabaseState.rpcMock).not.toHaveBeenCalled();
  });
});
