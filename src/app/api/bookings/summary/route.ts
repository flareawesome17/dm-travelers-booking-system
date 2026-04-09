import { NextRequest, NextResponse } from "next/server";
import type { BookingAnalyticsRoom, BookingAnalyticsRow } from "@/lib/bookingAnalytics";
import { manilaDateString } from "@/lib/ledgerDate";
import { requirePermission } from "@/lib/rbac";
import { getGlobalTimeConfig } from "@/lib/settings";
import { summarizeBookingAnalytics } from "@/lib/bookingAnalytics";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const [timeConfig, today, bookingsResult, roomsResult] = await Promise.all([
      getGlobalTimeConfig(supabase),
      manilaDateString(new Date(), supabase),
      supabase
        .from("bookings")
        .select("status, is_lgu_booking, is_special_booking, actual_check_in_at, actual_check_out_at"),
      supabase.from("rooms").select("status, is_active"),
    ]);

    if (bookingsResult.error) {
      return NextResponse.json({ error: bookingsResult.error.message }, { status: 500 });
    }

    if (roomsResult.error) {
      return NextResponse.json({ error: roomsResult.error.message }, { status: 500 });
    }

    const summary = summarizeBookingAnalytics({
      bookings: (bookingsResult.data ?? []) as BookingAnalyticsRow[],
      rooms: (roomsResult.data ?? []) as BookingAnalyticsRoom[],
      today,
      timezone: timeConfig.timezone,
    });

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
