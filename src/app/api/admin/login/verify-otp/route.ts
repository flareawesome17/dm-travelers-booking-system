import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signAdminToken } from "@/lib/auth";
import crypto from "crypto";
import {
  parseAndValidate,
  checkRateLimit,
  rateLimitResponse,
  timingSafeCompare,
  apiError,
  internalError,
  requireEnvSecret,
} from "@/lib/api-security";
import { verifyOtpSchema } from "@/lib/validation-schemas";

function hashOtp(args: { otpId: string; adminId: string; otp: string }) {
  const secret = process.env.ADMIN_LOGIN_OTP_SECRET || requireEnvSecret("JWT_SECRET");
  return crypto
    .createHash("sha256")
    .update(`${secret}:${args.otpId}:${args.adminId}:${args.otp}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 OTP verification attempts per IP per 15 minutes
  const rl = checkRateLimit(req, {
    key: "otp_verify",
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, verifyOtpSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { otp_id: otpId, otp, email } = parsed.data;

    const supabase = getSupabaseAdmin();

    const { data: user, error: uErr } = await supabase
      .from("admin_users")
      .select("id, name, email, role_id, is_active")
      .eq("email", email)
      .eq("is_active", true)
      .single();
    if (uErr || !user) return apiError("invalid_otp", "Invalid OTP.", 401);

    const { data: otpRow, error: oErr } = await supabase
      .from("admin_login_otps")
      .select("id, otp_hash, expires_at, used_at, attempts")
      .eq("id", otpId)
      .eq("admin_id", user.id)
      .maybeSingle();
    if (oErr) return internalError();
    if (!otpRow) return apiError("invalid_otp", "Invalid OTP.", 401);
    if (otpRow.used_at) return apiError("otp_used", "OTP already used. Please login again.", 400);
    if (otpRow.attempts >= 5) return apiError("too_many_attempts", "Too many attempts. Please login again.", 400);
    if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
      return apiError("otp_expired", "OTP expired. Please login again.", 400);
    }

    const expectedHash = hashOtp({ otpId: otpRow.id, adminId: user.id, otp });

    // Use timing-safe comparison to prevent timing attacks
    if (!timingSafeCompare(expectedHash, otpRow.otp_hash)) {
      await supabase
        .from("admin_login_otps")
        .update({ attempts: Number(otpRow.attempts || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", otpRow.id);
      return apiError("invalid_otp", "Invalid OTP.", 401);
    }

    const usedAt = new Date().toISOString();
    const { error: useErr } = await supabase
      .from("admin_login_otps")
      .update({ used_at: usedAt, updated_at: usedAt })
      .eq("id", otpRow.id);
    if (useErr) return internalError();

    const token = signAdminToken({ sub: user.id, name: user.name ?? null, email: user.email, role_id: user.role_id });
    return NextResponse.json({ token, user: { id: user.id, name: user.name ?? null, email: user.email, role_id: user.role_id } });
  } catch {
    return internalError();
  }
}
