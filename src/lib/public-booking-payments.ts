import crypto from "crypto";
import { getBookingChargeBreakdown } from "@/lib/bookingTotals";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { sendMail } from "@/lib/mailer";
import { getPublicBookingConfig } from "@/lib/public-booking-config";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addShiftTransaction } from "@/lib/shiftUtils";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SettlePublicBookingPaymentParams = {
  supabase: SupabaseAdminClient;
  bookingId: string;
  paymentIntentId: string;
  paymentId: string;
  amountInCentavos: number;
  paidAtIso?: string | null;
  sendConfirmationEmail?: boolean;
};

function randomGuestQrToken(reference: string) {
  return `QR-${reference}-${crypto.randomBytes(8).toString("hex")}`.toUpperCase();
}

function toMoney(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Number(n.toFixed(2)));
}

export async function settlePublicBookingPayment(params: SettlePublicBookingPaymentParams) {
  const nowIso = new Date().toISOString();
  const amount = Math.max(0, Number((params.amountInCentavos / 100).toFixed(2)));
  if (amount <= 0) {
    return { ok: false as const, reason: "Invalid payment amount." };
  }

  const { data: booking, error: bookingError } = await params.supabase
    .from("bookings")
    .select(`
      id,
      reference_number,
      status,
      guest_qr_code,
      room_type_requested,
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
      guests(full_name, email)
    `)
    .eq("id", params.bookingId)
    .single();

  if (bookingError || !booking) {
    return { ok: false as const, reason: "Booking not found." };
  }

  const bookingStatus = String(booking.status || "");
  if (["Cancelled", "No Show", "Checked-Out"].includes(bookingStatus)) {
    return { ok: false as const, reason: "Booking is not payable." };
  }

  const { data: existingPayment } = await params.supabase
    .from("payments")
    .select("id")
    .eq("transaction_id", params.paymentId)
    .maybeSingle();

  if (!existingPayment) {
    const accountingDate = await findNextOpenLedgerDate(params.supabase, manilaDateString());
    const balanceDueNow = toMoney(booking.balance_due);
    const paymentType = amount >= balanceDueNow ? "Balance" : "Deposit";
    const paymentTimestamp = params.paidAtIso && !Number.isNaN(new Date(params.paidAtIso).getTime())
      ? params.paidAtIso
      : nowIso;

    const { data: paymentRecord, error: insertError } = await params.supabase.from("payments").insert({
      booking_id: params.bookingId,
      transaction_id: params.paymentId,
      method: "QRPh",
      amount,
      type: paymentType,
      status: "Success",
      transaction_time: paymentTimestamp,
      accounting_date: accountingDate,
    }).select("id").single();

    if (insertError || !paymentRecord) {
      return { ok: false as const, reason: "Failed to record payment." };
    }

    // Sync to Shift Ledger
    try {
      await addShiftTransaction({
        source: "booking",
        referenceId: paymentRecord.id,
        description: `Booking Payment (${paymentType}): ${booking.reference_number || params.bookingId}`,
        amount,
        type: "INCOME",
        performedBy: null,
        onFailure: "throw",
      });
    } catch (shiftError) {
      console.error("[PUBLIC_PAYMENT_SHIFT_SYNC_ERROR]", shiftError);
      // Payment is already recorded; shift sync failure is non-fatal for online payments.
    }
  }

  const { data: allPayments } = await params.supabase
    .from("payments")
    .select("amount")
    .eq("booking_id", params.bookingId)
    .eq("status", "Success");

  const totalPaid = Math.max(
    0,
    Number((allPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2))
  );
  const { grandTotal } = getBookingChargeBreakdown(booking);
  const config = await getPublicBookingConfig(params.supabase);
  const requiredDeposit = Number((grandTotal * (config.depositPercent / 100)).toFixed(2));
  const newBalance = Math.max(0, Number((grandTotal - totalPaid).toFixed(2)));
  const downpaymentSatisfied = totalPaid >= requiredDeposit;
  const newStatus = downpaymentSatisfied ? "Confirmed" : "Pending Payment";
  const shouldGenerateGuestQr = newStatus === "Confirmed" && !booking.guest_qr_code;
  const guestQrCode = shouldGenerateGuestQr ? randomGuestQrToken(String(booking.reference_number || "BOOKING")) : booking.guest_qr_code;

  const { error: bookingUpdateError } = await params.supabase
    .from("bookings")
    .update({
      deposit_paid: totalPaid,
      balance_due: newBalance,
      status: newStatus,
      guest_qr_code: guestQrCode,
      updated_at: nowIso,
    })
    .eq("id", params.bookingId);
  if (bookingUpdateError) {
    return { ok: false as const, reason: "Failed to update booking totals." };
  }

  await params.supabase
    .from("public_booking_payment_sessions")
    .update({
      status: newStatus === "Confirmed" ? "succeeded" : "processing",
      payment_id: params.paymentId,
      paid_at: params.paidAtIso || nowIso,
      failure_code: null,
      failure_message: null,
      updated_at: nowIso,
    })
    .eq("payment_intent_id", params.paymentIntentId);

  const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
  const guestEmail = typeof bookingGuest?.email === "string" ? bookingGuest.email.trim().toLowerCase() : "";
  const guestName = typeof bookingGuest?.full_name === "string" ? bookingGuest.full_name.trim() : "Valued Guest";
  const becameConfirmed = bookingStatus !== "Confirmed" && newStatus === "Confirmed";
  if (params.sendConfirmationEmail !== false && becameConfirmed && guestEmail) {
    // Fetch hotel contact + operations settings for the email
    const { data: settingsRows } = await params.supabase
      .from("settings")
      .select("key, value")
      .in("key", ["hotel_name", "hotel_phone", "hotel_email", "hotel_address", "hotel_website", "check_in_time", "check_out_time", "cancellation_policy"]);
    const settingsMap = new Map<string, string>();
    for (const row of settingsRows ?? []) {
      if (row.key) settingsMap.set(row.key, String(row.value ?? ""));
    }
    const hotelName = settingsMap.get("hotel_name")?.trim() || "D&M Travellers Inn";
    const hotelPhone = settingsMap.get("hotel_phone")?.trim() || "+63 951 868 3018";
    const hotelEmail = settingsMap.get("hotel_email")?.trim() || "info@dmtravelersinn.com";
    const hotelAddress = settingsMap.get("hotel_address")?.trim() || "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, Misamis Occidental";
    const hotelWebsite = settingsMap.get("hotel_website")?.trim() || "";
    const rawCheckIn = settingsMap.get("check_in_time")?.trim() || "14:00";
    const rawCheckOut = settingsMap.get("check_out_time")?.trim() || "12:00";
    const adminCancellationPolicy = settingsMap.get("cancellation_policy")?.trim() || "";

    // Format 24h "HH:mm" to readable "2:00 PM"
    const formatTime12h = (t: string) => {
      const [hStr, mStr] = t.split(":");
      let h = parseInt(hStr || "0", 10);
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${m} ${ampm}`;
    };
    const checkInTime = formatTime12h(rawCheckIn);
    const checkOutTime = formatTime12h(rawCheckOut);

    const checkInDisplay = String(booking.check_in_date).slice(0, 10);
    const checkOutDisplay = String(booking.check_out_date).slice(0, 10);
    const ref = String(booking.reference_number || "");
    const roomType = String(booking.room_type_requested || "");
    const totalDisplay = toMoney(booking.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 });
    const paidDisplay = totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 });
    const balanceDisplay = newBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 });

    const contactLine = [
      hotelPhone ? `Phone: ${hotelPhone}` : "",
      hotelEmail ? `Email: ${hotelEmail}` : "",
      hotelWebsite ? `Website: ${hotelWebsite}` : "",
    ].filter(Boolean).join(" | ");

    const plainText = [
      `Dear ${guestName},`,
      ``,
      `Thank you for choosing ${hotelName}! Your reservation has been confirmed and we look forward to welcoming you.`,
      ``,
      `--- RESERVATION DETAILS ---`,
      `Reference No: ${ref}`,
      `Room Type: ${roomType}`,
      `Check-in: ${checkInDisplay}`,
      `Check-out: ${checkOutDisplay}`,
      `Total Amount: PHP ${totalDisplay}`,
      `Deposit Paid: PHP ${paidDisplay}`,
      `Balance Due: PHP ${balanceDisplay}`,
      `Payment Method: QRPh`,
      ``,
      `--- CHECK-IN & CHECK-OUT POLICY ---`,
      `• Standard check-in time is ${checkInTime}.`,
      `• Standard check-out time is ${checkOutTime}.`,
      `• Early check-in (before ${checkInTime}) is subject to availability and may incur an additional fee. Please contact the front desk in advance to request early check-in.`,
      `• Late check-out (after ${checkOutTime}) is subject to availability and may incur an additional fee. Please inform the front desk during your stay if you wish to extend.`,
      ``,
      `--- PAYMENT & BALANCE ---`,
      `Your deposit of PHP ${paidDisplay} has been received. The remaining balance of PHP ${balanceDisplay} must be settled at the front desk upon check-in. We accept Cash, Card, and E-wallets at the front desk.`,
      ``,
      `--- WHAT TO BRING ---`,
      `Please bring a valid government-issued ID (passport, driver's license, national ID, etc.) for identity verification at check-in. This is required for all guests.`,
      ``,
      `--- CANCELLATION POLICY ---`,
      adminCancellationPolicy || `All down payments are strictly non-refundable. Any cancellation of a confirmed booking will result in the forfeiture of the down payment.`,
      ``,
      `--- EXTRA REQUESTS ---`,
      `Need an extra bed, extra pillow, extra person, or other special arrangements? You may request by:`,
      `• Calling the front desk: ${hotelPhone}`,
      hotelEmail ? `• Emailing us: ${hotelEmail}` : "",
      `• Visiting us at: ${hotelAddress}`,
      `Extra charges may apply depending on the request.`,
      ``,
      `--- NEED HELP OR CHANGES? ---`,
      `For any changes to your reservation, questions, or concerns, please contact us:`,
      contactLine,
      `Address: ${hotelAddress}`,
      `Our front desk is available 24/7 to assist you.`,
      ``,
      `See you soon!`,
      `The ${hotelName} Team`,
    ].filter((line) => line !== undefined).join("\n");

    const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f0ede6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ede6;padding:24px 12px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

<!-- HEADER -->
<tr>
<td style="background:linear-gradient(135deg,#0b1a2e 0%,#132d4a 100%);padding:36px 32px 28px;text-align:center;">
  <p style="margin:0;font-size:11px;letter-spacing:3.5px;text-transform:uppercase;color:#c9a96e;font-weight:600;">${hotelName}</p>
  <h1 style="margin:16px 0 0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">Booking Confirmed ✓</h1>
  <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">Your reservation is secured. We look forward to welcoming you!</p>
</td>
</tr>

<!-- GREETING -->
<tr>
<td style="padding:28px 32px 0;">
  <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.6;">Dear <strong>${guestName}</strong>,</p>
  <p style="margin:10px 0 0;font-size:14px;color:#4a4a4a;line-height:1.7;">Thank you for choosing <strong>${hotelName}</strong>! Your payment has been successfully received and your reservation is now confirmed.</p>
</td>
</tr>

<!-- RESERVATION DETAILS -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf8f4;border:1px solid #e8e2d6;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:#0b1a2e;padding:14px 20px;">
        <p style="margin:0;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#c9a96e;font-weight:600;">Reservation Details</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;width:140px;vertical-align:top;">Reference No.</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:700;letter-spacing:0.5px;">${ref}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Room Type</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${roomType}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Check-in</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${checkInDisplay} <span style="color:#888;font-weight:400;font-size:12px;">(from ${checkInTime})</span></td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Check-out</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${checkOutDisplay} <span style="color:#888;font-weight:400;font-size:12px;">(by ${checkOutTime})</span></td>
          </tr>
          <tr><td colspan="2" style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e8e2d6;margin:0;"/></td></tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Total Amount</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-weight:600;">PHP ${totalDisplay}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Deposit Paid</td>
            <td style="padding:6px 0;font-size:14px;color:#2e7d32;font-weight:700;">PHP ${paidDisplay}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Balance Due</td>
            <td style="padding:6px 0;font-size:14px;color:#c0392b;font-weight:700;">PHP ${balanceDisplay}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#888;vertical-align:top;">Payment Method</td>
            <td style="padding:6px 0;font-size:14px;color:#1a1a1a;">QRPh (Online)</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CHECK-IN & CHECK-OUT POLICY -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f8fb;border:1px solid #d6e4ef;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0b1a2e;">🕐 Check-in &amp; Check-out Policy</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#3a3a3a;line-height:1.7;">
          <tr><td style="padding:3px 0;padding-left:8px;">• Standard <strong>check-in</strong> time is <strong>${checkInTime}</strong>.</td></tr>
          <tr><td style="padding:3px 0;padding-left:8px;">• Standard <strong>check-out</strong> time is <strong>${checkOutTime}</strong>.</td></tr>
          <tr><td style="padding:3px 0;padding-left:8px;">• <strong>Early check-in</strong> (before ${checkInTime}) is subject to availability and may incur an additional fee. Please contact the front desk in advance.</td></tr>
          <tr><td style="padding:3px 0;padding-left:8px;">• <strong>Late check-out</strong> (after ${checkOutTime}) is subject to availability and may incur an additional fee. Please inform the front desk during your stay.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- PAYMENT & BALANCE -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9faf4;border:1px solid #dde4d0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2e5016;">💰 Payment &amp; Balance</p>
        <p style="margin:0;font-size:13px;color:#3a3a3a;line-height:1.7;">Your deposit of <strong>PHP ${paidDisplay}</strong> has been received. ${newBalance > 0 ? `The remaining balance of <strong style="color:#c0392b;">PHP ${balanceDisplay}</strong> must be settled at the front desk upon check-in.` : `Your booking is fully paid. No remaining balance.`}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#3a3a3a;line-height:1.7;">We accept <strong>Cash, Card, and E-wallets</strong> at the front desk.</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- WHAT TO BRING -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef9f0;border:1px solid #f0e0c0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#8b6914;">🪪 What to Bring</p>
        <p style="margin:0;font-size:13px;color:#3a3a3a;line-height:1.7;">Please bring a <strong>valid government-issued ID</strong> (passport, driver's license, national ID, etc.) for identity verification at check-in. This is <strong>required for all guests</strong>.</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CANCELLATION POLICY -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fdf4f4;border:1px solid #f0d0d0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#b91c1c;">⚠️ Cancellation Policy</p>
        <p style="margin:0;font-size:13px;color:#3a3a3a;line-height:1.7;white-space:pre-line;">${(adminCancellationPolicy || "All down payments are strictly non-refundable.\nAny cancellation of a confirmed booking will result in the forfeiture of the down payment.").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- EXTRA REQUESTS -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f9;border:1px solid #d6d6e8;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#3b3680;">🛏️ Extra Requests</p>
        <p style="margin:0 0 10px;font-size:13px;color:#3a3a3a;line-height:1.7;">Need an extra bed, extra pillow, extra person, or other special arrangements? You may request by:</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#3a3a3a;line-height:1.8;">
          <tr><td style="padding:2px 0;padding-left:8px;">📞 Calling the front desk: <strong>${hotelPhone}</strong></td></tr>
          ${hotelEmail ? `<tr><td style="padding:2px 0;padding-left:8px;">📧 Emailing us: <a href="mailto:${hotelEmail}" style="color:#3b3680;font-weight:600;">${hotelEmail}</a></td></tr>` : ""}
          <tr><td style="padding:2px 0;padding-left:8px;">📍 Visiting us at: <strong>${hotelAddress}</strong></td></tr>
        </table>
        <p style="margin:10px 0 0;font-size:12px;color:#888;line-height:1.5;font-style:italic;">Extra charges may apply depending on the request.</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- NEED HELP -->
<tr>
<td style="padding:24px 32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f8f0;border:1px solid #c8e0c8;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1b6e1b;">📞 Need Help or Changes?</p>
        <p style="margin:0 0 10px;font-size:13px;color:#3a3a3a;line-height:1.7;">For any changes to your reservation, questions, or special concerns, please don't hesitate to reach out:</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#3a3a3a;line-height:1.8;">
          <tr><td style="padding:2px 0;padding-left:8px;">📞 Phone: <strong>${hotelPhone}</strong></td></tr>
          ${hotelEmail ? `<tr><td style="padding:2px 0;padding-left:8px;">📧 Email: <a href="mailto:${hotelEmail}" style="color:#1b6e1b;font-weight:600;">${hotelEmail}</a></td></tr>` : ""}
          ${hotelWebsite ? `<tr><td style="padding:2px 0;padding-left:8px;">🌐 Website: <a href="${hotelWebsite}" style="color:#1b6e1b;font-weight:600;">${hotelWebsite}</a></td></tr>` : ""}
          <tr><td style="padding:2px 0;padding-left:8px;">📍 Location: ${hotelAddress}</td></tr>
        </table>
        <p style="margin:10px 0 0;font-size:13px;color:#3a3a3a;line-height:1.5;">Our front desk is available <strong>24/7</strong> to assist you.</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:28px 32px 0;">
  <p style="margin:0;text-align:center;font-size:16px;color:#0b1a2e;font-weight:700;">See you soon! 🏨</p>
  <p style="margin:6px 0 0;text-align:center;font-size:13px;color:#888;">The ${hotelName} Team</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 28px;">
  <hr style="border:none;border-top:1px solid #e8e2d6;margin:0 0 16px;"/>
  <p style="margin:0;text-align:center;font-size:11px;color:#aaa;line-height:1.6;">
    &copy; ${new Date().getFullYear()} ${hotelName}. All rights reserved.<br/>
    ${hotelAddress}<br/><br/>
    <span style="font-size:10px;color:#c0c0c0;">Crafted by Erniecodev Software Solutions</span>
  </p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();

    await sendMail({
      to: guestEmail,
      subject: `${hotelName} — Your Booking is Confirmed! ✓`,
      text: plainText,
      html: htmlEmail,
    });
  }

  return {
    ok: true as const,
    status: newStatus,
    balance_due: newBalance,
    deposit_paid: totalPaid,
    reference_number: booking.reference_number,
    becameConfirmed,
  };
}
