import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { getOrCreateActiveShiftLog } from "@/lib/shiftUtils";

/**
 * GET  — Preview orphaned payments (payments with no shift_transaction).
 * POST — Recover orphaned payments into the current active shift.
 */

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "shifts.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();

    const { data: orphans, error } = await supabase.rpc("get_orphaned_payments");
    if (error) {
      // Fallback: if RPC doesn't exist yet, do it inline
      const { data, error: fallbackErr } = await supabase
        .from("payments")
        .select("id, booking_id, amount, method, type, status, transaction_id, accounting_date, bookings!inner(reference_number)")
        .eq("status", "Success")
        .order("accounting_date", { ascending: false });

      if (fallbackErr) throw fallbackErr;

      // Filter out payments that already have a shift_transaction
      const { data: existingRefs } = await supabase
        .from("shift_transactions")
        .select("reference_id");

      const existingSet = new Set((existingRefs ?? []).map((r: any) => r.reference_id).filter(Boolean));
      const orphanedPayments = (data ?? []).filter((p: any) => !existingSet.has(p.id));

      return NextResponse.json({
        count: orphanedPayments.length,
        payments: orphanedPayments.map((p: any) => ({
          id: p.id,
          booking_id: p.booking_id,
          reference_number: p.bookings?.reference_number || "N/A",
          amount: Number(p.amount),
          method: p.method,
          type: p.type,
          accounting_date: p.accounting_date,
        })),
      });
    }

    return NextResponse.json({
      count: (orphans ?? []).length,
      payments: orphans ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "shifts.update");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload?.sub === "string" ? auth.payload.sub : null;

    // 1. Get the current OPEN shift log
    const { shiftLog } = await getOrCreateActiveShiftLog(adminId || undefined);

    if (shiftLog.status === "CLOSED") {
      return NextResponse.json(
        { error: "The current shift is closed. Cannot recover transactions to a closed shift." },
        { status: 400 }
      );
    }

    // 2. Find orphaned payments
    const { data: allPayments, error: pErr } = await supabase
      .from("payments")
      .select("id, booking_id, amount, method, type, status, bookings!inner(reference_number)")
      .eq("status", "Success")
      .order("accounting_date", { ascending: false });

    if (pErr) throw pErr;

    const { data: existingRefs } = await supabase
      .from("shift_transactions")
      .select("reference_id");

    const existingSet = new Set((existingRefs ?? []).map((r: any) => r.reference_id).filter(Boolean));
    const orphanedPayments = (allPayments ?? []).filter((p: any) => !existingSet.has(p.id));

    if (orphanedPayments.length === 0) {
      return NextResponse.json({ message: "No orphaned payments found.", recovered: 0 });
    }

    // 3. Insert recovered transactions
    const transactionsToInsert = orphanedPayments.map((p: any) => ({
      shift_log_id: shiftLog.id,
      source: "booking",
      reference_id: p.id,
      description: `Booking ${p.type} (${p.method}): ${p.bookings?.reference_number || p.booking_id} [Recovered]`,
      amount: Number(p.amount),
      type: "INCOME",
      performed_by: adminId,
    }));

    const { error: insertErr } = await supabase
      .from("shift_transactions")
      .insert(transactionsToInsert);

    if (insertErr) throw insertErr;

    // 4. Audit log
    await supabase.from("audit_log").insert({
      entity_type: "shift_log",
      entity_id: shiftLog.id,
      action: "recover_orphaned_transactions",
      changes: {
        recovered_count: orphanedPayments.length,
        total_recovered: orphanedPayments.reduce((s: number, p: any) => s + Number(p.amount), 0),
        payment_ids: orphanedPayments.map((p: any) => p.id),
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      message: `Successfully recovered ${orphanedPayments.length} transaction(s) to the current shift ledger.`,
      recovered: orphanedPayments.length,
      total_amount: orphanedPayments.reduce((s: number, p: any) => s + Number(p.amount), 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
