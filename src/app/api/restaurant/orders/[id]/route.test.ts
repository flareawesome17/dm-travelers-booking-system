import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  addShiftTransactionMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  addShiftTransactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/shiftUtils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shiftUtils")>("@/lib/shiftUtils");
  return {
    ...actual,
    addShiftTransaction: addShiftTransactionMock,
  };
});

import { PATCH } from "./route";

describe("PATCH /api/restaurant/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
  });

  it("rejects GCash payments without a reference number", async () => {
    const response = await PATCH(
      {
        json: async () => ({
          status: "Paid",
          payment_method: "GCash",
        }),
      } as any,
      { params: Promise.resolve({ id: "order-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error?.message).toContain("Reference number is required");
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("stores a trimmed payment reference for card payments", async () => {
    let updatedPayload: Record<string, unknown> | null = null;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "restaurant_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "order-1",
                    status: "Served",
                    total_amount: 60,
                    customer_name: "Walk-in Guest",
                    payment_method: "Cash",
                    created_at: "2026-04-11T06:00:00.000Z",
                    accounting_date: "2026-04-11",
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
                        id: "order-1",
                        status: "Paid",
                        total_amount: 60,
                        customer_name: "Walk-in Guest",
                        payment_method: "Card",
                        payment_reference: "CARD-7788",
                      },
                      error: null,
                    })),
                  })),
                })),
              };
            }),
          };
        }

        if (table === "daily_ledgers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { status: "open" },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "shift_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({
                  data: [],
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
          status: "Paid",
          payment_method: "Card",
          payment_reference: "  CARD-7788  ",
        }),
      } as any,
      { params: Promise.resolve({ id: "order-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updatedPayload).toMatchObject({
      status: "Paid",
      payment_method: "Card",
      payment_reference: "CARD-7788",
    });
    expect(addShiftTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "restaurant",
        referenceId: "order-1",
        type: "INCOME",
      }),
    );
    expect(body.payment_reference).toBe("CARD-7788");
  });
});
