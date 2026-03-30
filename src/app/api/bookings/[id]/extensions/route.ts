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
    const supabase = getSupabaseAdmin();
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
      .select("id, status, extensions_total, balance_due, check_out_date, reserved_checkout_datetime")
      .eq("id", id)
      .single();

    if (bErr || !booking) return dbError(bErr, "Booking not found");
    if (booking.status !== "Checked-In") {
      return NextResponse.json(
        { error: { code: "invalid_state", message: "Only checked-in bookings can be extended" } },
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
