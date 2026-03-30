import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  parseAndValidateMock,
  findNextOpenLedgerDateMock,
  manilaDateStringMock,
  addShiftTransactionMock,
  getSupabaseAdminMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  findNextOpenLedgerDateMock: vi.fn(),
  manilaDateStringMock: vi.fn(),
  addShiftTransactionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
  };
});

vi.mock("@/lib/ledgerDate", () => ({
  findNextOpenLedgerDate: findNextOpenLedgerDateMock,
  manilaDateString: manilaDateStringMock,
}));

vi.mock("@/lib/shiftUtils", () => ({
  addShiftTransaction: addShiftTransactionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { POST } from "./route";

function createSupabaseMock(options?: {
  ledgerStatus?: "open" | "closed" | null;
  insertedExpense?: Record<string, unknown>;
  rollbackError?: { message: string } | null;
}) {
  let rollbackExpenseId: string | null = null;

  const ledgerQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data:
        options?.ledgerStatus == null
          ? null
          : { status: options.ledgerStatus },
      error: null,
    })),
  };

  const expenseInsertQuery = {
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: options?.insertedExpense ?? {
          id: "expense-1",
          date: "2026-03-30",
          description: "Pantry Supplies",
          amount: 500,
          category: "Supplies",
        },
        error: null,
      })),
    })),
  };

  const expenseDeleteQuery = {
    eq: vi.fn(async (_column: string, id: string) => {
      rollbackExpenseId = id;
      return { error: options?.rollbackError ?? null };
    }),
  };

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "daily_ledgers") {
        return {
          select: vi.fn(() => ledgerQuery),
        };
      }

      if (table === "expenses") {
        return {
          insert: vi.fn(() => expenseInsertQuery),
          delete: vi.fn(() => expenseDeleteQuery),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    get rollbackExpenseId() {
      return rollbackExpenseId;
    },
  };
}

describe("POST /api/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        description: "Pantry Supplies",
        amount: 500,
        category: "Supplies",
      },
    });
    manilaDateStringMock.mockReturnValue("2026-03-30");
    findNextOpenLedgerDateMock.mockResolvedValue("2026-03-31");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an expense and syncs a shift expense transaction", async () => {
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    addShiftTransactionMock.mockResolvedValue({
      id: "shift-tx-1",
      source: "expense",
      reference_id: "expense-1",
    });

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(addShiftTransactionMock).toHaveBeenCalledWith({
      source: "expense",
      referenceId: "expense-1",
      description: "Expense: Supplies Pantry Supplies",
      amount: 500,
      type: "EXPENSE",
      category: "Supplies",
      performedBy: "admin-1",
      onFailure: "throw",
    });
    expect(body).toMatchObject({
      id: "expense-1",
      recorded_for_date: "2026-03-30",
      shift_transaction: {
        id: "shift-tx-1",
      },
    });
    expect(supabaseState.rollbackExpenseId).toBeNull();
  });

  it("rolls back the expense when shift sync fails", async () => {
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    addShiftTransactionMock.mockRejectedValue(new Error("shift sync failed"));

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "internal_error",
        message: "Internal server error",
      },
    });
    expect(supabaseState.rollbackExpenseId).toBe("expense-1");
  });
});
