import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { toMoneyNumber } from "@/lib/bookingTotals";

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
