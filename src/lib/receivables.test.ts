import { describe, expect, it, vi } from "vitest";
import {
  getReceivableStatus,
  getReceivableTypeForBooking,
  syncReceivableForBooking,
} from "./receivables";

function createQueryMock(result: { data?: unknown; error?: unknown }) {
  return {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  };
}

describe("receivables helpers", () => {
  it("classifies booking receivable types", () => {
    expect(getReceivableTypeForBooking({ id: "b1", is_lgu_booking: true })).toBe("LGU");
    expect(
      getReceivableTypeForBooking({
        id: "b2",
        is_lgu_booking: false,
        is_special_booking: true,
      })
    ).toBe("SPECIAL");
    expect(getReceivableTypeForBooking({ id: "b3" })).toBeNull();
  });

  it("derives receivable status from due and paid totals", () => {
    expect(getReceivableStatus(500, 0)).toBe("Outstanding");
    expect(getReceivableStatus(500, 100)).toBe("Partial");
    expect(getReceivableStatus(0, 100)).toBe("Settled");
  });
});

describe("syncReceivableForBooking", () => {
  it("archives an active paid receivable when the booking no longer needs one", async () => {
    const selectQuery = createQueryMock({
      data: [
        {
          id: "rec-1",
          booking_id: "booking-1",
          type: "LGU",
          amount_due: 500,
          amount_paid: 200,
          status: "Partial",
          notes: "LGU booking receivable",
          is_archived: false,
        },
      ],
    });
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "receivables") {
          return {
            select: vi.fn(() => selectQuery),
            update,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await syncReceivableForBooking(supabase as any, {
      id: "booking-1",
      balance_due: 0,
      is_lgu_booking: false,
      is_special_booking: false,
    });

    expect(result).toEqual({
      action: "archived",
      receivableId: "rec-1",
      type: "LGU",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_archived: true,
      })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "rec-1");
  });

  it("restores an archived receivable when a special booking regains receivable status", async () => {
    const selectQuery = createQueryMock({
      data: [
        {
          id: "rec-archived",
          booking_id: "booking-2",
          type: "SPECIAL",
          amount_due: 1500,
          amount_paid: 500,
          status: "Partial",
          notes: "Old note",
          is_archived: true,
        },
      ],
    });
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "receivables") {
          return {
            select: vi.fn(() => selectQuery),
            update,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await syncReceivableForBooking(supabase as any, {
      id: "booking-2",
      balance_due: 1200,
      is_special_booking: true,
      special_booking_label: "Corporate hold",
    });

    expect(result).toEqual({
      action: "restored",
      receivableId: "rec-archived",
      type: "SPECIAL",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_due: 1200,
        notes: "Corporate hold",
        is_archived: false,
        archived_at: null,
        status: "Partial",
      })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "rec-archived");
  });

  it("creates a new receivable when an LGU booking has no existing record", async () => {
    const selectQuery = createQueryMock({ data: [] });
    const insertSingle = vi.fn(async () => ({ data: { id: "rec-new" }, error: null }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: insertSingle,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "receivables") {
          return {
            select: vi.fn(() => selectQuery),
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await syncReceivableForBooking(supabase as any, {
      id: "booking-3",
      balance_due: 800,
      is_lgu_booking: true,
    });

    expect(result).toEqual({
      action: "created",
      receivableId: "rec-new",
      type: "LGU",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_id: "booking-3",
        amount_due: 800,
        amount_paid: 0,
        type: "LGU",
        status: "Outstanding",
      })
    );
  });
});
