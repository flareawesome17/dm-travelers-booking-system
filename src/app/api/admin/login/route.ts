import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";
import {
  parseAndValidate,
  checkRateLimit,
  rateLimitResponse,
  apiError,
  internalError,
  requireEnvSecret,
} from "@/lib/api-security";
import { loginSchema } from "@/lib/validation-schemas";

function randomOtp(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function hashOtp(args: { otpId: string; adminId: string; otp: string }) {
  const secret = process.env.ADMIN_LOGIN_OTP_SECRET || requireEnvSecret("JWT_SECRET");
  return crypto
    .createHash("sha256")
    .update(`${secret}:${args.otpId}:${args.adminId}:${args.otp}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 login attempts per IP per 15 minutes
  const rl = checkRateLimit(req, {
    key: "admin_login",
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, loginSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { email, password } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return apiError("invalid_credentials", "Invalid email or password", 401);
    }

    if (!user.is_active) {
      return apiError("forbidden", "Sorry, your account is disabled, please contact your administrator.", 403);
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return apiError("invalid_credentials", "Invalid email or password", 401);
    }

    const otp = randomOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: otpRow, error: otpErr } = await supabase
      .from("admin_login_otps")
      .insert({ admin_id: user.id, otp_hash: "pending", expires_at: expiresAt, attempts: 0 })
      .select("id")
      .single();
    if (otpErr || !otpRow) return internalError();

    const otpHash = hashOtp({ otpId: otpRow.id, adminId: user.id, otp });
    const { error: upErr } = await supabase
      .from("admin_login_otps")
      .update({ otp_hash: otpHash, updated_at: new Date().toISOString() })
      .eq("id", otpRow.id);
    if (upErr) return internalError();

    await sendMail({
      to: user.email,
      subject: "D&M Travellers Inn - Admin Login OTP",
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
    return internalError();
  }
}
