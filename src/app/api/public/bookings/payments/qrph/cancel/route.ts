import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, checkRateLimit, parseAndValidate, rateLimitResponse } from "@/lib/api-security";
import { cancelPublicBookingPaymentSchema } from "@/lib/validation-schemas";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "public_booking_qrph_cancel",
    maxRequests: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, cancelPublicBookingPaymentSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const body = parsed.data;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, reference_number, status, deposit_paid, guests(email)")
      .eq("id", body.booking_id)
      .single();
    if (bookingError || !booking) return apiError("not_found", "Booking not found.", 404);

    const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
    const bookingEmail = normalizeEmail(String(bookingGuest?.email || ""));
    if (!bookingEmail || bookingEmail !== normalizeEmail(body.email)) {
      return apiError("forbidden", "Booking credentials mismatch.", 403);
    }

    const status = String(booking.status || "");
    if (["Checked-In", "Checked-Out", "No Show"].includes(status)) {
      return apiError("booking_locked", "This booking can no longer be cancelled online.", 400);
    }

    if (status !== "Cancelled") {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "Cancelled",
          updated_at: nowIso,
        })
        .eq("id", booking.id);
      if (updateError) {
        return apiError("cancel_failed", "Unable to cancel booking at this time.", 500);
      }
    }

    await supabase
      .from("public_booking_payment_sessions")
      .update({
        status: "cancelled",
        updated_at: nowIso,
      })
      .eq("booking_id", booking.id)
      .in("status", ["awaiting_payment_method", "awaiting_next_action", "processing", "expired"]);

    const paid = Number(booking.deposit_paid || 0);

    // Fetch cancellation policy from settings for the notice
    let cancellationNotice = paid > 0
      ? "Your down payment is subject to the hotel cancellation policy."
      : "No payment has been collected for this booking.";
    try {
      const { data: policySetting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "cancellation_policy")
        .single();
      if (policySetting?.value && paid > 0) {
        cancellationNotice = policySetting.value;
      }
    } catch {
      // Use default notice if settings fetch fails
    }

    return NextResponse.json({
      success: true,
      status: "Cancelled",
      reference_number: booking.reference_number,
      non_refundable_notice: cancellationNotice,
    });
  } catch (error) {
    console.error("[PUBLIC_BOOKING_QRPH_CANCEL_ERROR]", error);
    return apiError("cancel_failed", "Unable to cancel booking right now.", 500);
  }
}
