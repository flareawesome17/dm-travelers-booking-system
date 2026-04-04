import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createPaymentSchema } from "@/lib/validation-schemas";
import { getBookingChargeBreakdown, toMoneyNumber } from "@/lib/bookingTotals";
import { findLatestReceivableForBooking, getReceivableStatus } from "@/lib/receivables";

import { addShiftTransaction } from "@/lib/shiftUtils";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "payments.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createPaymentSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const today = manilaDateString();
    const accountingDate = await findNextOpenLedgerDate(supabase, today);

    const { booking_id, amount, method, type, transaction_id } = parsed.data;

    // 1. Fetch current booking details to calculate new balance
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        reference_number,
        total_amount,
        deposit_paid,
        balance_due,
        status,
        restaurant_charges_total,
        extras_total,
        extensions_total,
        early_checkin_fee_applied,
        late_checkout_fee_applied
      `)
      .eq("id", booking_id)
      .single();

    if (fetchError || !booking) {
      return dbError(fetchError, "Booking not found");
    }

    const { grandTotal } = getBookingChargeBreakdown(booking);

    // 2. Insert the payment record
    const tId = transaction_id?.trim() || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { data: paymentRecord, error: insertError } = await supabase
      .from("payments")
      .insert({
        booking_id,
        amount,
        method,
        type,
        transaction_id: tId,
        accounting_date: accountingDate,
        status: "Success",
      })
      .select()
      .single();

    if (insertError || !paymentRecord) {
      return dbError(insertError, "Failed to record payment");
    }

    // 2.5 Shift Transaction Sync
    try {
      await addShiftTransaction({
        source: "booking",
        referenceId: paymentRecord.id,
        description: `Booking Payment (${type}): ${booking.reference_number || booking_id}`,
        amount: Number(amount),
        type: "INCOME",
        performedBy: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
        onFailure: "throw",
      });
    } catch (shiftError) {
      console.error("[PAYMENT_SHIFT_SYNC_ERROR]", shiftError);
      
      const { error: rollbackError } = await supabase.from("payments").delete().eq("id", paymentRecord.id);
      if (rollbackError) {
        console.error("[PAYMENT_SHIFT_SYNC_ROLLBACK_ERROR]", rollbackError);
      }
      return internalError();
    }

    // 3. Calculate new totals
    let newDepositPaid = toMoneyNumber(booking.deposit_paid);
    if (type === "Deposit") {
      newDepositPaid += amount;
    }

    // We fetch all successful payments to ensure perfect accuracy for balance
    const { data: allPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("booking_id", booking_id)
      .eq("status", "Success");

    const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const newBalanceDue = Math.max(0, grandTotal - totalPaid);

    // 4. Determine if status should auto-update
    let newStatus = booking.status;
    if (booking.status === "Pending Payment" && amount > 0) {
      newStatus = "Confirmed";
    }

    // 5. Update the booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        deposit_paid: newDepositPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updateError) {
      return dbError(updateError, "Payment logged, but failed to update booking balance");
    }

    try {
      const { active: receivable } = await findLatestReceivableForBooking(supabase, booking_id);
      if (receivable) {
        const nextAmountPaid = toMoneyNumber(receivable.amount_paid) + amount;
        const receivableMethod =
          method === "Cash" || method === "GCash" || method === "Card"
            ? method
            : "Bank Transfer";

        const { error: receivablePaymentError } = await supabase
          .from("receivable_payments")
          .insert({
            receivable_id: receivable.id,
            amount,
            method: receivableMethod,
            notes: `Synced from booking payment ${tId}`,
            recorded_by_admin_id: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
            accounting_date: accountingDate,
          });

        if (receivablePaymentError) {
          console.error("[RECEIVABLE_PAYMENT_SYNC_ERROR]", receivablePaymentError);
        } else {
          const { error: receivableUpdateError } = await supabase
            .from("receivables")
            .update({
              amount_due: newBalanceDue,
              amount_paid: nextAmountPaid,
              status: getReceivableStatus(newBalanceDue, nextAmountPaid),
              updated_at: new Date().toISOString(),
            })
            .eq("id", receivable.id);

          if (receivableUpdateError) {
            console.error("[RECEIVABLE_SYNC_ERROR]", receivableUpdateError);
          }
        }
      }
    } catch (syncError) {
      console.error("[RECEIVABLE_BOOKING_SYNC_ERROR]", syncError);
    }

    return NextResponse.json({
      success: true,
      message: "Payment recorded successfully",
      recorded_for_date: accountingDate,
      balance_due: newBalanceDue,
      status: newStatus,
    });
  } catch (error) {
    console.error("[PAYMENT_ERROR]", error);
    return internalError();
  }
}
