import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const actualCheckOut = body.actual_check_out_at ? new Date(body.actual_check_out_at) : new Date();

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, rooms(*)")
      .eq("id", id)
      .single();
    if (bErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    let lateFee = 0;
    if (booking.check_out_date) {
      const reserved = new Date(`${String(booking.check_out_date).slice(0, 10)}T12:00:00`);
      const rateKind = booking.rate_plan_kind || "24h";
      let rate = 0;
      if (rateKind === "24h") rate = Number(booking.rooms?.rate_24h_late_checkout_fee || 0);
      else if (rateKind === "12h") rate = Number(booking.rooms?.rate_12h_late_checkout_fee || 0);
      else if (rateKind === "5h") rate = Number(booking.rooms?.rate_5h_late_checkout_fee || 0);
      else if (rateKind === "3h") rate = Number(booking.rooms?.rate_3h_late_checkout_fee || 0);
      if (rate > 0 && actualCheckOut > reserved) {
        const hoursLate = Math.max(1, Math.ceil((actualCheckOut.getTime() - reserved.getTime()) / (1000 * 60 * 60)));
        lateFee = rate * hoursLate;
      }
    }

    const updateData: Record<string, unknown> = {
      status: "Checked-Out",
      actual_check_out_at: actualCheckOut.toISOString(),
    };
    if (lateFee > 0) {
      updateData.late_checkout_fee_applied = lateFee;
      updateData.total_amount = Number(booking.total_amount || 0) + lateFee;
      updateData.balance_due = Number(booking.balance_due || 0) + lateFee;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .select("*, guests(*), rooms(*)")
      .single();

    // Mark the associated room as Dirty
    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "Dirty" }).eq("id", booking.room_id);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, late_checkout_fee_applied: lateFee });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
