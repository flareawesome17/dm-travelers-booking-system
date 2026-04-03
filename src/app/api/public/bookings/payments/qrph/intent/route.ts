import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  apiError,
  checkRateLimit,
  dbError,
  parseAndValidate,
  rateLimitResponse,
  requireEnvSecret,
} from "@/lib/api-security";
import { createPublicBookingPaymongoIntentSchema } from "@/lib/validation-schemas";
import { getPublicBookingConfig } from "@/lib/public-booking-config";
import {
  attachPaymentMethodToIntent,
  createQrPhPaymentIntent,
  createQrPhPaymentMethod,
  extractPaymentIntentId,
  extractPaymentIntentStatus,
  extractPaymentMethodId,
  extractQrPhDisplayData,
  normalizeSessionStatus,
  sanitizePaymongoQrExpirySeconds,
} from "@/lib/paymongo";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[^\d+]/g, "");
}

function moneyToCentavos(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function toMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Number(amount.toFixed(2)));
}

function isSessionActive(status: string, expiresAt?: string | null) {
  if (!["awaiting_next_action", "processing", "awaiting_payment_method"].includes(status)) return false;
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) return false;
  return expiry > Date.now();
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "public_booking_qrph_intent",
    maxRequests: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, createPublicBookingPaymongoIntentSchema);
  if (parsed.success === false) return parsed.error;

  try {
    requireEnvSecret("PAYMONGO_SECRET_KEY");

    const body = parsed.data;
    const email = normalizeEmail(body.email);
    const expirySeconds = sanitizePaymongoQrExpirySeconds(process.env.PAYMONGO_QRPH_EXPIRY_SECONDS);
    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const config = await getPublicBookingConfig(supabase);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, reference_number, status, total_amount, balance_due, deposit_paid, guests(full_name, email, phone_number)")
      .eq("id", body.booking_id)
      .single();

    if (bookingError || !booking) return apiError("not_found", "Booking not found.", 404);

    const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
    const bookingEmail = normalizeEmail(String(bookingGuest?.email || ""));
    if (!bookingEmail || bookingEmail !== email) {
      return apiError("forbidden", "Booking credentials mismatch.", 403);
    }

    if (String(booking.status) === "Pending Verification") {
      return apiError("booking_not_verified", "Verify your email first before payment.", 400);
    }
    if (["Cancelled", "No Show", "Checked-Out"].includes(String(booking.status))) {
      return apiError("booking_not_payable", "This booking can no longer be paid.", 400);
    }

    const currentBalance = toMoney(booking.balance_due ?? booking.total_amount);
    const currentPaid = toMoney(booking.deposit_paid);
    const totalAmount = toMoney(booking.total_amount);
    const requiredDeposit = Number((totalAmount * (config.depositPercent / 100)).toFixed(2));
    const amountNeededForDeposit = Math.max(0, Number((requiredDeposit - currentPaid).toFixed(2)));
    const amountToCollect = Math.min(currentBalance, amountNeededForDeposit);
    const downpaymentCentavos = moneyToCentavos(amountToCollect);

    if (downpaymentCentavos <= 0) {
      if (String(booking.status) !== "Confirmed") {
        await supabase
          .from("bookings")
          .update({ status: "Confirmed", updated_at: nowIso })
          .eq("id", booking.id);
      }
      return NextResponse.json({
        booking_id: booking.id,
        reference_number: booking.reference_number,
        status: "succeeded",
        paid: true,
        amount: 0,
        currency: config.currency,
        deposit_percent: config.depositPercent,
      });
    }

    const { data: latestSession } = await supabase
      .from("public_booking_payment_sessions")
      .select("id, status, qr_image_url, qr_expires_at, payment_intent_id, amount, currency, meta")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSession) {
      const latestStatus = normalizeSessionStatus(latestSession.status);
      if (latestStatus === "succeeded") {
        return NextResponse.json({
          booking_id: booking.id,
          reference_number: booking.reference_number,
          status: "succeeded",
          paid: true,
        });
      }

      if (isSessionActive(latestStatus, latestSession.qr_expires_at) && latestSession.qr_image_url) {
        return NextResponse.json({
          booking_id: booking.id,
          reference_number: booking.reference_number,
          status: latestStatus,
          paid: false,
          payment_intent_id: latestSession.payment_intent_id,
          qr_image_url: latestSession.qr_image_url,
          qr_expires_at: latestSession.qr_expires_at,
          amount: latestSession.amount,
          currency: latestSession.currency || config.currency,
          deposit_percent: Number((latestSession.meta as Record<string, unknown> | null)?.deposit_percent || config.depositPercent),
        });
      }

      if (latestStatus !== "failed" && latestStatus !== "cancelled") {
        await supabase
          .from("public_booking_payment_sessions")
          .update({ status: "expired", updated_at: nowIso })
          .eq("id", latestSession.id);
      }
    }

    const baseKey = `${booking.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const paymentIntentPayload = await createQrPhPaymentIntent({
      amountInCentavos: downpaymentCentavos,
      description: `Booking ${booking.reference_number}`,
      metadata: {
        booking_id: String(booking.id),
        reference_number: String(booking.reference_number || ""),
        deposit_percent: String(config.depositPercent),
        source_app: "hotel",
        business_unit: "dm_travelers_inn",
      },
      idempotencyKey: `pi-${baseKey}`,
    });
    const paymentIntentId = extractPaymentIntentId(paymentIntentPayload);
    if (!paymentIntentId) {
      return apiError("payment_setup_failed", "Unable to initialize payment intent.", 502);
    }

    const paymentMethodPayload = await createQrPhPaymentMethod({
      name: String(bookingGuest?.full_name || "Guest"),
      email: bookingEmail,
      phone: normalizePhone(bookingGuest?.phone_number),
      expirySeconds,
      idempotencyKey: `pm-${baseKey}`,
    });
    const paymentMethodId = extractPaymentMethodId(paymentMethodPayload);
    if (!paymentMethodId) {
      return apiError("payment_setup_failed", "Unable to initialize payment method.", 502);
    }

    const attachedPayload = await attachPaymentMethodToIntent({
      paymentIntentId,
      paymentMethodId,
      idempotencyKey: `attach-${baseKey}`,
    });
    const paymentStatus = normalizeSessionStatus(extractPaymentIntentStatus(attachedPayload));
    const { imageUrl, expiresAtIso } = extractQrPhDisplayData(attachedPayload, expirySeconds);
    if (!imageUrl) {
      return apiError("payment_setup_failed", "Unable to generate QR code right now.", 502);
    }

    const { error: sessionError } = await supabase.from("public_booking_payment_sessions").insert({
      booking_id: booking.id,
      provider: "PayMongo",
      payment_intent_id: paymentIntentId,
      payment_method_id: paymentMethodId,
      status: paymentStatus,
      amount: Number((downpaymentCentavos / 100).toFixed(2)),
      currency: config.currency,
      qr_image_url: imageUrl,
      qr_expires_at: expiresAtIso,
      meta: {
        payment_intent_status: paymentStatus,
        deposit_percent: config.depositPercent,
        source_app: "hotel",
      },
      updated_at: nowIso,
    });
    if (sessionError) return dbError(sessionError, "Failed to store payment session.");

    return NextResponse.json({
      booking_id: booking.id,
      reference_number: booking.reference_number,
      status: paymentStatus,
      paid: false,
      payment_intent_id: paymentIntentId,
      qr_image_url: imageUrl,
      qr_expires_at: expiresAtIso,
      amount: Number((downpaymentCentavos / 100).toFixed(2)),
      currency: config.currency,
      deposit_percent: config.depositPercent,
    });
  } catch (error) {
    console.error("[PUBLIC_BOOKING_QRPH_INTENT_ERROR]", error);
    return apiError(
      "payment_setup_failed",
      "Unable to initialize QRPh payment right now. Please try again.",
      502
    );
  }
}
