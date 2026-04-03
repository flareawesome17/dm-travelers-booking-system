import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, checkRateLimit, rateLimitResponse, requireEnvSecret } from "@/lib/api-security";
import {
  extractPaymentFinancials,
  extractPaymentMetadata,
  extractPaymentIdFromPaymentIntent,
  extractPaymentIntentStatus,
  extractQrPhDisplayData,
  normalizeSessionStatus,
  retrievePayment,
  retrievePaymentIntent,
} from "@/lib/paymongo";
import { settlePublicBookingPayment } from "@/lib/public-booking-payments";
import { recordHotelTreasuryInflow } from "@/lib/treasury";

function isUuid(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Number(n.toFixed(2)));
}

function toCentavos(value: unknown) {
  return Math.round(money(value) * 100);
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "public_booking_qrph_status",
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const url = new URL(req.url);
  const bookingId = String(url.searchParams.get("booking_id") || "");
  const email = normalizeEmail(String(url.searchParams.get("email") || ""));

  if (!isUuid(bookingId)) {
    return apiError("invalid_booking", "Invalid booking.", 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError("invalid_email", "Valid email is required.", 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, reference_number, status, total_amount, balance_due, deposit_paid, guests(email)")
      .eq("id", bookingId)
      .single();
    if (bookingError || !booking) return apiError("not_found", "Booking not found.", 404);

    const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
    const bookingEmail = normalizeEmail(String(bookingGuest?.email || ""));
    if (!bookingEmail || bookingEmail !== email) {
      return apiError("forbidden", "Booking credentials mismatch.", 403);
    }

    if (String(booking.status) === "Confirmed" && money(booking.balance_due) <= 0) {
      return NextResponse.json({
        booking_id: booking.id,
        reference_number: booking.reference_number,
        booking_status: booking.status,
        status: "succeeded",
        paid: true,
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from("public_booking_payment_sessions")
      .select("id, booking_id, payment_intent_id, payment_id, amount, status, qr_image_url, qr_expires_at, currency")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) return apiError("payment_session_error", "Failed to load payment session.", 500);
    if (!session) {
      return apiError("payment_session_missing", "Payment session not found. Generate a QR code first.", 404);
    }

    let sessionStatus = normalizeSessionStatus(session.status);
    let qrImageUrl = typeof session.qr_image_url === "string" ? session.qr_image_url : null;
    let qrExpiresAt = typeof session.qr_expires_at === "string" ? session.qr_expires_at : null;
    let paymentId = typeof session.payment_id === "string" ? session.payment_id : null;

    if (!["succeeded", "failed", "expired", "cancelled"].includes(sessionStatus)) {
      requireEnvSecret("PAYMONGO_SECRET_KEY");
      try {
        const intentPayload = await retrievePaymentIntent(String(session.payment_intent_id));
        sessionStatus = normalizeSessionStatus(extractPaymentIntentStatus(intentPayload));

        const refreshedQr = extractQrPhDisplayData(intentPayload, 1800);
        if (refreshedQr.imageUrl) qrImageUrl = refreshedQr.imageUrl;
        if (refreshedQr.expiresAtIso) qrExpiresAt = refreshedQr.expiresAtIso;
        const extractedPaymentId = extractPaymentIdFromPaymentIntent(intentPayload);
        if (extractedPaymentId) paymentId = extractedPaymentId;

        await supabase
          .from("public_booking_payment_sessions")
          .update({
            status: sessionStatus,
            payment_id: paymentId,
            qr_image_url: qrImageUrl,
            qr_expires_at: qrExpiresAt,
            updated_at: nowIso,
          })
          .eq("id", session.id);
      } catch (error) {
        console.error("[PUBLIC_BOOKING_QRPH_STATUS_REFRESH_ERROR]", error);
      }
    }

    const expired =
      !!qrExpiresAt &&
      !Number.isNaN(new Date(qrExpiresAt).getTime()) &&
      new Date(qrExpiresAt).getTime() <= Date.now();
    if (expired && sessionStatus !== "succeeded") {
      sessionStatus = "expired";
      await supabase
        .from("public_booking_payment_sessions")
        .update({ status: "expired", updated_at: nowIso })
        .eq("id", session.id);
    }

    if (sessionStatus === "succeeded" && paymentId) {
      const settle = await settlePublicBookingPayment({
        supabase,
        bookingId,
        paymentIntentId: String(session.payment_intent_id),
        paymentId,
        amountInCentavos: toCentavos(session.amount),
      });
      if (!settle.ok) {
        console.error("[PUBLIC_BOOKING_QRPH_SETTLE_STATUS_ERROR]", settle.reason);
      } else {
        let treasuryGross = money(session.amount);
        let treasuryNet = money(session.amount);
        let treasuryFee = 0;
        let treasuryMetadata: Record<string, unknown> = {};

        try {
          const paymentPayload = await retrievePayment(paymentId);
          const financials = extractPaymentFinancials(paymentPayload);
          treasuryGross = (financials.grossAmountInCentavos ?? toCentavos(session.amount)) / 100;
          treasuryNet = financials.netAmountInCentavos != null ? financials.netAmountInCentavos / 100 : treasuryGross;
          treasuryFee = financials.feeAmountInCentavos != null ? financials.feeAmountInCentavos / 100 : 0;
          treasuryMetadata = extractPaymentMetadata(paymentPayload);
        } catch (error) {
          console.error("[PUBLIC_BOOKING_QRPH_STATUS_TREASURY_FETCH_ERROR]", error);
        }

        const treasury = await recordHotelTreasuryInflow({
          supabase,
          bookingId,
          paymongoPaymentId: paymentId,
          paymentIntentId: String(session.payment_intent_id),
          grossAmount: treasuryGross,
          netAmount: treasuryNet,
          feeAmount: treasuryFee,
          metadata: treasuryMetadata,
        });
        if (!treasury.ok) {
          console.error("[PUBLIC_BOOKING_QRPH_STATUS_TREASURY_ERROR]", treasury.reason);
        }

        const paid = settle.status === "Confirmed";
        return NextResponse.json({
          booking_id: booking.id,
          reference_number: settle.reference_number || booking.reference_number,
          booking_status: settle.status,
          status: paid ? "succeeded" : "processing",
          paid,
          balance_due: settle.balance_due,
          deposit_paid: settle.deposit_paid,
        });
      }
    }

    return NextResponse.json({
      booking_id: booking.id,
      reference_number: booking.reference_number,
      booking_status: booking.status,
      status: sessionStatus,
      paid: false,
      payment_intent_id: session.payment_intent_id,
      payment_id: paymentId,
      qr_image_url: qrImageUrl,
      qr_expires_at: qrExpiresAt,
      amount: session.amount,
      currency: session.currency || "PHP",
    });
  } catch (error) {
    console.error("[PUBLIC_BOOKING_QRPH_STATUS_ERROR]", error);
    return apiError("payment_status_failed", "Unable to fetch payment status right now.", 500);
  }
}
