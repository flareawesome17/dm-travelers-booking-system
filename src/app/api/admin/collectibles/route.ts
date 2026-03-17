import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.view");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    // Fetch all active bookings (not cancelled) with a balance > 0
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, guests(*), rooms(*)")
      .neq("status", "Cancelled")
      .gt("balance_due", 0)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let lguCollectibles = 0;
    let regularCollectibles = 0;
    let totalCollectibles = 0;

    const lguBookings: any[] = [];
    const regularBookings: any[] = [];

    bookings?.forEach((b) => {
      const balance = Number(b.balance_due || 0);
      totalCollectibles += balance;
      if (b.is_lgu_booking) {
        lguCollectibles += balance;
        lguBookings.push(b);
      } else {
        regularCollectibles += balance;
        regularBookings.push(b);
      }
    });

    return NextResponse.json({
      summary: {
        totalCollectibles,
        lguCollectibles,
        regularCollectibles,
      },
      data: {
        all: bookings || [],
        lgu: lguBookings,
        regular: regularBookings,
      }
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
