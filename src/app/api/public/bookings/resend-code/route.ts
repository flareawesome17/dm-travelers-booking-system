import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

function isUuid(s: string) {
  return /^[0-9a-fA-F-]{36}$/.test(s);
}

function randomCode6() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!bookingId || !isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, reference_number, status, verification_code_expires_at")
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

    const verificationCode = randomCode6();
    const { error: upErr } = await supabase
      .from("bookings")
      .update({ verification_code: verificationCode, updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await sendMail({
      to: email,
      subject: "D&M Travelers Inn - Your verification code",
      text: `Your booking reference is ${booking.reference_number}.\n\nYour verification code is: ${verificationCode}\n\nThis code expires in 10 minutes from the original request.`,
      html: `<p>Your booking reference is <strong>${booking.reference_number}</strong>.</p><p>Your new verification code is:</p><h2 style="letter-spacing:2px">${verificationCode}</h2><p>This code expires in 10 minutes from the original request.</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

