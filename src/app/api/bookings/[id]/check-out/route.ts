import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { broadcastSystemMessage } from "@/lib/activity-hub";

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

    const { getGlobalTimeConfig } = await import("@/lib/settings");
    const { offset } = await getGlobalTimeConfig(supabase);
    const tzOffset = offset || "+08:00";

    let lateFee = 0;
    const rateKind = booking.rate_plan_kind || "24h";
    let reserved: Date;

    if (rateKind === "24h") {
      reserved = new Date(`${String(booking.check_out_date || "").slice(0, 10)}T12:00:00${tzOffset}`);
    } else {
      const hoursToAdd = parseInt(rateKind.replace(/\D/g, ""), 10) || 0;
      if (booking.actual_check_in_at) {
        reserved = new Date(booking.actual_check_in_at);
        reserved.setHours(reserved.getHours() + hoursToAdd);
      } else {
        const fallbackCheckIn = booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
        reserved = new Date(`${fallbackCheckIn}T14:00:00${tzOffset}`);
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
      updateData.balance_due = Number(booking.balance_due || 0) + lateFee;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let roomStatusWarning: string | null = null;

    // Mark the associated room as Dirty AFTER successful booking update.
    // Do not roll back the guest checkout if housekeeping status cannot be updated:
    // the guest has already left, and reverting to Checked-In makes overtime continue.
    if (booking.room_id) {
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "Dirty", updated_at: new Date().toISOString() })
        .eq("id", booking.room_id);

      if (roomError) {
        console.error("[CHECK_OUT_ROOM_STATUS_ERROR]", roomError);
        roomStatusWarning = "Guest was checked out, but the room status could not be changed to Dirty. Update housekeeping status manually.";
      }
    }

    // Broadcast check-out to Activity Hub
    const gName = data?.guests?.full_name || "Guest";
    const rNum = data?.rooms?.room_number || "?";
    broadcastSystemMessage({
      content: roomStatusWarning
        ? `${gName} has checked out of Room ${rNum}. Room status still needs manual housekeeping update.`
        : `${gName} has checked out of Room ${rNum}. Room is now marked as Dirty.`,
      category: "booking",
      metadata: { booking_id: id, action: "check_out", room_status_warning: roomStatusWarning },
    }, supabase).catch(() => {});

    return NextResponse.json({ ...data, late_checkout_fee_applied: lateFee, room_status_warning: roomStatusWarning });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
