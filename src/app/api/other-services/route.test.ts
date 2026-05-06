import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getSupabaseAdminMock,
  parseAndValidateMock,
  addShiftTransactionMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  addShiftTransactionMock: vi.fn(),
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

vi.mock("@/lib/ledgerDate", () => ({
  manilaDateString: vi.fn(async () => "2026-05-06"),
  findNextOpenLedgerDate: vi.fn(async () => "2026-05-07"),
}));

vi.mock("@/lib/shiftUtils", () => ({
  addShiftTransaction: addShiftTransactionMock,
}));

import { POST } from "./route";

function createSupabaseMock() {
  const serviceType = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    code: "laundry",
    name: "Laundry Charge",
    rate_amount: 250,
    unit_label: "load",
    unit_description: "PHP 250 per load up to 5 kilos",
    is_active: true,
  };
  const record = {
    id: "record-1",
    service_name: "Laundry Charge",
    total_amount: 500,
    payment_method: "GCash",
    accounting_date: "2026-05-06",
  };
  const auditInsertMock = vi.fn(async () => ({ error: null }));
  const deleteMock = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const insertMock = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: record, error: null })),
    })),
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "other_service_types") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: serviceType, error: null })),
            })),
          })),
        };
      }
      if (table === "daily_ledgers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }
      if (table === "other_service_records") {
        return {
          insert: insertMock,
          delete: deleteMock,
        };
      }
      if (table === "audit_log") {
        return {
          insert: auditInsertMock,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { supabase, insertMock, auditInsertMock };
}

describe("POST /api/other-services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        service_type_id: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 2,
        payment_method: "GCash",
        payment_reference: "GC-123",
        customer_name: "Guest A",
        room_number: "101",
        note: "Two laundry loads",
      },
    });
    addShiftTransactionMock.mockResolvedValue({ id: "shift-tx-1" });
  });

  it("records service revenue and syncs it to the active shift", async () => {
    const state = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(state.supabase);

    const response = await POST({} as any);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(state.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      service_code: "laundry",
      quantity: 2,
      unit_rate: 250,
      total_amount: 500,
      payment_method: "GCash",
      payment_reference: "GC-123",
    }));
    expect(addShiftTransactionMock).toHaveBeenCalledWith(expect.objectContaining({
      source: "other_service",
      amount: 500,
      type: "INCOME",
      category: "Other Services",
    }));
    expect(state.auditInsertMock).toHaveBeenCalled();
    expect(body.record.total_amount).toBe(500);
  });
});
