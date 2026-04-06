import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    // We only care about bookings that are currently Checked-In
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, guests(full_name), rooms(room_number)")
      .eq("status", "Checked-In");

    if (error) return dbError(error, "Failed to load checked-in bookings");

    const now = new Date();
    const alertThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

    const { getGlobalTimeConfig } = await import("@/lib/settings");
    const { offset } = await getGlobalTimeConfig(supabase);
    const tzOffset = offset || "+08:00";

    const expiring = (bookings || []).map((b) => {
      let checkoutTime: Date | null = null;
      const rateKind = b.rate_plan_kind || "24h";

      if (rateKind === "24h") {
        if (b.check_out_date) {
            // Standard check-out is 12:00 PM based on timezone 
            checkoutTime = new Date(`${b.check_out_date}T12:00:00${tzOffset}`);
        }
      } else {
        // Hourly: actual_check_in_at + N hours
        const hoursToAdd = parseInt(rateKind.replace(/\D/g, ""), 10) || 0;
        if (b.actual_check_in_at) {
          checkoutTime = new Date(b.actual_check_in_at);
          checkoutTime.setHours(checkoutTime.getHours() + hoursToAdd);
        }
      }

      if (!checkoutTime) return null;

      // Filter: Expiring within 30 mins OR already past due (overdue)
      if (checkoutTime <= alertThreshold) {
        return {
          id: b.id,
          reference_number: b.reference_number,
          guest_name: b.guests?.full_name,
          room_number: b.rooms?.room_number,
          checkout_datetime: checkoutTime.toISOString(),
          is_overdue: checkoutTime < now
        };
      }
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort by checkout time (earliest first)
    expiring.sort((a, b) => new Date(a.checkout_datetime).getTime() - new Date(b.checkout_datetime).getTime());

    return NextResponse.json({
      count: expiring.length,
      bookings: expiring
    });
  } catch (err) {
    console.error("[API_BOOKINGS_EXPIRING_ERROR]", err);
    return internalError();
  }
}
