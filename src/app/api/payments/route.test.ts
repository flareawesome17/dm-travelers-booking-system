import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePermissionMock,
  parseAndValidateMock,
  findNextOpenLedgerDateMock,
  manilaDateStringMock,
  getSupabaseAdminMock,
  findLatestReceivableForBookingMock,
  getReceivableStatusMock,
  addShiftTransactionMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  findNextOpenLedgerDateMock: vi.fn(),
  manilaDateStringMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  findLatestReceivableForBookingMock: vi.fn(),
  getReceivableStatusMock: vi.fn(),
  addShiftTransactionMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/shiftUtils", () => ({
  addShiftTransaction: addShiftTransactionMock,
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

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/receivables", () => ({
  findLatestReceivableForBooking: findLatestReceivableForBookingMock,
  getReceivableStatus: getReceivableStatusMock,
}));

import { POST } from "./route";

function createSupabaseMock(options?: {
  receivablePaymentError?: { message: string } | null;
  receivableUpdateError?: { message: string } | null;
}) {
  const paymentInsertMock = vi.fn(async () => ({ error: null }));
  const bookingUpdateEqMock = vi.fn(async () => ({ error: null }));
  const receivablePaymentInsertMock = vi.fn(async () => ({
    error: options?.receivablePaymentError ?? null,
  }));
  const receivableUpdateEqMock = vi.fn(async () => ({
    error: options?.receivableUpdateError ?? null,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              if (column !== "id") {
                throw new Error(`Unexpected booking select eq ${column}=${value}`);
              }

              return {
                single: vi.fn(async () => ({
                  data: {
                    total_amount: 1000,
                    deposit_paid: 100,
                    balance_due: 900,
                    status: "Pending Payment",
                    restaurant_charges_total: 0,
                    extras_total: 0,
                    extensions_total: 0,
                    early_checkin_fee_applied: 0,
                    late_checkout_fee_applied: 0,
                  },
                  error: null,
                })),
              };
            }),
          })),
          update: vi.fn(() => ({
            eq: bookingUpdateEqMock,
          })),
        };
      }

      if (table === "payments") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                await paymentInsertMock();
                return { data: { id: "payment-1" }, error: null };
              })
            }))
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ amount: 100 }, { amount: 200 }],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "receivable_payments") {
        return {
          insert: receivablePaymentInsertMock,
        };
      }

      if (table === "receivables") {
        return {
          update: vi.fn(() => ({
            eq: receivableUpdateEqMock,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    bookingUpdateEqMock,
    receivablePaymentInsertMock,
    receivableUpdateEqMock,
  };
}

describe("POST /api/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        booking_id: "booking-1",
        amount: 200,
        method: "Cash",
        type: "Deposit",
        transaction_id: "TXN-1",
      },
    });
    manilaDateStringMock.mockReturnValue("2026-03-31");
    findNextOpenLedgerDateMock.mockResolvedValue("2026-03-31");
    getReceivableStatusMock.mockReturnValue("partial");
    addShiftTransactionMock.mockResolvedValue({});
  });

  it("returns the permission error before any payment work when the caller lacks payments.create", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("recomputes the booking balance and syncs the receivable ledger after a successful payment", async () => {
    const supabaseState = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    findLatestReceivableForBookingMock.mockResolvedValue({
      active: {
        id: "receivable-1",
        amount_paid: 100,
      },
    });

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.bookingUpdateEqMock).toHaveBeenCalledWith("id", "booking-1");
    expect(supabaseState.receivablePaymentInsertMock).toHaveBeenCalled();
    expect(supabaseState.receivableUpdateEqMock).toHaveBeenCalledWith("id", "receivable-1");
    expect(body).toMatchObject({
      success: true,
      recorded_for_date: "2026-03-31",
      balance_due: 700,
      status: "Confirmed",
    });
  });

  it("tolerates receivable sync failures after recording the payment and booking balance", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabaseState = createSupabaseMock({
      receivablePaymentError: { message: "receivable sync failed" },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    findLatestReceivableForBookingMock.mockResolvedValue({
      active: {
        id: "receivable-1",
        amount_paid: 100,
      },
    });

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseState.bookingUpdateEqMock).toHaveBeenCalledWith("id", "booking-1");
    expect(supabaseState.receivableUpdateEqMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      success: true,
      balance_due: 700,
      status: "Confirmed",
    });
  });
});
