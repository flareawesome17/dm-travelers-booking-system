import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const PAYMENT_EXPIRY_MINUTES = 30;

export async function GET(req: NextRequest) {
  // Protect with a cron secret — set CRON_SECRET in env
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    let cancelledPendingPayment = 0;
    let cancelledPendingVerification = 0;

    // 1. Cancel Pending Payment bookings that exceeded the payment window
    const paymentCutoff = new Date(now.getTime() - PAYMENT_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { data: expiredPaymentBookings, error: epError } = await supabase
      .from("bookings")
      .select("id, room_id, payment_expires_at, updated_at")
      .eq("status", "Pending Payment");

    if (!epError && expiredPaymentBookings) {
      for (const booking of expiredPaymentBookings) {
        // Use payment_expires_at if set, otherwise fall back to updated_at + window
        const expiresAt = booking.payment_expires_at
          ? new Date(booking.payment_expires_at)
          : new Date(new Date(booking.updated_at).getTime() + PAYMENT_EXPIRY_MINUTES * 60 * 1000);

        if (now >= expiresAt) {
          const { error: updateError } = await supabase
            .from("bookings")
            .update({
              status: "Cancelled",
              updated_at: now.toISOString(),
            })
            .eq("id", booking.id)
            .eq("status", "Pending Payment"); // Optimistic lock

          if (!updateError) {
            cancelledPendingPayment++;

            // Cancel any active payment sessions
            await supabase
              .from("public_booking_payment_sessions")
              .update({ status: "expired", updated_at: now.toISOString() })
              .eq("booking_id", booking.id)
              .in("status", ["awaiting_payment_method", "awaiting_next_action", "processing"]);
          }
        }
      }
    }

    // 2. Cancel Pending Verification bookings where code has expired
    const { data: expiredVerificationBookings, error: evError } = await supabase
      .from("bookings")
      .select("id, room_id")
      .eq("status", "Pending Verification")
      .lt("verification_code_expires_at", now.toISOString());

    if (!evError && expiredVerificationBookings) {
      for (const booking of expiredVerificationBookings) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            status: "Cancelled",
            verification_code: null,
            verification_code_expires_at: null,
            updated_at: now.toISOString(),
          })
          .eq("id", booking.id)
          .eq("status", "Pending Verification");

        if (!updateError) {
          cancelledPendingVerification++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      cancelled_pending_payment: cancelledPendingPayment,
      cancelled_pending_verification: cancelledPendingVerification,
      ran_at: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON_CLEANUP_ERROR]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
