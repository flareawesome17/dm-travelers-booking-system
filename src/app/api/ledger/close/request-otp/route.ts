import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

function manilaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function getOrCreateLedger(supabase: ReturnType<typeof getSupabaseAdmin>, date: string) {
  const { data: existing, error: eErr } = await supabase
    .from("daily_ledgers")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (eErr) throw eErr;
  if (existing) return existing;

  const { data: created, error: cErr } = await supabase
    .from("daily_ledgers")
    .insert({ date, status: "open" })
    .select("*")
    .single();
  if (cErr) throw cErr;
  return created;
}

function hashOtp(args: { ledgerId: string; adminId: string; otp: string }) {
  const secret = process.env.LEDGER_OTP_SECRET || process.env.JWT_SECRET || "changeme";
  return crypto
    .createHash("sha256")
    .update(`${secret}:${args.ledgerId}:${args.adminId}:${args.otp}`)
    .digest("hex");
}

function isMissingOtpTableError(error: unknown): boolean {
  const msg = typeof (error as any)?.message === "string" ? (error as any).message : "";
  if (!msg) return false;
  return (
    msg.toLowerCase().includes("daily_ledger_close_otps") &&
    (msg.toLowerCase().includes("schema cache") || msg.toLowerCase().includes("does not exist"))
  );
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  const adminEmail = typeof auth.payload.email === "string" ? auth.payload.email : null;
  if (!adminId || !adminEmail) {
    return NextResponse.json({ error: "Invalid admin token." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const date = manilaDateString();
    const ledger = await getOrCreateLedger(supabase, date);

    if (ledger.status === "closed") {
      return NextResponse.json({ error: "This day is already closed." }, { status: 400 });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const otpHash = hashOtp({ ledgerId: ledger.id, adminId, otp });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upErr } = await supabase
      .from("daily_ledger_close_otps")
      .upsert(
        {
          ledger_id: ledger.id,
          admin_id: adminId,
          otp_hash: otpHash,
          expires_at: expiresAt,
          used_at: null,
          attempts: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ledger_id,admin_id" }
      );
    if (upErr) {
      if (isMissingOtpTableError(upErr)) {
        return NextResponse.json(
          { error: "OTP table is missing. Apply migration 016_daily_ledger_close_otp.sql in Supabase, then retry." },
          { status: 500 }
        );
      }
      throw upErr;
    }

    await sendMail({
      to: adminEmail,
      subject: `D&M Travelers Inn - Close Day OTP (${date})`,
      text: `Your OTP to close the daily ledger for ${date} is: ${otp}\n\nThis code will expire in 10 minutes.`,
      html: `<p>Your OTP to close the daily ledger for <b>${date}</b> is:</p><h2 style="letter-spacing:2px">${otp}</h2><p>This code will expire in 10 minutes.</p>`,
    });

    return NextResponse.json({
      success: true,
      to: adminEmail.replace(/(^.).*(@.*$)/, "$1***$2"),
      expires_at: expiresAt,
    });
  } catch (error: any) {
    if (isMissingOtpTableError(error)) {
      return NextResponse.json(
        { error: "OTP table is missing. Apply migration 016_daily_ledger_close_otp.sql in Supabase, then retry." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
