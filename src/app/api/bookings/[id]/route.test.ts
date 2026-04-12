import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  syncReceivableForBookingMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  syncReceivableForBookingMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/receivables", () => ({
  syncReceivableForBooking: syncReceivableForBookingMock,
}));

import { PATCH } from "./route";

describe("PATCH /api/bookings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    syncReceivableForBookingMock.mockResolvedValue({ action: "none", receivableId: null, type: null });
  });

  it("recalculates room pricing when an LGU booking is changed to a normal booking", async () => {
    let updatedPayload: Record<string, unknown> | null = null;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    room_id: "room-1",
                    check_in_date: "2026-04-10",
                    check_out_date: "2026-04-11",
                    rate_plan_kind: "24h",
                    is_lgu_booking: true,
                    total_amount: 1800,
                    deposit_paid: 0,
                    balance_due: 1800,
                    restaurant_charges_total: 0,
                    extras_total: 0,
                    extensions_total: 0,
                    early_checkin_fee_applied: 0,
                    late_checkout_fee_applied: 0,
                    discount_value: 0,
                    discount_type: "fixed",
                    discount_amount: 0,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              updatedPayload = payload;
              return {
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: "booking-1",
                        guest_id: "guest-1",
                        balance_due: payload.balance_due,
                        is_lgu_booking: payload.is_lgu_booking,
                        is_special_booking: false,
                        special_booking_label: null,
                        guests: null,
                        rooms: null,
                        restaurant_orders: [],
                      },
                      error: null,
                    })),
                  })),
                })),
              };
            }),
          };
        }

        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    rate_24h_enabled: true,
                    rate_24h_price: 2380,
                    rate_12h_enabled: true,
                    rate_12h_price: 1500,
                    rate_5h_enabled: false,
                    rate_5h_price: null,
                    rate_3h_enabled: false,
                    rate_3h_price: null,
                    lgu_rate_enabled: true,
                    lgu_rate_24h_price: 1800,
                    lgu_rate_12h_price: 1200,
                    lgu_rate_5h_price: null,
                    lgu_rate_3h_price: null,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await PATCH(
      {
        json: async () => ({
          is_lgu_booking: false,
          is_special_booking: false,
          discount_type: "fixed",
          discount_value: 0,
        }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updatedPayload).toMatchObject({
      is_lgu_booking: false,
      total_amount: 2380,
      balance_due: 2380,
      discount_amount: 0,
    });
    expect(syncReceivableForBookingMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        id: "booking-1",
        balance_due: 2380,
        is_lgu_booking: false,
      }),
    );
    expect(body.balance_due).toBe(2380);
  });

  it("rejects direct room changes and requires the transfer flow", async () => {
    let updateCalled = false;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { room_id: "room-1" },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => {
              updateCalled = true;
              return {
                eq: vi.fn(),
              };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await PATCH(
      {
        json: async () => ({
          room_id: "room-2",
        }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: {
        code: "room_transfer_required",
        message: "Changing the assigned room requires the dedicated room transfer flow.",
      },
    });
    expect(updateCalled).toBe(false);
  });
});
