import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createBookingExtrasSchema } from "@/lib/validation-schemas";
import { toMoneyNumber } from "@/lib/bookingTotals";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("booking_extras")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false });

    if (error) return dbError(error, "Failed to load extras");
    return NextResponse.json(data ?? []);
  } catch {
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createBookingExtrasSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const body = parsed.data;
    const supabase = getSupabaseAdmin();

    // Verify booking exists
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, extras_total, balance_due")
      .eq("id", id)
      .single();

    if (bErr || !booking) return dbError(bErr, "Booking not found");

    // Build rows
    const rows = body.extras.map((e) => ({
      booking_id: id,
      extra_type: e.extra_type,
      custom_label: e.extra_type === "Custom Charge" ? e.custom_label?.trim() || null : null,
      quantity: e.quantity,
      unit_price: e.unit_price,
      days: e.days ?? 1,
      total_price: e.quantity * e.unit_price * (e.days ?? 1),
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("booking_extras")
      .insert(rows)
      .select();

    if (insErr) return dbError(insErr, "Failed to add extras");

    // Update extras_total AND balance_due on booking
    const addedTotal = rows.reduce((sum, r) => sum + r.total_price, 0);
    const newExtrasTotal = toMoneyNumber(booking.extras_total) + addedTotal;
    const newBalance = toMoneyNumber(booking.balance_due) + addedTotal;

    const { error: upErr } = await supabase
      .from("bookings")
      .update({
        extras_total: newExtrasTotal,
        balance_due: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) console.error("[EXTRAS_UPDATE_ERROR]", upErr);

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error("[EXTRAS_ERROR]", err);
    return internalError();
  }
}
