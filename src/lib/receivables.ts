import { toMoneyNumber } from "@/lib/bookingTotals";
import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export type BookingReceivableShape = {
  id: string;
  balance_due?: number | string | null;
  is_lgu_booking?: boolean | null;
  is_special_booking?: boolean | null;
  special_booking_label?: string | null;
};

type ReceivableRow = {
  id: string;
  booking_id: string;
  type: "LGU" | "SPECIAL";
  amount_due: number | string | null;
  amount_paid: number | string | null;
  status: "Outstanding" | "Partial" | "Settled";
  notes?: string | null;
  is_archived?: boolean | null;
};

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
};

export type ReceivableSyncResult =
  | { action: "created" | "updated" | "restored" | "archived" | "deleted"; receivableId: string | null; type: "LGU" | "SPECIAL" | null }
  | { action: "none"; receivableId: string | null; type: "LGU" | "SPECIAL" | null };

export function getReceivableTypeForBooking(booking: BookingReceivableShape): "LGU" | "SPECIAL" | null {
  if (booking.is_lgu_booking) return "LGU";
  if (booking.is_special_booking) return "SPECIAL";
  return null;
}

export function getReceivableStatus(amountDue: number | string | null | undefined, amountPaid: number | string | null | undefined) {
  const due = toMoneyNumber(amountDue);
  const paid = toMoneyNumber(amountPaid);
  if (due < 0.01) return "Settled" as const;
  if (paid > 0) return "Partial" as const;
  return "Outstanding" as const;
}

function isMissingReceivableArchiveColumn(error: DbErrorLike | null | undefined) {
  if (!error || error.code !== "42703") return false;
  const message = String(error.message || "");
  return message.includes("receivables.is_archived") || message.includes("receivables.archived_at") || message.includes("is_archived");
}

function getReceivableNotes(booking: BookingReceivableShape, type: "LGU" | "SPECIAL") {
  if (type === "SPECIAL") {
    return booking.special_booking_label?.trim() || "Special booking receivable";
  }
  return "LGU booking receivable";
}

export async function findLatestReceivableForBooking(supabase: SupabaseAdmin, bookingId: string) {
  const { data, error } = await supabase
    .from("receivables")
    .select("id, booking_id, type, amount_due, amount_paid, status, notes, is_archived")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error && !isMissingReceivableArchiveColumn(error)) throw error;

  const supportsArchiveColumns = !error;

  const fallbackRows = !supportsArchiveColumns
    ? await supabase
        .from("receivables")
        .select("id, booking_id, type, amount_due, amount_paid, status, notes")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
    : null;

  if (fallbackRows?.error) throw fallbackRows.error;

  const rows = ((supportsArchiveColumns ? data : fallbackRows?.data) ?? []) as ReceivableRow[];
  const active = supportsArchiveColumns ? rows.find((row) => !row.is_archived) ?? null : rows[0] ?? null;
  const archived = supportsArchiveColumns ? rows.find((row) => row.is_archived) ?? null : null;
  return { active, archived, rows, supportsArchiveColumns };
}

export async function syncReceivableForBooking(supabase: SupabaseAdmin, booking: BookingReceivableShape): Promise<ReceivableSyncResult> {
  const targetType = getReceivableTypeForBooking(booking);
  const rawOutstanding = Math.max(0, toMoneyNumber(booking.balance_due));
  const outstandingAmount = Math.round(rawOutstanding * 100) / 100;
  const { active, archived, supportsArchiveColumns } = await findLatestReceivableForBooking(supabase, booking.id);

  if (!targetType) {
    if (!active) return { action: "none", receivableId: null, type: null };

    if (toMoneyNumber(active.amount_paid) > 0) {
      if (!supportsArchiveColumns) {
        return { action: "none", receivableId: active.id, type: active.type };
      }

      const { error } = await supabase
        .from("receivables")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", active.id);

      if (error) throw error;
      return { action: "archived", receivableId: active.id, type: active.type };
    }

    const { error } = await supabase
      .from("receivables")
      .delete()
      .eq("id", active.id);

    if (error) throw error;
    return { action: "deleted", receivableId: active.id, type: active.type };
  }

  const baseUpdate = {
    type: targetType,
    amount_due: outstandingAmount,
    status: getReceivableStatus(outstandingAmount, active?.amount_paid ?? archived?.amount_paid ?? 0),
    notes: getReceivableNotes(booking, targetType),
    updated_at: new Date().toISOString(),
  };

  if (active) {
    const { error } = await supabase
      .from("receivables")
      .update(baseUpdate)
      .eq("id", active.id);

    if (error) throw error;
    return { action: "updated", receivableId: active.id, type: targetType };
  }

  if (archived) {
    const { error } = await supabase
      .from("receivables")
      .update({
        ...baseUpdate,
        is_archived: false,
        archived_at: null,
      })
      .eq("id", archived.id);

    if (error) throw error;
    return { action: "restored", receivableId: archived.id, type: targetType };
  }

  const { data, error } = await supabase
    .from("receivables")
    .insert({
      booking_id: booking.id,
      type: targetType,
      amount_due: outstandingAmount,
      amount_paid: 0,
      status: getReceivableStatus(outstandingAmount, 0),
      notes: getReceivableNotes(booking, targetType),
      ...(supportsArchiveColumns ? { is_archived: false } : {}),
    })
    .select("id")
    .single();

  if (error) throw error;
  return { action: "created", receivableId: data?.id ?? null, type: targetType };
}
