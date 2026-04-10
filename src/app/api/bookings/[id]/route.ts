import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { syncReceivableForBooking } from "@/lib/receivables";
import { computeReservedDatetimes } from "@/lib/booking-dates";
import { calculateBookingRoomSubtotal, toMoneyNumber } from "@/lib/bookingTotals";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

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
      "discount_value", "discount_type", "discount_amount", "discount_id",
      "cheque_number",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updateData[key] = body[key];
    }
    updateData.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const shouldRecalculatePricing = [
      "room_id",
      "check_in_date",
      "check_out_date",
      "rate_plan_kind",
      "is_lgu_booking",
      "discount_value",
      "discount_type",
      "deposit_paid",
      "restaurant_charges_total",
      "extras_total",
      "extensions_total",
      "early_checkin_fee_applied",
      "late_checkout_fee_applied",
    ].some((key) => key in body);
    
    // If dates changed, we must update reserved_datetimes too
    if ("check_in_date" in body || "check_out_date" in body || "rate_plan_kind" in body) {
      const { data: existing } = await supabase.from("bookings").select("check_in_date, check_out_date, rate_plan_kind, actual_check_in_at").eq("id", id).single();
      if (existing) {
        const cin = body.check_in_date || existing.check_in_date;
        const cout = body.check_out_date || existing.check_out_date;
        const rpk = body.rate_plan_kind || existing.rate_plan_kind;
        const { reservedCheckin, reservedCheckout } = computeReservedDatetimes(cin, cout, rpk, existing.actual_check_in_at);
        updateData.reserved_checkin_datetime = reservedCheckin;
        updateData.reserved_checkout_datetime = reservedCheckout;
      }
    }

    if (shouldRecalculatePricing) {
      const { data: existingBooking, error: existingBookingError } = await supabase
        .from("bookings")
        .select(`
          room_id,
          check_in_date,
          check_out_date,
          rate_plan_kind,
          is_lgu_booking,
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
          discount_amount
        `)
        .eq("id", id)
        .single();

      if (existingBookingError || !existingBooking) {
        return dbError(existingBookingError, "Failed to load booking for recalculation");
      }

      const targetRoomId = String(body.room_id ?? existingBooking.room_id ?? "");

      if (targetRoomId) {
        const { data: room, error: roomError } = await supabase
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
          .eq("id", targetRoomId)
          .single();

        if (roomError) {
          return dbError(roomError, "Failed to load room pricing");
        }

        const subtotalBeforeDiscount =
          calculateBookingRoomSubtotal({
            room,
            ratePlanKind: String(body.rate_plan_kind ?? existingBooking.rate_plan_kind ?? "24h"),
            checkInDate: String(body.check_in_date ?? existingBooking.check_in_date ?? ""),
            checkOutDate: String(body.check_out_date ?? existingBooking.check_out_date ?? body.check_in_date ?? existingBooking.check_in_date ?? ""),
            isLguBooking: Boolean(body.is_lgu_booking ?? existingBooking.is_lgu_booking),
          }) ??
          roundMoney(
            toMoneyNumber(existingBooking.total_amount) + toMoneyNumber(existingBooking.discount_amount),
          );

        const discountType = String(body.discount_type ?? existingBooking.discount_type ?? "fixed").toLowerCase();
        const discountValue = toMoneyNumber(body.discount_value ?? existingBooking.discount_value);
        const discountAmount = roundMoney(
          Math.max(
            0,
            discountType === "percent"
              ? (subtotalBeforeDiscount * discountValue) / 100
              : discountValue,
          ),
        );
        const roomTotal = roundMoney(Math.max(0, subtotalBeforeDiscount - discountAmount));

        const restaurantTotal = toMoneyNumber(body.restaurant_charges_total ?? existingBooking.restaurant_charges_total);
        const extrasTotal = toMoneyNumber(body.extras_total ?? existingBooking.extras_total);
        const extensionsTotal = toMoneyNumber(body.extensions_total ?? existingBooking.extensions_total);
        const earlyCheckInFee = toMoneyNumber(body.early_checkin_fee_applied ?? existingBooking.early_checkin_fee_applied);
        const lateCheckOutFee = toMoneyNumber(body.late_checkout_fee_applied ?? existingBooking.late_checkout_fee_applied);
        const depositPaid = toMoneyNumber(body.deposit_paid ?? existingBooking.deposit_paid);
        const grandTotal = roundMoney(
          roomTotal + restaurantTotal + extrasTotal + extensionsTotal + earlyCheckInFee + lateCheckOutFee,
        );

        updateData.total_amount = roomTotal;
        updateData.discount_amount = discountAmount;
        updateData.balance_due = roundMoney(Math.max(0, grandTotal - depositPaid));
      }
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", id)
      .select("*, guests(*), rooms(*), restaurant_orders:restaurant_orders(*)")
      .single();

    if (error || !data) return dbError(error, "Failed to update booking");

    // Handle guest updates if provided
    if (body.guest && data.guest_id) {
      const { error: guestError } = await supabase
        .from("guests")
        .update({
          full_name: body.guest.full_name,
          email: body.guest.email,
          phone_number: body.guest.phone_number,
        })
        .eq("id", data.guest_id);
      
      if (guestError) {
        console.error("[GUEST_UPDATE_ERROR]", guestError);
      } else {
        // Update local data object to reflect the guest changes in the response
        if (data.guests) {
          data.guests.full_name = body.guest.full_name || data.guests.full_name;
          data.guests.email = body.guest.email || data.guests.email;
          data.guests.phone_number = body.guest.phone_number || data.guests.phone_number;
        }
      }
    }

    let receivableSync: Awaited<ReturnType<typeof syncReceivableForBooking>> | null = null;
    if (
      "is_lgu_booking" in body ||
      "is_special_booking" in body ||
      "special_booking_label" in body ||
      "balance_due" in body ||
      "balance_due" in updateData
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
