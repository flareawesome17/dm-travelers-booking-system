import crypto from "crypto";
import { getBookingChargeBreakdown } from "@/lib/bookingTotals";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { sendMail } from "@/lib/mailer";
import { getPublicBookingConfig } from "@/lib/public-booking-config";
import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SettlePublicBookingPaymentParams = {
  supabase: SupabaseAdminClient;
  bookingId: string;
  paymentIntentId: string;
  paymentId: string;
  amountInCentavos: number;
  paidAtIso?: string | null;
  sendConfirmationEmail?: boolean;
};

function randomGuestQrToken(reference: string) {
  return `QR-${reference}-${crypto.randomBytes(8).toString("hex")}`.toUpperCase();
}

function toMoney(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Number(n.toFixed(2)));
}

export async function settlePublicBookingPayment(params: SettlePublicBookingPaymentParams) {
  const nowIso = new Date().toISOString();
  const amount = Math.max(0, Number((params.amountInCentavos / 100).toFixed(2)));
  if (amount <= 0) {
    return { ok: false as const, reason: "Invalid payment amount." };
  }

  const { data: booking, error: bookingError } = await params.supabase
    .from("bookings")
    .select(`
      id,
      reference_number,
      status,
      guest_qr_code,
      room_type_requested,
      check_in_date,
      check_out_date,
      total_amount,
      deposit_paid,
      balance_due,
      restaurant_charges_total,
      extras_total,
      extensions_total,
      early_checkin_fee_applied,
      late_checkout_fee_applied,
      guests(full_name, email)
    `)
    .eq("id", params.bookingId)
    .single();

  if (bookingError || !booking) {
    return { ok: false as const, reason: "Booking not found." };
  }

  const bookingStatus = String(booking.status || "");
  if (["Cancelled", "No Show", "Checked-Out"].includes(bookingStatus)) {
    return { ok: false as const, reason: "Booking is not payable." };
  }

  const { data: existingPayment } = await params.supabase
    .from("payments")
    .select("id")
    .eq("transaction_id", params.paymentId)
    .maybeSingle();

  if (!existingPayment) {
    const accountingDate = await findNextOpenLedgerDate(params.supabase, manilaDateString());
    const balanceDueNow = toMoney(booking.balance_due);
    const paymentType = amount >= balanceDueNow ? "Balance" : "Deposit";
    const paymentTimestamp = params.paidAtIso && !Number.isNaN(new Date(params.paidAtIso).getTime())
      ? params.paidAtIso
      : nowIso;

    const { error: insertError } = await params.supabase.from("payments").insert({
      booking_id: params.bookingId,
      transaction_id: params.paymentId,
      method: "QRPh",
      amount,
      type: paymentType,
      status: "Success",
      transaction_time: paymentTimestamp,
      accounting_date: accountingDate,
    });
    if (insertError) {
      return { ok: false as const, reason: "Failed to record payment." };
    }
  }

  const { data: allPayments } = await params.supabase
    .from("payments")
    .select("amount")
    .eq("booking_id", params.bookingId)
    .eq("status", "Success");

  const totalPaid = Math.max(
    0,
    Number((allPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2))
  );
  const { grandTotal } = getBookingChargeBreakdown(booking);
  const config = await getPublicBookingConfig(params.supabase);
  const requiredDeposit = Number((grandTotal * (config.depositPercent / 100)).toFixed(2));
  const newBalance = Math.max(0, Number((grandTotal - totalPaid).toFixed(2)));
  const downpaymentSatisfied = totalPaid >= requiredDeposit;
  const newStatus = downpaymentSatisfied ? "Confirmed" : "Pending Payment";
  const shouldGenerateGuestQr = newStatus === "Confirmed" && !booking.guest_qr_code;
  const guestQrCode = shouldGenerateGuestQr ? randomGuestQrToken(String(booking.reference_number || "BOOKING")) : booking.guest_qr_code;

  const { error: bookingUpdateError } = await params.supabase
    .from("bookings")
    .update({
      deposit_paid: totalPaid,
      balance_due: newBalance,
      status: newStatus,
      guest_qr_code: guestQrCode,
      updated_at: nowIso,
    })
    .eq("id", params.bookingId);
  if (bookingUpdateError) {
    return { ok: false as const, reason: "Failed to update booking totals." };
  }

  await params.supabase
    .from("public_booking_payment_sessions")
    .update({
      status: newStatus === "Confirmed" ? "succeeded" : "processing",
      payment_id: params.paymentId,
      paid_at: params.paidAtIso || nowIso,
      failure_code: null,
      failure_message: null,
      updated_at: nowIso,
    })
    .eq("payment_intent_id", params.paymentIntentId);

  const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
  const guestEmail = typeof bookingGuest?.email === "string" ? bookingGuest.email.trim().toLowerCase() : "";
  const becameConfirmed = bookingStatus !== "Confirmed" && newStatus === "Confirmed";
  if (params.sendConfirmationEmail !== false && becameConfirmed && guestEmail) {
    await sendMail({
      to: guestEmail,
      subject: "D&M Travelers Inn - Booking confirmed",
      text: `Your booking is confirmed.\n\nReference: ${booking.reference_number}\nCheck-in: ${String(booking.check_in_date).slice(0, 10)}\nCheck-out: ${String(booking.check_out_date).slice(0, 10)}\n\nPresent this reference at the front desk.`,
      html: `<p>Your booking is confirmed.</p><p><strong>Reference:</strong> ${booking.reference_number}</p><p><strong>Check-in:</strong> ${String(booking.check_in_date).slice(0, 10)}<br/><strong>Check-out:</strong> ${String(booking.check_out_date).slice(0, 10)}</p><p>Please present this reference at the front desk.</p>`,
    });
  }

  return {
    ok: true as const,
    status: newStatus,
    balance_due: newBalance,
    deposit_paid: totalPaid,
    reference_number: booking.reference_number,
    becameConfirmed,
  };
}
