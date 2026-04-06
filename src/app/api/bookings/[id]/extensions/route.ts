import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createExtensionSchema } from "@/lib/validation-schemas";
import { toMoneyNumber } from "@/lib/bookingTotals";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const checkOnly = url.searchParams.get("check_only") === "true";
    const newCheckout = url.searchParams.get("new_checkout");

    const supabase = getSupabaseAdmin();

    if (checkOnly && newCheckout) {
      // Perform availability check
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("id, room_id, check_out_date, reserved_checkout_datetime")
        .eq("id", id)
        .single();
      
      if (bErr || !booking) return dbError(bErr, "Booking not found");
      if (!booking.room_id) {
        return NextResponse.json({ available: true, conflict_count: 0 });
      }

      const currentCheckout = booking.reserved_checkout_datetime || (booking.check_out_date ? `${booking.check_out_date}T12:00:00+08:00` : null);
      if (!currentCheckout) {
         return NextResponse.json({ available: true, conflict_count: 0 });
      }

      const { count, error: cErr } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("room_id", booking.room_id)
        .neq("id", id)
        .in("status", ["Confirmed", "Checked-In"])
        .lt("reserved_checkin_datetime", newCheckout)
        .gt("reserved_checkout_datetime", currentCheckout);

      if (cErr) {
        console.error("[AVAILABILITY_CHECK_ERROR]", cErr);
        return dbError(cErr, "Failed to check availability");
      }

      return NextResponse.json({ 
        available: (count ?? 0) === 0,
        conflict_count: count ?? 0 
      });
    }

    const { data, error } = await supabase
      .from("booking_extensions")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false });

    if (error) return dbError(error, "Failed to load extensions");
    return NextResponse.json(data ?? []);
  } catch {
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createExtensionSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const body = parsed.data;
    const supabase = getSupabaseAdmin();

    // Verify booking exists and is Checked-In
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, status, room_id, extensions_total, balance_due, check_out_date, reserved_checkout_datetime")
      .eq("id", id)
      .single();

    if (bErr || !booking) return dbError(bErr, "Booking not found");
    if (booking.status !== "Checked-In") {
      return NextResponse.json(
        { error: { code: "invalid_state", message: "Only checked-in bookings can be extended" } },
        { status: 422 }
      );
    }

    // New Conflict Check
    const { count: conflictCount, error: conflictErr } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("room_id", booking.room_id)
      .neq("id", id)
      .in("status", ["Confirmed", "Checked-In"])
      .lt("reserved_checkin_datetime", body.new_checkout_date)
      .gt("reserved_checkout_datetime", booking.reserved_checkout_datetime);

    if (conflictErr) return dbError(conflictErr, "Failed to verify room availability");
    
    // Safety check for nulls
    const currentCheckout = booking.reserved_checkout_datetime || (booking.check_out_date ? `${booking.check_out_date}T12:00:00+08:00` : null);
    
    if (currentCheckout && (conflictCount ?? 0) > 0) {
      return NextResponse.json(
        { error: { code: "room_conflict", message: "Room is already reserved for a future guest during this extension period." } },
        { status: 422 }
      );
    }

    // Insert extension record
    const { data: ext, error: extErr } = await supabase
      .from("booking_extensions")
      .insert({
        booking_id: id,
        duration_type: body.duration_type,
        duration_value: body.duration_value,
        additional_cost: body.additional_cost,
        new_checkout_date: body.new_checkout_date,
        approved_by_admin_id: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
      })
      .select()
      .single();

    if (extErr) return dbError(extErr, "Failed to create extension");

    // Update booking totals
    const addedCost = toMoneyNumber(body.additional_cost);
    const newExtensionsTotal = toMoneyNumber(booking.extensions_total) + addedCost;
    const newBalanceDue = toMoneyNumber(booking.balance_due) + addedCost;
    const { error: upErr } = await supabase
      .from("bookings")
      .update({
        extensions_total: newExtensionsTotal,
        balance_due: newBalanceDue,
        check_out_date: body.new_checkout_date.slice(0, 10),
        reserved_checkout_datetime: body.new_checkout_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) console.error("[EXTENSION_UPDATE_ERROR]", upErr);

    return NextResponse.json(ext, { status: 201 });
  } catch (err) {
    console.error("[EXTENSION_ERROR]", err);
    return internalError();
  }
}
