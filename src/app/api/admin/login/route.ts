import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

function randomOtp(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function hashOtp(args: { otpId: string; adminId: string; otp: string }) {
  const secret = process.env.ADMIN_LOGIN_OTP_SECRET || process.env.LEDGER_OTP_SECRET || process.env.JWT_SECRET || "changeme";
  return crypto
    .createHash("sha256")
    .update(`${secret}:${args.otpId}:${args.adminId}:${args.otp}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("is_active", true)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const otp = randomOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: otpRow, error: otpErr } = await supabase
      .from("admin_login_otps")
      .insert({ admin_id: user.id, otp_hash: "pending", expires_at: expiresAt, attempts: 0 })
      .select("id")
      .single();
    if (otpErr || !otpRow) return NextResponse.json({ error: "Failed to start OTP login." }, { status: 500 });

    const otpHash = hashOtp({ otpId: otpRow.id, adminId: user.id, otp });
    const { error: upErr } = await supabase
      .from("admin_login_otps")
      .update({ otp_hash: otpHash, updated_at: new Date().toISOString() })
      .eq("id", otpRow.id);
    if (upErr) return NextResponse.json({ error: "Failed to start OTP login." }, { status: 500 });

    await sendMail({
      to: user.email,
      subject: "D&M Travelers Inn - Admin Login OTP",
      text: `Your admin login OTP is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `<p>Your admin login OTP is:</p><h2 style="letter-spacing:2px">${otp}</h2><p>This code will expire in 10 minutes.</p>`,
    });

    return NextResponse.json({
      requires_otp: true,
      otp_id: otpRow.id,
      to: user.email.replace(/(^.).*(@.*$)/, "$1***$2"),
      expires_at: expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
