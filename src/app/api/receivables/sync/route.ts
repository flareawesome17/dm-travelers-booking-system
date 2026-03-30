import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { syncReceivableForBooking } from "@/lib/receivables";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, balance_due, is_lgu_booking, is_special_booking, special_booking_label")
      .or("is_lgu_booking.eq.true,is_special_booking.eq.true");

    if (error) return dbError(error, "Failed to load bookings for sync");

    const totals = {
      created: 0,
      updated: 0,
      restored: 0,
      archived: 0,
      deleted: 0,
      none: 0,
    };

    for (const booking of bookings ?? []) {
      const result = await syncReceivableForBooking(supabase, booking);
      totals[result.action] += 1;
    }

    return NextResponse.json({
      success: true,
      totals,
      processed: (bookings ?? []).length,
    });
  } catch (error) {
    console.error("[RECEIVABLE_SYNC_ERROR]", error);
    return internalError();
  }
}
