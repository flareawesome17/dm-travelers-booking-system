import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { syncReceivableForBooking } from "@/lib/receivables";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const allowedFields = [
      "status", "room_id", "check_in_date", "check_out_date",
      "num_adults", "num_children", "special_requests", "total_amount",
      "deposit_paid", "balance_due", "room_type_requested", "rate_plan_kind",
      "restaurant_charges_total",
      "is_lgu_booking", "is_special_booking", "special_booking_label",
      "extras_total", "extensions_total",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updateData[key] = body[key];
    }
    updateData.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .select("*, guests(*), rooms(*), restaurant_orders:restaurant_orders(*)")
      .single();

    if (error || !data) return dbError(error, "Failed to update booking");

    let receivableSync: Awaited<ReturnType<typeof syncReceivableForBooking>> | null = null;
    if (
      "is_lgu_booking" in body ||
      "is_special_booking" in body ||
      "special_booking_label" in body ||
      "balance_due" in body
    ) {
      receivableSync = await syncReceivableForBooking(supabase, {
        id: data.id,
        balance_due: data.balance_due,
        is_lgu_booking: data.is_lgu_booking,
        is_special_booking: data.is_special_booking,
        special_booking_label: data.special_booking_label,
      });
    }

    return NextResponse.json({ ...data, receivable_sync: receivableSync });
  } catch (error) {
    console.error("[BOOKING_UPDATE_ERROR]", error);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.delete");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return dbError(error, "Failed to delete booking");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[BOOKING_DELETE_ERROR]", error);
    return internalError();
  }
}
