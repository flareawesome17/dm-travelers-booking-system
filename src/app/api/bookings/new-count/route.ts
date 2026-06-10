import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

/**
 * Returns the count of new public bookings (those with a public_booking_payment_session)
 * that were created after a given timestamp.
 *
 * Query params:
 *   since — ISO timestamp; only bookings created after this are counted.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const since = url.searchParams.get("since");

  const supabase = getSupabaseAdmin();

  // Count bookings that have a public payment session (i.e. came from the public site)
  // and were created after the "since" timestamp.
  let query = supabase
    .from("public_booking_payment_sessions")
    .select("booking_id", { count: "exact", head: true });

  if (since) {
    query = query.gt("created_at", since);
  }

  const { count, error } = await query;

  if (error) {
    console.error("[NEW_BOOKINGS_COUNT]", error);
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
