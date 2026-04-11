import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
} = vi.hoisted(() => ({
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

describe("POST /api/bookings/[id]/extras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
  });

  it("rejects custom charges without a label", async () => {
    const response = await POST(
      {
        json: async () => ({
          extras: [
            {
              extra_type: "Custom Charge",
              quantity: 1,
              unit_price: 250,
            },
          ],
        }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error?.details?.[0]?.field).toBe("extras.0.custom_label");
  });

  it("stores custom charge labels and updates booking totals", async () => {
    let insertedRows: Record<string, unknown>[] = [];
    let bookingUpdatePayload: Record<string, unknown> | null = null;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "booking-1",
                    extras_total: 100,
                    balance_due: 400,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              bookingUpdatePayload = payload;
              return {
                eq: vi.fn(async () => ({ error: null })),
              };
            }),
          };
        }

        if (table === "booking_extras") {
          return {
            insert: vi.fn((rows: Record<string, unknown>[]) => {
              insertedRows = rows;
              return {
                select: vi.fn(async () => ({
                  data: rows.map((row, index) => ({
                    id: `extra-${index + 1}`,
                    ...row,
                  })),
                  error: null,
                })),
              };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await POST(
      {
        json: async () => ({
          extras: [
            {
              extra_type: "Custom Charge",
              custom_label: "Broken glass",
              quantity: 2,
              unit_price: 75,
            },
          ],
        }),
      } as any,
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(insertedRows).toEqual([
      expect.objectContaining({
        booking_id: "booking-1",
        extra_type: "Custom Charge",
        custom_label: "Broken glass",
        quantity: 2,
        unit_price: 75,
        total_price: 150,
      }),
    ]);
    expect(bookingUpdatePayload).toMatchObject({
      extras_total: 250,
      balance_due: 550,
    });
    expect(body[0]).toMatchObject({
      extra_type: "Custom Charge",
      custom_label: "Broken glass",
      total_price: 150,
    });
  });
});
