import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

function isUuid(s: string) {
  return /^[0-9a-fA-F-]{36}$/.test(s);
}

function randomQrToken(reference: string) {
  return `QR-${reference}-${crypto.randomBytes(8).toString("hex")}`.toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!bookingId || !isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Invalid code." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, reference_number, status, verification_code, verification_code_expires_at, guest_id, room_type_requested, check_in_date, check_out_date, total_amount, deposit_paid, balance_due")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    if (String(booking.status) !== "Pending Verification") {
      return NextResponse.json({ error: "This booking is not pending verification." }, { status: 400 });
    }

    const exp = booking.verification_code_expires_at ? new Date(String(booking.verification_code_expires_at)).getTime() : 0;
    if (!exp || exp <= Date.now()) {
      await supabase.from("bookings").update({ status: "Cancelled", updated_at: new Date().toISOString() }).eq("id", booking.id);
      return NextResponse.json({ error: "Code expired. Please create a new booking." }, { status: 400 });
    }

    if (String(booking.verification_code || "") !== code) {
      return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
    }

    const qrToken = randomQrToken(String(booking.reference_number));
    const { error: upErr } = await supabase
      .from("bookings")
      .update({
        status: "Confirmed",
        verification_code: null,
        verification_code_expires_at: null,
        guest_qr_code: qrToken,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await sendMail({
      to: email,
      subject: "D&M Travelers Inn - Booking confirmed",
      text: `Your booking is confirmed.\n\nReference: ${booking.reference_number}\nCheck-in: ${String(booking.check_in_date).slice(0, 10)}\nCheck-out: ${String(booking.check_out_date).slice(0, 10)}\n\nPresent this reference at the front desk.`,
      html: `<p>Your booking is confirmed.</p><p><strong>Reference:</strong> ${booking.reference_number}</p><p><strong>Check-in:</strong> ${String(booking.check_in_date).slice(0, 10)}<br/><strong>Check-out:</strong> ${String(booking.check_out_date).slice(0, 10)}</p><p>Please present this reference at the front desk.</p>`,
    });

    return NextResponse.json({
      booking_id: booking.id,
      reference_number: booking.reference_number,
      status: "Confirmed",
      room_type_requested: booking.room_type_requested,
      check_in_date: String(booking.check_in_date).slice(0, 10),
      check_out_date: String(booking.check_out_date).slice(0, 10),
      total_amount: booking.total_amount,
      deposit_paid: booking.deposit_paid,
      balance_due: booking.balance_due,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

