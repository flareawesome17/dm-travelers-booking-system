import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getPublicBookingConfig } from "@/lib/public-booking-config";
import { internalError } from "@/lib/api-security";

export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const config = await getPublicBookingConfig(supabase);

    return NextResponse.json({
      deposit_percent: config.depositPercent,
      cancellation_policy: config.cancellationPolicy,
      currency: config.currency,
      hotel_name: config.hotelName,
      payment_security_notice:
        `Online payments for ${config.hotelName} are protected and securely processed by PayMongo. Payment information is transmitted through encrypted channels and handled with strict confidentiality.`,
    });
  } catch (error) {
    console.error("[PUBLIC_BOOKING_CONFIG_ERROR]", error);
    return internalError();
  }
}
