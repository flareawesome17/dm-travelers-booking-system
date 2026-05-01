import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const alertThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, reference_number, reserved_checkout_datetime, guests(full_name), rooms(room_number)")
      .eq("status", "Checked-In")
      .not("reserved_checkout_datetime", "is", null)
      .lte("reserved_checkout_datetime", alertThreshold.toISOString())
      .order("reserved_checkout_datetime", { ascending: true })
      .limit(20);

    if (error) return dbError(error, "Failed to load checked-in bookings");

    const expiring = (bookings || []).map((b) => ({
      id: b.id,
      reference_number: b.reference_number,
      guest_name: (b.guests as any)?.full_name,
      room_number: (b.rooms as any)?.room_number,
      checkout_datetime: b.reserved_checkout_datetime,
      is_overdue: b.reserved_checkout_datetime
        ? new Date(b.reserved_checkout_datetime).getTime() < now.getTime()
        : false,
    }));

    return NextResponse.json({
      count: expiring.length,
      bookings: expiring
    });
  } catch (err) {
    console.error("[API_BOOKINGS_EXPIRING_ERROR]", err);
    return internalError();
  }
}
