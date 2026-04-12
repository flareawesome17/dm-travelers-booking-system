import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, internalError, parseAndValidate } from "@/lib/api-security";
import { transferBookingRoomSchema } from "@/lib/validation-schemas";
import { broadcastSystemMessage } from "@/lib/activity-hub";
import { calculateBookingRoomSubtotal, toMoneyNumber } from "@/lib/bookingTotals";
import { syncReceivableForBooking } from "@/lib/receivables";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getTransferErrorStatus(code: string) {
  if (code === "same_room") return 409;
  return 422;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.update");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, transferBookingRoomSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { target_room_id, reason } = parsed.data;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        reference_number,
        status,
        room_id,
        rate_plan_kind,
        check_in_date,
        check_out_date,
        total_amount,
        deposit_paid,
        balance_due,
        restaurant_charges_total,
        extras_total,
        extensions_total,
        early_checkin_fee_applied,
        late_checkout_fee_applied,
        discount_value,
        discount_type,
        discount_amount,
        is_lgu_booking,
        is_special_booking,
        special_booking_label
      `)
      .eq("id", id)
      .single();

    if (bookingError || !booking) return dbError(bookingError, "Booking not found");

    const shouldReprice = booking.status !== "Checked-In";
    let nextTotalAmount: number | null = null;
    let nextDiscountAmount: number | null = null;
    let nextBalanceDue: number | null = null;

    if (shouldReprice) {
      const { data: targetRoom, error: targetRoomError } = await supabase
        .from("rooms")
        .select(`
          rate_24h_enabled,
          rate_24h_price,
          rate_12h_enabled,
          rate_12h_price,
          rate_5h_enabled,
          rate_5h_price,
          rate_3h_enabled,
          rate_3h_price,
          lgu_rate_enabled,
          lgu_rate_24h_price,
          lgu_rate_12h_price,
          lgu_rate_5h_price,
          lgu_rate_3h_price
        `)
        .eq("id", target_room_id)
        .single();

      if (targetRoomError || !targetRoom) return dbError(targetRoomError, "Failed to load target room pricing");

      const subtotalBeforeDiscount =
        calculateBookingRoomSubtotal({
          room: targetRoom,
          ratePlanKind: String(booking.rate_plan_kind ?? "24h"),
          checkInDate: String(booking.check_in_date ?? ""),
          checkOutDate: String(booking.check_out_date ?? booking.check_in_date ?? ""),
          isLguBooking: Boolean(booking.is_lgu_booking),
        });

      if (subtotalBeforeDiscount == null) {
        return apiError(
          "unsupported_rate_plan",
          "Target room does not support this booking's current rate plan.",
          422,
        );
      }

      const discountType = String(booking.discount_type ?? "fixed").toLowerCase();
      const discountValue = toMoneyNumber(booking.discount_value);
      nextDiscountAmount = roundMoney(
        Math.max(
          0,
          discountType === "percent"
            ? (subtotalBeforeDiscount * discountValue) / 100
            : discountValue,
        ),
      );
      nextTotalAmount = roundMoney(Math.max(0, subtotalBeforeDiscount - nextDiscountAmount));

      const grandTotal = roundMoney(
        nextTotalAmount +
        toMoneyNumber(booking.restaurant_charges_total) +
        toMoneyNumber(booking.extras_total) +
        toMoneyNumber(booking.extensions_total) +
        toMoneyNumber(booking.early_checkin_fee_applied) +
        toMoneyNumber(booking.late_checkout_fee_applied),
      );
      nextBalanceDue = roundMoney(Math.max(0, grandTotal - toMoneyNumber(booking.deposit_paid)));
    }

    const { data: transferResult, error: transferError } = await supabase.rpc("transfer_booking_room", {
      p_booking_id: id,
      p_target_room_id: target_room_id,
      p_admin_id: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
      p_reason: reason ?? null,
      p_reprice: shouldReprice,
      p_new_total_amount: nextTotalAmount,
      p_new_discount_amount: nextDiscountAmount,
      p_new_balance_due: nextBalanceDue,
    });

    if (transferError) return dbError(transferError, "Failed to transfer booking room");

    const transfer = typeof transferResult === "object" && transferResult !== null
      ? transferResult as Record<string, unknown>
      : null;

    if (!transfer || transfer.ok !== true) {
      return NextResponse.json(
        {
          error: {
            code: String(transfer?.error_code || "transfer_failed"),
            message: String(transfer?.error_message || "Room transfer failed."),
          },
        },
        { status: getTransferErrorStatus(String(transfer?.error_code || "")) },
      );
    }

    const { data: updatedBooking, error: updatedBookingError } = await supabase
      .from("bookings")
      .select("*, guests(*), rooms(*), restaurant_orders:restaurant_orders(*)")
      .eq("id", id)
      .single();

    if (updatedBookingError || !updatedBooking) {
      return dbError(updatedBookingError, "Room transferred, but failed to load updated booking");
    }

    let receivableSync: Awaited<ReturnType<typeof syncReceivableForBooking>> | null = null;
    if (updatedBooking.is_lgu_booking || updatedBooking.is_special_booking) {
      receivableSync = await syncReceivableForBooking(supabase, {
        id: updatedBooking.id,
        balance_due: updatedBooking.balance_due,
        is_lgu_booking: updatedBooking.is_lgu_booking,
        is_special_booking: updatedBooking.is_special_booking,
        special_booking_label: updatedBooking.special_booking_label,
      });
    }

    broadcastSystemMessage({
      content: `Booking ${updatedBooking.reference_number || updatedBooking.id} moved from Room ${String(transfer.old_room_number || "?")} to Room ${String(transfer.new_room_number || "?")}.`,
      category: "booking",
      metadata: {
        booking_id: updatedBooking.id,
        action: "transfer_room",
        old_room_id: transfer.old_room_id,
        new_room_id: transfer.new_room_id,
        repriced: transfer.repriced,
      },
    }, supabase).catch(() => {});

    return NextResponse.json({
      ...updatedBooking,
      receivable_sync: receivableSync,
      transfer,
    });
  } catch (error) {
    console.error("[BOOKING_TRANSFER_ERROR]", error);
    return internalError();
  }
}
