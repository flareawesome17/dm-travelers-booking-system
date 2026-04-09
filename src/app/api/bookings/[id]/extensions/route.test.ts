import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  parseAndValidateMock,
  getGlobalTimeConfigMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  getGlobalTimeConfigMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/settings", () => ({
  getGlobalTimeConfig: getGlobalTimeConfigMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
  };
});

import { GET, POST } from "./route";

function createSupabaseMock() {
  const bookingUpdateEqMock = vi.fn(async () => ({ error: null }));

  return {
    from: vi.fn((table: string) => {
      if (table === "settings") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { key: "check_in_time", value: "14:00" },
                { key: "check_out_time", value: "12:00" },
              ],
              error: null,
            })),
          })),
        };
      }

      if (table === "bookings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string) => {
              if (column === "id") {
                return {
                  single: vi.fn(async () => ({
                    data: {
                      id: "booking-1",
                      status: "Checked-In",
                      room_id: "room-207",
                      check_out_date: "2026-04-09",
                      reserved_checkout_datetime: null,
                      actual_check_in_at: "2026-04-08T06:00:00.000Z",
                      rate_plan_kind: "24h",
                      extensions_total: 0,
                      balance_due: 0,
                    },
                    error: null,
                  })),
                };
              }

              if (column === "room_id") {
                return {
                  neq: vi.fn(() => ({
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: "booking-2",
                          room_id: "room-207",
                          reference_number: "REF-207",
                          status: "Pending Payment",
                          check_in_date: "2026-04-11",
                          check_out_date: "2026-04-12",
                          reserved_checkin_datetime: null,
                          reserved_checkout_datetime: null,
                          actual_check_in_at: null,
                          rate_plan_kind: "24h",
                          verification_code_expires_at: null,
                        },
                      ],
                      error: null,
                    })),
                  })),
                };
              }

              throw new Error(`Unexpected eq column ${column}`);
            }),
          })),
          update: vi.fn(() => ({
            eq: bookingUpdateEqMock,
          })),
        };
      }

      if (table === "booking_extensions") {
        return {
          select: vi.fn(async () => ({ data: [], error: null })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "extension-1" },
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    bookingUpdateEqMock,
  };
}

describe("booking extensions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        duration_type: "days",
        duration_value: 5,
        additional_cost: 11900,
        new_checkout_date: "2026-04-14T12:00:00.000Z",
      },
    });
    getGlobalTimeConfigMock.mockResolvedValue({ timezone: "Asia/Manila", offset: "+08:00" });
  });

  it("returns conflict details for check_only when a future reservation blocks the extension", async () => {
    getSupabaseAdminMock.mockReturnValue(createSupabaseMock());

    const response = await GET({
      url: "http://localhost/api/bookings/booking-1/extensions?check_only=true&new_checkout=2026-04-14T12:00:00.000Z",
    } as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      available: false,
      conflict_count: 1,
      conflict_booking_id: "booking-2",
      conflict_reference: "REF-207",
    });
  });

  it("rejects POST with the same room conflict decision used by check_only", async () => {
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState);

    const response = await POST({} as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error: {
        code: "room_conflict",
        message: "Room is already reserved for a future guest during this extension period.",
      },
    });
    expect(supabaseState.bookingUpdateEqMock).not.toHaveBeenCalled();
  });

  it("returns the permission error before loading extension data", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET({ url: "http://localhost" } as any, { params: Promise.resolve({ id: "booking-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
  });
});
