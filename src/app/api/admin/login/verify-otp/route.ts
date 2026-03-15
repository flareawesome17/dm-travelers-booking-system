import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signAdminToken } from "@/lib/auth";
import crypto from "crypto";

function hashOtp(args: { otpId: string; adminId: string; otp: string }) {
  const secret = process.env.ADMIN_LOGIN_OTP_SECRET || process.env.LEDGER_OTP_SECRET || process.env.JWT_SECRET || "changeme";
  return crypto
    .createHash("sha256")
    .update(`${secret}:${args.otpId}:${args.adminId}:${args.otp}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const otpId = typeof body.otp_id === "string" ? body.otp_id : "";
    const otp = typeof body.otp === "string" ? body.otp.trim().toUpperCase() : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!otpId || !/^[0-9a-fA-F-]{36}$/.test(otpId)) {
      return NextResponse.json({ error: "Invalid OTP request." }, { status: 400 });
    }
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^[A-Z0-9]{6}$/.test(otp)) return NextResponse.json({ error: "OTP must be 6 characters." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: user, error: uErr } = await supabase
      .from("admin_users")
      .select("id, email, role_id, is_active")
      .eq("email", email)
      .eq("is_active", true)
      .single();
    if (uErr || !user) return NextResponse.json({ error: "Invalid OTP." }, { status: 401 });

    const { data: otpRow, error: oErr } = await supabase
      .from("admin_login_otps")
      .select("id, otp_hash, expires_at, used_at, attempts")
      .eq("id", otpId)
      .eq("admin_id", user.id)
      .maybeSingle();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    if (!otpRow) return NextResponse.json({ error: "Invalid OTP." }, { status: 401 });
    if (otpRow.used_at) return NextResponse.json({ error: "OTP already used. Please login again." }, { status: 400 });
    if (otpRow.attempts >= 5) return NextResponse.json({ error: "Too many attempts. Please login again." }, { status: 400 });
    if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "OTP expired. Please login again." }, { status: 400 });
    }

    const expectedHash = hashOtp({ otpId: otpRow.id, adminId: user.id, otp });
    if (expectedHash !== otpRow.otp_hash) {
      await supabase
        .from("admin_login_otps")
        .update({ attempts: Number(otpRow.attempts || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", otpRow.id);
      return NextResponse.json({ error: "Invalid OTP." }, { status: 401 });
    }

    const usedAt = new Date().toISOString();
    const { error: useErr } = await supabase
      .from("admin_login_otps")
      .update({ used_at: usedAt, updated_at: usedAt })
      .eq("id", otpRow.id);
    if (useErr) return NextResponse.json({ error: useErr.message }, { status: 500 });

    const token = signAdminToken({ sub: user.id, email: user.email, role_id: user.role_id });
    return NextResponse.json({ token, user: { id: user.id, email: user.email, role_id: user.role_id } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

