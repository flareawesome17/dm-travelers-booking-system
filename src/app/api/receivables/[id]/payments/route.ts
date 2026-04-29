import { NextRequest, NextResponse } from "next/server";
import { addShiftTransaction } from "@/lib/shiftUtils";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createReceivablePaymentSchema } from "@/lib/validation-schemas";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { getReceivableStatus } from "@/lib/receivables";
import { toMoneyNumber } from "@/lib/bookingTotals";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createReceivablePaymentSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const body = parsed.data;
    const supabase = getSupabaseAdmin();

    // Get current receivable with booking details for ledger description
    const { data: rec, error: rErr } = await supabase
      .from("receivables")
      .select("id, amount_due, amount_paid, status, booking_id")
      .eq("id", id)
      .single();

    if (rErr || !rec) return dbError(rErr, "Receivable not found");
    if (rec.status === "Settled" || toMoneyNumber(rec.amount_due) <= 0) {
      return NextResponse.json(
        { error: { code: "already_settled", message: "This receivable is already fully settled" } },
        { status: 422 }
      );
    }

    // Fetch booking reference for shift ledger description
    let refIdentifier = rec.booking_id || "Unknown";
    if (rec.booking_id) {
      const { data: bk } = await supabase
        .from("bookings")
        .select("reference_number")
        .eq("id", rec.booking_id)
        .maybeSingle();
      if (bk?.reference_number) refIdentifier = bk.reference_number;
    }

    const today = await manilaDateString();
    const accountingDate = await findNextOpenLedgerDate(supabase, today);

    // Insert payment
    const { data: payment, error: pErr } = await supabase
      .from("receivable_payments")
      .insert({
        receivable_id: id,
        amount: body.amount,
        method: body.method,
        notes: body.notes || null,
        cheque_number: body.cheque_number || null,
        recorded_by_admin_id: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
        accounting_date: accountingDate,
      })
      .select()
      .single();

    if (pErr || !payment) return dbError(pErr, "Failed to record payment");

    // Shift Transaction Sync (non-blocking – shift issues should not block receivable collections)
    await addShiftTransaction({
      source: "booking",
      referenceId: payment.id,
      description: `Receivable Collection (${body.method}): ${refIdentifier}`,
      amount: Number(body.amount),
      type: "INCOME",
      performedBy: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
      onFailure: "silent",
    });

    // Update receivable totals
    const newAmountPaid = toMoneyNumber(rec.amount_paid) + body.amount;
    const newAmountDue = Math.max(0, toMoneyNumber(rec.amount_due) - body.amount);
    const newStatus = getReceivableStatus(newAmountDue, newAmountPaid);

    const { error: upErr } = await supabase
      .from("receivables")
      .update({
        amount_due: newAmountDue,
        amount_paid: newAmountPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) console.error("[RECEIVABLE_UPDATE_ERROR]", upErr);

    // Also update the booking's balance_due
    if (rec.booking_id) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("balance_due, deposit_paid")
        .eq("id", rec.booking_id)
        .single();

      if (booking) {
        const newBalance = Math.max(0, Number(booking.balance_due || 0) - body.amount);
        const newDeposit = Number(booking.deposit_paid || 0) + body.amount;
        await supabase
          .from("bookings")
          .update({ balance_due: newBalance, deposit_paid: newDeposit, updated_at: new Date().toISOString() })
          .eq("id", rec.booking_id);
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[RECEIVABLE_PAYMENT_ERROR]", err);
    return internalError();
  }
}
