import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "reports.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    // Fetch bookings that are either checked-in or arriving/active today, and have a positive balance
    // Actually, any booking not checked out or cancelled with a balance due is a receivable
    
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, reference_number, guest_id, check_in_date, check_out_date, status, total_amount, deposit_paid, balance_due, is_lgu_booking, is_special_booking, special_booking_label")
      .not("status", "eq", "Cancelled")
      .not("status", "eq", "Check-Out")
      .gt("balance_due", 0)
      .order("check_in_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      receivables: bookings || []
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch pending receivables" }, { status: 500 });
  }
}
