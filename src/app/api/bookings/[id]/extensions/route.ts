import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { getExtensionCost } from "@/lib/bookingExtensionPricing";
import { createExtensionSchema } from "@/lib/validation-schemas";
import { toMoneyNumber } from "@/lib/bookingTotals";
import { getExtensionConflictResult } from "@/lib/bookingExtensionConflicts";

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
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("id, room_id, check_out_date, reserved_checkout_datetime, actual_check_in_at, rate_plan_kind")
        .eq("id", id)
        .single();
      
      if (bErr || !booking) return dbError(bErr, "Booking not found");

      try {
        const result = await getExtensionConflictResult({
          supabase,
          currentBooking: booking,
          newCheckout,
        });

        return NextResponse.json(result);
      } catch (conflictError) {
        console.error("[AVAILABILITY_CHECK_ERROR]", conflictError);
        return dbError(conflictError, "Failed to check availability");
      }
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
      .select("id, status, room_id, extensions_total, balance_due, check_out_date, reserved_checkout_datetime, actual_check_in_at, rate_plan_kind, is_lgu_booking")
      .eq("id", id)
      .single();

    if (bErr || !booking) return dbError(bErr, "Booking not found");
    if (booking.status !== "Checked-In") {
      return NextResponse.json(
        { error: { code: "invalid_state", message: "Only checked-in bookings can be extended" } },
        { status: 422 }
      );
    }

    let conflictResult;
    try {
      conflictResult = await getExtensionConflictResult({
        supabase,
        currentBooking: booking,
        newCheckout: body.new_checkout_date,
      });
    } catch (conflictErr) {
      return dbError(conflictErr, "Failed to verify room availability");
    }

    if (!conflictResult.available) {
      return NextResponse.json(
        { error: { code: "room_conflict", message: "Room is already reserved for a future guest during this extension period." } },
        { status: 422 }
      );
    }

    if (!booking.room_id) {
      return NextResponse.json(
        { error: { code: "room_missing", message: "Booking has no room assigned for extension pricing." } },
        { status: 422 }
      );
    }

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select(`
        rate_24h_price,
        rate_12h_price,
        rate_5h_price,
        rate_3h_price,
        rate_24h_late_checkout_fee,
        rate_12h_late_checkout_fee,
        rate_5h_late_checkout_fee,
        rate_3h_late_checkout_fee,
        lgu_rate_enabled,
        lgu_rate_24h_price,
        lgu_rate_12h_price,
        lgu_rate_5h_price,
        lgu_rate_3h_price
      `)
      .eq("id", booking.room_id)
      .single();

    if (roomErr || !room) return dbError(roomErr, "Failed to load room pricing");

    const { hourlyRate, dailyRate, additionalCost } = getExtensionCost({
      room,
      ratePlanKind: booking.rate_plan_kind,
      isLguBooking: booking.is_lgu_booking,
      durationType: body.duration_type,
      durationValue: body.duration_value,
    });

    if (body.duration_type === "hours" && hourlyRate <= 0) {
      return NextResponse.json(
        { error: { code: "pricing_not_configured", message: "No late check-out hourly rate is configured for this room." } },
        { status: 422 }
      );
    }

    if (body.duration_type === "days" && dailyRate <= 0) {
      return NextResponse.json(
        { error: { code: "pricing_not_configured", message: "No daily extension rate is configured for this room." } },
        { status: 422 }
      );
    }

    const addedCost = toMoneyNumber(Math.round(additionalCost * 100) / 100);

    // Insert extension record
    const { data: ext, error: extErr } = await supabase
      .from("booking_extensions")
      .insert({
        booking_id: id,
        duration_type: body.duration_type,
        duration_value: body.duration_value,
        additional_cost: addedCost,
        new_checkout_date: body.new_checkout_date,
        approved_by_admin_id: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
      })
      .select()
      .single();

    if (extErr) return dbError(extErr, "Failed to create extension");

    // Update booking totals
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
