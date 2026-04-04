import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, rateLimitResponse } from "@/lib/api-security";
import crypto from "crypto";

function isUuid(s: string) {
  return /^[0-9a-fA-F-]{36}$/.test(s);
}

function randomCode6() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per 10 minutes per IP
  const rl = checkRateLimit(req, {
    key: "public_booking_resend_code",
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!bookingId || !isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, reference_number, status, verification_code_expires_at, guest_id, guests(email)")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    // Validate email ownership — must match the guest on file
    const bookingGuest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
    const bookingEmail = typeof bookingGuest?.email === "string" ? bookingGuest.email.toLowerCase().trim() : "";
    if (!bookingEmail || bookingEmail !== email) {
      return NextResponse.json({ error: "Booking email mismatch." }, { status: 403 });
    }

    if (String(booking.status) !== "Pending Verification") {
      return NextResponse.json({ error: "This booking is not pending verification." }, { status: 400 });
    }

    const exp = booking.verification_code_expires_at ? new Date(String(booking.verification_code_expires_at)).getTime() : 0;
    if (!exp || exp <= Date.now()) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json({ error: "Code expired. Please create a new booking." }, { status: 400 });
    }

    const verificationCode = randomCode6();
    const { error: upErr } = await supabase
      .from("bookings")
      .update({ verification_code: verificationCode, updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Fetch hotel branding for verification email
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["hotel_name", "hotel_logo"]);
    const settingsMap = new Map<string, string>();
    for (const row of settingsRows ?? []) {
      if (row.key) settingsMap.set(row.key, String(row.value ?? ""));
    }
    const hotelName = settingsMap.get("hotel_name")?.trim() || "D&M Travellers Inn";
    const hotelLogo = settingsMap.get("hotel_logo")?.trim() || "";

    const resendHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background-color:#f4f7f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);border:1px solid #e1e8ed;">
        <tr>
          <td style="background-color:#0b1a2e;padding:30px;text-align:center;">
            ${hotelLogo ? `<img src="${hotelLogo}" alt="${hotelName}" style="height:50px;margin-bottom:15px;"/>` : `<h1 style="color:#ffffff;margin:0;font-size:20px;letter-spacing:2px;">${hotelName}</h1>`}
          </td>
        </tr>
        <tr>
          <td style="padding:40px 30px;text-align:center;">
            <p style="margin:0 0 20px;font-size:16px;color:#4a5568;">Your booking reference is <strong>${booking.reference_number}</strong>.</p>
            <p style="margin:0 0 10px;font-size:14px;color:#718096;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your New Verification Code</p>
            <div style="background-color:#f8fafc;border:1px dashed #cbd5e0;padding:20px;border-radius:8px;margin:20px 0;">
              <span style="font-size:32px;font-weight:700;color:#0b1a2e;letter-spacing:8px;margin-left:8px;">${verificationCode}</span>
            </div>
            <p style="margin:20px 0 0;font-size:13px;color:#a0aec0;">This code expires in 10 minutes from the original request. Please enter it on the website to proceed.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;background-color:#f8fafc;text-align:center;border-top:1px solid #edf2f7;">
            <p style="margin:0;font-size:12px;color:#718096;">&copy; ${new Date().getFullYear()} ${hotelName}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    await sendMail({
      to: bookingEmail, 
      subject: `[${hotelName}] New verification code — Reference: ${booking.reference_number}`,
      text: `Your booking reference is ${booking.reference_number}.\n\nYour new verification code is: ${verificationCode}\n\nThis code expires in 10 minutes from the original request.`,
      html: resendHtml,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
