import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createBookingSchema } from "@/lib/validation-schemas";
import { syncReceivableForBooking } from "@/lib/receivables";
import { addShiftTransaction } from "@/lib/shiftUtils";
import { broadcastSystemMessage } from "@/lib/activity-hub";
import { computeReservedDatetimes } from "@/lib/booking-dates";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("*, guests(*), rooms(*), booking_extras(*), restaurant_orders:restaurant_orders(*, restaurant_order_items(*))")
      .order("created_at", { ascending: false });

    if (error) return dbError(error, "Failed to load bookings");
    return NextResponse.json(data ?? []);
  } catch {
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createBookingSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const body = parsed.data;
    const supabase = getSupabaseAdmin();

    // Create guest first if guest info is provided
    let guestId = body.guest_id;
    if (!guestId && body.guest) {
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert(body.guest)
        .select()
        .single();
      if (guestError) return dbError(guestError, "Failed to create guest record");
      guestId = guest.id;
    }

    const totalAmount = Number(body.total_amount || 0);
    const depositPaid = Number(body.deposit_paid || 0);
    const computedBalance = body.balance_due != null ? Number(body.balance_due) : Math.max(0, totalAmount - depositPaid);
    const computedStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : depositPaid > 0
          ? "Confirmed"
          : "Pending Payment";

    const { reservedCheckin, reservedCheckout } = computeReservedDatetimes(
      body.check_in_date,
      body.check_out_date,
      body.rate_plan_kind
    );

    const bookingData = {
      guest_id: guestId,
      room_id: body.room_id,
      reference_number: body.reference_number || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      total_amount: totalAmount,
      deposit_paid: depositPaid,
      balance_due: computedBalance,
      status: computedStatus,
      room_type_requested: body.room_type_requested || "Standard",
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      reserved_checkin_datetime: reservedCheckin,
      reserved_checkout_datetime: reservedCheckout,
      num_adults: body.num_adults,
      num_children: body.num_children,
      special_requests: body.special_requests,
      rate_plan_kind: body.rate_plan_kind,
      // Enterprise features
      is_lgu_booking: body.is_lgu_booking ?? false,
      is_special_booking: body.is_special_booking ?? false,
      special_booking_label: body.is_special_booking ? (body.special_booking_label || null) : null,
      // Discounts (Feature 7)
      discount_value: body.discount_value || 0,
      discount_type: body.discount_type || "fixed",
      discount_amount: body.discount_amount || 0,
      discount_id: body.discount_id || null,
      cheque_number: body.cheque_number || null,
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) return dbError(error, "Failed to create booking");

    // Auto-create receivable for LGU or special bookings
    if (data?.id && (body.is_lgu_booking || body.is_special_booking)) {
      try {
        await syncReceivableForBooking(supabase, {
          id: data.id,
          balance_due: computedBalance,
          is_lgu_booking: body.is_lgu_booking,
          is_special_booking: body.is_special_booking,
          special_booking_label: body.special_booking_label,
        });
      } catch (recError) {
        console.error("[RECEIVABLE_CREATE_ERROR]", recError);
      }
    }

    // Insert Bookings Extras if included
    if (data?.id && body.extras && body.extras.length > 0) {
      const extrasToInsert = body.extras.map((extra: any) => ({
        booking_id: data.id,
        extra_type: extra.extra_type,
        custom_label: extra.extra_type === "Custom Charge" ? extra.custom_label?.trim() || null : null,
        quantity: extra.quantity,
        unit_price: extra.unit_price,
        total_price: extra.quantity * extra.unit_price,
      }));
      
      const { error: extrasError } = await supabase.from("booking_extras").insert(extrasToInsert);
      if (extrasError) console.error("[EXTRAS_CREATE_ERROR]", extrasError);
    }

    if (depositPaid > 0 && data?.id) {
      const method = body.deposit_method && ["Cash", "GCash", "Card", "Stripe", "PayPal", "Cheque"].includes(body.deposit_method) ? body.deposit_method : "Cash";
      const today = await manilaDateString();
      const accountingDate = await findNextOpenLedgerDate(supabase, today);
      const transactionId = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}-${String(data.reference_number || "REF").replace(/[^A-Z0-9_-]/gi, "")}`;

      const { data: paymentData, error: pErr } = await supabase.from("payments").insert({
        booking_id: data.id,
        transaction_id: transactionId,
        method,
        amount: depositPaid,
        type: "Deposit",
        status: "Success",
        accounting_date: accountingDate,
      }).select().single();

      if (pErr) {
        console.error("[DEPOSIT_ERROR]", pErr);
      } else if (paymentData) {
        try {
          await addShiftTransaction({
            source: "booking",
            referenceId: paymentData.id,
            description: `Booking Deposit (${method}): ${data.reference_number || data.id}`,
            amount: Number(depositPaid),
            type: "INCOME",
            performedBy: typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
            onFailure: "throw",
          });
        } catch (shiftError) {
          console.error("[DEPOSIT_SHIFT_SYNC_ERROR]", shiftError);
          // Payment was recorded in payments table but couldn't sync to shift ledger.
          // Instead of rolling back: keep the payment, warn the user.
          data._shift_sync_warning = "Deposit payment was saved but could not be recorded in the shift ledger. Please re-record this payment via the Record Payment action to sync it to the current shift.";
        }
      }
    }

    // ── Activity Hub: broadcast new booking notification ──
    try {
      const guestName = data.guests?.full_name || "A guest";
      const roomNumber = data.rooms?.room_number || "unassigned";
      await broadcastSystemMessage({
        content: `New booking created: ${guestName} in Room ${roomNumber} (${data.reference_number}). Total: ₱${Number(totalAmount).toLocaleString()}.`,
        category: "booking",
        metadata: { booking_id: data.id, reference_number: data.reference_number },
      }, supabase);
    } catch {
      // Non-critical
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[BOOKING_ERROR]", err);
    return internalError();
  }
}
