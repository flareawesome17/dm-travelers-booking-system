import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
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
    const rateKind = booking.rate_plan_kind || "24h";
    let reserved: Date;

    if (rateKind === "24h") {
      reserved = new Date(`${String(booking.check_out_date || "").slice(0, 10)}T12:00:00`);
    } else {
      const hoursToAdd = parseInt(rateKind.replace(/\D/g, ""), 10) || 0;
      if (booking.actual_check_in_at) {
        reserved = new Date(booking.actual_check_in_at);
        reserved.setHours(reserved.getHours() + hoursToAdd);
      } else {
        const fallbackCheckIn = booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
        reserved = new Date(`${fallbackCheckIn}T14:00:00`);
        reserved.setHours(reserved.getHours() + hoursToAdd);
      }
    }

    if (!Number.isNaN(reserved.getTime())) {
      let rate = 0;
      if (rateKind === "24h") rate = Number(booking.rooms?.rate_24h_late_checkout_fee || 0);
      else if (rateKind === "12h") rate = Number(booking.rooms?.rate_12h_late_checkout_fee || 0);
      else if (rateKind === "5h") rate = Number(booking.rooms?.rate_5h_late_checkout_fee || 0);
      else if (rateKind === "3h") rate = Number(booking.rooms?.rate_3h_late_checkout_fee || 0);
      
      if (rate > 0 && actualCheckOut > reserved) {
        const diffMs = actualCheckOut.getTime() - reserved.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        // Only charge late fee if they are more than 30 minutes late
        if (diffMinutes > 30) {
          // Add 30-minute grace period per hour.
          // Example: 1h 30m delay (90 min) = 1 hour charge, 1h 31m delay (91 min) = 2 hours charge.
          const hoursLate = Math.ceil((diffMinutes - 30) / 60);
          lateFee = rate * hoursLate;
        }
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
