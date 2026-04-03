import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError } from "@/lib/api-security";
import {
  extractPaymentFinancials,
  extractPaymentMetadata,
  parsePaymongoWebhookEvent,
  retrievePayment,
  verifyPaymongoWebhookSignature,
} from "@/lib/paymongo";
import { settlePublicBookingPayment } from "@/lib/public-booking-payments";
import { recordHotelTreasuryInflow } from "@/lib/treasury";

const HANDLED_EVENTS = new Set(["payment.paid", "payment.failed"]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader =
    req.headers.get("paymongo-signature") ||
    req.headers.get("x-paymongo-signature") ||
    "";

  if (!signatureHeader) {
    return apiError("invalid_signature", "Missing webhook signature.", 401);
  }

  const signature = verifyPaymongoWebhookSignature({
    rawBody,
    signatureHeader,
  });
  if (!signature.ok) {
    return apiError("invalid_signature", signature.reason || "Webhook signature invalid.", 401);
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return apiError("invalid_json", "Webhook payload must be valid JSON.", 400);
  }

  const event = parsePaymongoWebhookEvent(payload);
  if (!event.type) {
    return apiError("invalid_event", "Webhook event type missing.", 400);
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!event.paymentIntentId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: session } = await supabase
    .from("public_booking_payment_sessions")
    .select("id, booking_id, payment_intent_id, payment_id, status")
    .eq("payment_intent_id", event.paymentIntentId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (event.type === "payment.failed") {
    await supabase
      .from("public_booking_payment_sessions")
      .update({
        status: "failed",
        payment_id: event.paymentId || session.payment_id,
        failure_code: event.failureCode,
        failure_message: event.failureMessage || "Payment failed.",
        updated_at: nowIso,
      })
      .eq("id", session.id);

    return NextResponse.json({ received: true });
  }

  if (!event.paymentId || event.amountInCentavos <= 0) {
    return NextResponse.json({ received: true, ignored: true });
  }

  await supabase
    .from("public_booking_payment_sessions")
    .update({
      status: "processing",
      payment_id: event.paymentId,
      failure_code: null,
      failure_message: null,
      updated_at: nowIso,
    })
    .eq("id", session.id);

  const settled = await settlePublicBookingPayment({
    supabase,
    bookingId: String(session.booking_id),
    paymentIntentId: event.paymentIntentId,
    paymentId: event.paymentId,
    amountInCentavos: event.amountInCentavos,
    paidAtIso: event.paidAtIso,
    sendConfirmationEmail: true,
  });

  if (!settled.ok) {
    console.error("[PUBLIC_BOOKING_QRPH_WEBHOOK_SETTLE_ERROR]", settled.reason);
    if (settled.reason === "Booking not found." || settled.reason === "Booking is not payable.") {
      return NextResponse.json({ received: true, ignored: true });
    }
    return NextResponse.json({ error: "Webhook settlement failed." }, { status: 500 });
  }

  let treasuryGross = event.amountInCentavos / 100;
  let treasuryNet = event.amountInCentavos / 100;
  let treasuryFee = 0;
  let treasuryMetadata: Record<string, unknown> = {};

  try {
    const paymentPayload = await retrievePayment(event.paymentId);
    const financials = extractPaymentFinancials(paymentPayload);
    treasuryGross = (financials.grossAmountInCentavos ?? event.amountInCentavos) / 100;
    treasuryNet = financials.netAmountInCentavos != null ? financials.netAmountInCentavos / 100 : treasuryGross;
    treasuryFee = financials.feeAmountInCentavos != null ? financials.feeAmountInCentavos / 100 : 0;
    treasuryMetadata = extractPaymentMetadata(paymentPayload);
  } catch (error) {
    console.error("[PUBLIC_BOOKING_QRPH_TREASURY_FETCH_ERROR]", error);
  }

  const treasury = await recordHotelTreasuryInflow({
    supabase,
    bookingId: String(session.booking_id),
    paymongoPaymentId: event.paymentId,
    paymentIntentId: event.paymentIntentId,
    grossAmount: treasuryGross,
    netAmount: treasuryNet,
    feeAmount: treasuryFee,
    paidAtIso: event.paidAtIso,
    metadata: treasuryMetadata,
  });
  if (!treasury.ok) {
    console.error("[PUBLIC_BOOKING_QRPH_TREASURY_ERROR]", treasury.reason);
  }

  return NextResponse.json({ received: true });
}
