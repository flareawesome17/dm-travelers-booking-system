import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { addShiftTransaction } from "./shiftUtils";

describe("addShiftTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries without performed_by when the schema cache does not know that column", async () => {
    const insertCalls: Array<Record<string, unknown>> = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "shifts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [
                    {
                      id: "shift-1",
                      name: "All Day",
                      start_time: "00:00:00",
                      end_time: "23:59:00",
                      sort_order: 1,
                      is_active: true,
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "shift_logs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "shift-log-1",
                      status: "OPEN",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "shift_transactions") {
          return {
            insert: vi.fn((payload: Record<string, unknown>) => {
              insertCalls.push(payload);

              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    if ("performed_by" in payload) {
                      return {
                        data: null,
                        error: {
                          code: "PGRST204",
                          message: "Could not find the 'performed_by' column of 'shift_transactions' in the schema cache",
                        },
                      };
                    }

                    return {
                      data: {
                        id: "shift-tx-1",
                        ...payload,
                      },
                      error: null,
                    };
                  }),
                })),
              };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    getSupabaseAdminMock.mockReturnValue(supabase);

    const result = await addShiftTransaction({
      source: "expense",
      referenceId: "expense-1",
      description: "Expense: Supplies Pantry Supplies",
      amount: 500,
      type: "EXPENSE",
      category: "Supplies",
      performedBy: "admin-1",
      onFailure: "throw",
    });

    expect(insertCalls).toEqual([
      {
        shift_log_id: "shift-log-1",
        source: "expense",
        reference_id: "expense-1",
        description: "Expense: Supplies Pantry Supplies",
        amount: 500,
        type: "EXPENSE",
        category: "Supplies",
        performed_by: "admin-1",
      },
      {
        shift_log_id: "shift-log-1",
        source: "expense",
        reference_id: "expense-1",
        description: "Expense: Supplies Pantry Supplies",
        amount: 500,
        type: "EXPENSE",
        category: "Supplies",
      },
    ]);

    expect(result).toMatchObject({
      id: "shift-tx-1",
      source: "expense",
      reference_id: "expense-1",
    });
  });
});
