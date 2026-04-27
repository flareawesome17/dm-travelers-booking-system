import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { toMoneyNumber } from "@/lib/bookingTotals";
import { z } from "zod";

const patchExtraSchema = z.object({
  days: z.number().int().min(1).max(365).optional(),
  quantity: z.number().int().min(1).max(20).optional(),
}).strict().refine((d) => d.days !== undefined || d.quantity !== undefined, "Must provide days or quantity");

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; extraId: string }> }
) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, extraId } = await params;
    const body = patchExtraSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get existing extra
    const { data: extra, error: eErr } = await supabase
      .from("booking_extras")
      .select("id, quantity, unit_price, days, total_price, booking_id")
      .eq("id", extraId)
      .eq("booking_id", id)
      .single();

    if (eErr || !extra) return dbError(eErr, "Extra not found");

    const newDays = body.data.days ?? extra.days;
    const newQty = body.data.quantity ?? extra.quantity;
    const newTotal = newQty * toMoneyNumber(extra.unit_price) * newDays;
    const oldTotal = toMoneyNumber(extra.total_price);

    // Update extra
    const { data: updated, error: upErr } = await supabase
      .from("booking_extras")
      .update({
        days: newDays,
        quantity: newQty,
        total_price: newTotal,
      })
      .eq("id", extraId)
      .select()
      .single();

    if (upErr) return dbError(upErr, "Failed to update extra");

    // Adjust booking extras_total and balance_due
    const diff = newTotal - oldTotal;
    if (diff !== 0) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("extras_total, balance_due")
        .eq("id", id)
        .single();

      if (booking) {
        await supabase
          .from("bookings")
          .update({
            extras_total: Math.max(0, toMoneyNumber(booking.extras_total) + diff),
            balance_due: Math.max(0, toMoneyNumber(booking.balance_due) + diff),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }
    }

    return NextResponse.json(updated);
  } catch {
    return internalError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; extraId: string }> }
) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, extraId } = await params;
    const supabase = getSupabaseAdmin();

    // Get extra to know its total_price
    const { data: extra, error: eErr } = await supabase
      .from("booking_extras")
      .select("id, total_price, booking_id")
      .eq("id", extraId)
      .eq("booking_id", id)
      .single();

    if (eErr || !extra) return dbError(eErr, "Extra not found");

    // Delete
    const { error: delErr } = await supabase
      .from("booking_extras")
      .delete()
      .eq("id", extraId);

    if (delErr) return dbError(delErr, "Failed to delete extra");

    // Update booking extras_total
    const { data: booking } = await supabase
      .from("bookings")
      .select("extras_total, balance_due")
      .eq("id", id)
      .single();

    if (booking) {
      const extraTotal = toMoneyNumber(extra.total_price);
      const newTotal = Math.max(0, toMoneyNumber(booking.extras_total) - extraTotal);
      const newBalance = Math.max(0, toMoneyNumber(booking.balance_due) - extraTotal);
      await supabase
        .from("bookings")
        .update({
          extras_total: newTotal,
          balance_due: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return internalError();
  }
}
