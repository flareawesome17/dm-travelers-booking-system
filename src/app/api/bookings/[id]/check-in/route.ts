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

    const actualCheckIn = body.actual_check_in_at ? new Date(body.actual_check_in_at) : new Date();

    // Get booking with room info for fee calculation
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*, rooms(*)")
      .eq("id", id)
      .single();
    if (bErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    if (!booking.room_id) {
      return NextResponse.json({ error: "No room assigned to this booking." }, { status: 400 });
    }

    const roomStatus = booking.rooms?.status;
    if (roomStatus !== "Available") {
      return NextResponse.json(
        { error: `Room is not ready for check-in. Current status: ${roomStatus || "Unknown"}.` },
        { status: 400 }
      );
    }

    const { data: lockedRoom, error: roomLockErr } = await supabase
      .from("rooms")
      .update({ status: "Occupied", updated_at: new Date().toISOString() })
      .eq("id", booking.room_id)
      .eq("status", "Available")
      .select("id")
      .limit(1);
    if (roomLockErr) return NextResponse.json({ error: roomLockErr.message }, { status: 500 });
    if (!lockedRoom || lockedRoom.length === 0) {
      return NextResponse.json({ error: "Room is no longer available for check-in." }, { status: 400 });
    }

    let earlyFee = 0;
    if (booking.rate_plan_kind === "24h" && booking.check_in_date) {
      const reserved = new Date(`${String(booking.check_in_date).slice(0, 10)}T14:00:00`);
      const rate = Number(booking.rooms?.rate_24h_early_checkin_fee || 0);
      if (rate > 0 && actualCheckIn < reserved) {
        const hoursEarly = Math.max(1, Math.ceil((reserved.getTime() - actualCheckIn.getTime()) / (1000 * 60 * 60)));
        earlyFee = rate * hoursEarly;
      }
    }

    const updateData: Record<string, unknown> = {
      status: "Checked-In",
      actual_check_in_at: actualCheckIn.toISOString(),
    };
    if (earlyFee > 0) {
      updateData.early_checkin_fee_applied = earlyFee;
      updateData.total_amount = Number(booking.total_amount || 0) + earlyFee;
      updateData.balance_due = Number(booking.balance_due || 0) + earlyFee;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) {
      await supabase
        .from("rooms")
        .update({ status: "Available", updated_at: new Date().toISOString() })
        .eq("id", booking.room_id)
        .eq("status", "Occupied");
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ...data, early_checkin_fee_applied: earlyFee });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
