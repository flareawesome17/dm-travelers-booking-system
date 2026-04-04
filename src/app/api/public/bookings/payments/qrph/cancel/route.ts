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

    const paid = Number(booking.deposit_paid || 0);

    // If no payment was ever collected, delete the booking entirely
    // so it never appears in the admin dashboard.
    // CASCADE constraints will clean up payment_sessions, payments, extras, etc.
    if (paid <= 0 && status !== "Confirmed") {
      // Cancel any active payment sessions first (PayMongo side-effects are idempotent)
      await supabase
        .from("public_booking_payment_sessions")
        .update({
          status: "cancelled",
          updated_at: nowIso,
        })
        .eq("booking_id", booking.id)
        .in("status", ["awaiting_payment_method", "awaiting_next_action", "processing", "expired"]);

      // Delete the booking — cascades to payments, payment_sessions, extras, etc.
      const { error: deleteError } = await supabase
        .from("bookings")
        .delete()
        .eq("id", booking.id);

      if (deleteError) {
        console.error("[PUBLIC_BOOKING_QRPH_CANCEL_DELETE_ERROR]", deleteError);
        // Fallback: mark as cancelled if delete fails
        await supabase
          .from("bookings")
          .update({ status: "Cancelled", updated_at: nowIso })
          .eq("id", booking.id);
      }

      return NextResponse.json({
        success: true,
        status: "Cancelled",
        reference_number: booking.reference_number,
        non_refundable_notice: "No payment has been collected for this booking.",
      });
    }

    // If payment WAS collected, keep the booking but mark it cancelled
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

    // Fetch cancellation policy from settings for the notice
    let cancellationNotice = "Your down payment is subject to the hotel cancellation policy.";
    try {
      const { data: policySetting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "cancellation_policy")
        .single();
      if (policySetting?.value) {
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
