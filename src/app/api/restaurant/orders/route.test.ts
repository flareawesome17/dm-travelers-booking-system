import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  manilaDateStringMock,
  findNextOpenLedgerDateMock,
  addShiftTransactionMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  manilaDateStringMock: vi.fn(),
  findNextOpenLedgerDateMock: vi.fn(),
  addShiftTransactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/ledgerDate", () => ({
  manilaDateString: manilaDateStringMock,
  findNextOpenLedgerDate: findNextOpenLedgerDateMock,
}));

vi.mock("@/lib/shiftUtils", () => ({
  addShiftTransaction: addShiftTransactionMock,
}));

import { POST } from "./route";

describe("POST /api/restaurant/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    manilaDateStringMock.mockResolvedValue("2026-04-11");
    findNextOpenLedgerDateMock.mockResolvedValue("2026-04-11");
  });

  it("snapshots minimart flags on restaurant order lines", async () => {
    let insertedLines: Record<string, unknown>[] = [];

    const menuItems = [
      { id: "menu-1", name: "Cup Noodles", category: "Snacks", price: 45, staff_price: 35, is_minimart: true, lgu_markup_percentage: 0 },
      { id: "menu-2", name: "Fried Chicken", category: "Main Course", price: 120, staff_price: 100, is_minimart: false, lgu_markup_percentage: 0 },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "restaurant_menu") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: menuItems,
                error: null,
              })),
            })),
          };
        }

        if (table === "menu_item_ingredients") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [],
                error: null,
              })),
            })),
          };
        }

        if (table === "discounts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      order: vi.fn(async () => ({
                        data: [],
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "restaurant_orders") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "order-1",
                    status: "Pending",
                    total_amount: 210,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "restaurant_order_items") {
          return {
            insert: vi.fn(async (rows: Record<string, unknown>[]) => {
              insertedLines = rows;
              return { error: null };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await POST({
      json: async () => ({
        order_source: "Restaurant",
        customer_name: "Walk-in Guest",
        payment_method: "Pending Payment",
        notes: null,
        items: [
          { menu_item_id: "menu-1", quantity: 2 },
          { menu_item_id: "menu-2", quantity: 1 },
        ],
      }),
    } as any);

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(insertedLines).toEqual([
      expect.objectContaining({
        order_id: "order-1",
        menu_item_id: "menu-1",
        is_minimart: true,
        line_total: 90,
      }),
      expect.objectContaining({
        order_id: "order-1",
        menu_item_id: "menu-2",
        is_minimart: false,
        line_total: 120,
      }),
    ]);
    expect(addShiftTransactionMock).not.toHaveBeenCalled();
    expect(body.id).toBe("order-1");
  });

  it("applies configured staff prices when the order is flagged for staff pricing", async () => {
    let insertedLines: Record<string, unknown>[] = [];
    let insertedOrder: Record<string, unknown> | null = null;

    const menuItems = [
      { id: "menu-1", name: "Cup Noodles", category: "Snacks", price: 45, staff_price: 35, is_minimart: true, lgu_markup_percentage: 0 },
      { id: "menu-2", name: "Fried Chicken", category: "Main Course", price: 120, staff_price: 100, is_minimart: false, lgu_markup_percentage: 10 },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "restaurant_menu") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: menuItems,
                error: null,
              })),
            })),
          };
        }

        if (table === "menu_item_ingredients") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [],
                error: null,
              })),
            })),
          };
        }

        if (table === "discounts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      order: vi.fn(async () => ({
                        data: [],
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "restaurant_orders") {
          return {
            insert: vi.fn((payload: Record<string, unknown>) => {
              insertedOrder = payload;
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "order-2",
                      status: "Pending",
                      total_amount: 170,
                    },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        if (table === "restaurant_order_items") {
          return {
            insert: vi.fn(async (rows: Record<string, unknown>[]) => {
              insertedLines = rows;
              return { error: null };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await POST({
      json: async () => ({
        order_source: "Restaurant",
        customer_name: "Staff Member",
        payment_method: "Pending Payment",
        is_staff_order: true,
        items: [
          { menu_item_id: "menu-1", quantity: 2 },
          { menu_item_id: "menu-2", quantity: 1 },
        ],
      }),
    } as any);

    expect(response.status).toBe(201);
    expect(insertedOrder).toMatchObject({
      is_staff_order: true,
    });
    expect(insertedLines).toEqual([
      expect.objectContaining({
        menu_item_id: "menu-1",
        unit_price: 35,
        line_total: 70,
      }),
      expect.objectContaining({
        menu_item_id: "menu-2",
        unit_price: 100,
        line_total: 100,
      }),
    ]);
  });

  it("rejects staff-priced orders when a selected item has no configured staff price", async () => {
    const menuItems = [
      { id: "menu-1", name: "Cup Noodles", category: "Snacks", price: 45, staff_price: null, is_minimart: true, lgu_markup_percentage: 0 },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "restaurant_menu") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: menuItems,
                error: null,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await POST({
      json: async () => ({
        order_source: "Restaurant",
        customer_name: "Staff Member",
        payment_method: "Pending Payment",
        is_staff_order: true,
        items: [
          { menu_item_id: "menu-1", quantity: 1 },
        ],
      }),
    } as any);

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Staff price is not configured");
  });
});
