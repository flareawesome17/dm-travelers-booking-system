import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock, getGlobalTimeConfigMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  getGlobalTimeConfigMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("./settings", () => ({
  getGlobalTimeConfig: getGlobalTimeConfigMock,
}));

import { addShiftTransaction, getOrCreateActiveShiftLog } from "./shiftUtils";

describe("shiftUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getGlobalTimeConfigMock.mockResolvedValue({
      timezone: "UTC",
      offset: "+00:00",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries without performed_by when the schema cache does not know that column", async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    const today = new Date().toISOString().slice(0, 10);

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
              eq: vi.fn((column: string, value: string) => {
                if (column === "status" && value === "OPEN") {
                  return {
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({
                        data: [
                          {
                            id: "shift-log-1",
                            shift_id: "shift-1",
                            date: today,
                            status: "OPEN",
                          },
                        ],
                        error: null,
                      })),
                    })),
                  };
                }

                if (column === "shift_id" && value === "shift-1") {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "shift-log-1",
                          status: "OPEN",
                        },
                        error: null,
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected shift_logs filter: ${column}=${value}`);
              }),
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

  it("keeps the current shift open in manual mode after the scheduled end time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T23:30:00.000Z"));

    const openShiftLog = {
      id: "shift-log-afternoon",
      shift_id: "shift-afternoon",
      date: "2026-04-10",
      status: "OPEN",
      created_at: "2026-04-10T15:00:00.000Z",
    };

    const updateMock = vi.fn(() => ({
      eq: vi.fn(async () => ({ data: null, error: null })),
    }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "shifts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [
                    {
                      id: "shift-afternoon",
                      name: "Afternoon",
                      start_time: "15:00:00",
                      end_time: "22:00:00",
                      sort_order: 1,
                      is_active: true,
                    },
                    {
                      id: "shift-night",
                      name: "Night",
                      start_time: "22:00:00",
                      end_time: "06:00:00",
                      sort_order: 2,
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
              eq: vi.fn((column: string, value: string) => {
                if (column === "status" && value === "OPEN") {
                  return {
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({
                        data: [openShiftLog],
                        error: null,
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected shift_logs filter: ${column}=${value}`);
              }),
            })),
            update: updateMock,
          };
        }

        if (table === "settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { value: "false" },
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

    const result = await getOrCreateActiveShiftLog("admin-1");

    expect(result.shift).toMatchObject({
      id: "shift-afternoon",
      name: "Afternoon",
    });
    expect(result.shiftLog).toEqual(openShiftLog);
    expect(result.is_overtime).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
