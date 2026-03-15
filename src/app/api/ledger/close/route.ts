import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import crypto from "crypto";

function manilaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function manilaDayRangeIso(date: string): { startIso: string; endIso: string } {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
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

  try {
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    if (!adminId) return NextResponse.json({ error: "Invalid admin token." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const date = manilaDateString();
    const ledger = await getOrCreateLedger(supabase, date);

    if (ledger.status === "closed") {
      return NextResponse.json({ error: "This day is already closed." }, { status: 400 });
    }

    const { data: otpRow, error: otpErr } = await supabase
      .from("daily_ledger_close_otps")
      .select("otp_hash, expires_at, used_at, attempts")
      .eq("ledger_id", ledger.id)
      .eq("admin_id", adminId)
      .maybeSingle();
    if (otpErr) {
      if (isMissingOtpTableError(otpErr)) {
        return NextResponse.json(
          { error: "OTP table is missing. Apply migration 016_daily_ledger_close_otp.sql in Supabase, then retry." },
          { status: 500 }
        );
      }
      throw otpErr;
    }
    if (!otpRow) return NextResponse.json({ error: "No OTP request found. Request an OTP first." }, { status: 400 });
    if (otpRow.used_at) return NextResponse.json({ error: "OTP already used. Request a new OTP." }, { status: 400 });
    if (otpRow.attempts >= 5) return NextResponse.json({ error: "Too many attempts. Request a new OTP." }, { status: 400 });
    if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "OTP expired. Request a new OTP." }, { status: 400 });
    }

    const expectedHash = hashOtp({ ledgerId: ledger.id, adminId, otp });
    if (expectedHash !== otpRow.otp_hash) {
      await supabase
        .from("daily_ledger_close_otps")
        .update({ attempts: Number(otpRow.attempts || 0) + 1, updated_at: new Date().toISOString() })
        .eq("ledger_id", ledger.id)
        .eq("admin_id", adminId);
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
    }

    const usedAt = new Date().toISOString();
    const { error: useErr } = await supabase
      .from("daily_ledger_close_otps")
      .update({ used_at: usedAt, updated_at: usedAt })
      .eq("ledger_id", ledger.id)
      .eq("admin_id", adminId);
    if (useErr) throw useErr;

    const { data: payments, error: pErr } = await supabase
      .from("payments")
      .select("id, booking_id, amount, method, type, transaction_id, transaction_time, status, accounting_date")
      .eq("status", "Success")
      .eq("accounting_date", date);
    if (pErr) throw pErr;

    const bookingIds = Array.from(new Set((payments ?? []).map((p) => p.booking_id).filter(Boolean)));
    const { data: bookingRows, error: bErr } = bookingIds.length
      ? await supabase
          .from("bookings")
          .select("id, reference_number, guests(full_name)")
          .in("id", bookingIds as string[])
      : { data: [], error: null as any };
    if (bErr) throw bErr;

    type BookingRow = { id: string; reference_number?: string | null; guests?: { full_name?: string | null }[] };
    const bookingById = new Map<string, { reference_number?: string | null; guest_name?: string | null }>();
    for (const b of (bookingRows ?? []) as BookingRow[]) {
      bookingById.set(b.id, {
        reference_number: b.reference_number ?? null,
        guest_name: b.guests?.[0]?.full_name ?? null,
      });
    }

    const { data: orders, error: oErr } = await supabase
      .from("restaurant_orders")
      .select("id, customer_name, total_amount, payment_method, created_at, status, order_source, accounting_date")
      .eq("status", "Paid")
      .not("order_source", "eq", "Room Service")
      .eq("accounting_date", date);
    if (oErr) throw oErr;

    const { data: expenses, error: exErr } = await supabase
      .from("expenses")
      .select("id, date, description, amount, category, payment_method, created_at")
      .eq("date", date);
    if (exErr) throw exErr;

    const { data: manualTx, error: mErr } = await supabase
      .from("ledger_transactions")
      .select("id, type, category, description, amount, occurred_at")
      .eq("ledger_id", ledger.id)
      .eq("source_table", "manual");
    if (mErr) throw mErr;

    const incomeTotal =
      (payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0) +
      (orders ?? []).reduce((s, o) => s + Number(o.total_amount || 0), 0) +
      (manualTx ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);

    const expenseTotal =
      (expenses ?? []).reduce((s, e) => s + Number(e.amount || 0), 0) +
      (manualTx ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);

    const netTotal = incomeTotal - expenseTotal;

    const closedBy = adminId;
    const closedAt = new Date().toISOString();

    const { data: updatedLedger, error: uErr } = await supabase
      .from("daily_ledgers")
      .update({
        status: "closed",
        total_income: incomeTotal,
        total_expense: expenseTotal,
        net_total: netTotal,
        closed_at: closedAt,
        closed_by_admin_id: closedBy,
        updated_at: closedAt,
      })
      .eq("id", ledger.id)
      .select("*")
      .single();
    if (uErr) throw uErr;

    const { error: delErr } = await supabase
      .from("ledger_transactions")
      .delete()
      .eq("ledger_id", ledger.id)
      .in("source_table", ["payments", "restaurant_orders", "expenses"]);
    if (delErr) throw delErr;

    const snapshotTx = [
      ...(payments ?? []).map((p) => {
        const b = p.booking_id ? bookingById.get(p.booking_id) : undefined;
        const guest = b?.guest_name ? ` - ${b.guest_name}` : "";
        const ref = b?.reference_number ? ` (${b.reference_number})` : "";
        return {
          ledger_id: ledger.id,
          type: "income",
          category: "Room Booking Payment",
          description: `${p.type} - ${p.method}${ref}${guest}`,
          amount: Number(p.amount || 0),
          source_table: "payments",
          source_id: p.id,
          occurred_at: p.transaction_time,
          created_by_admin_id: closedBy,
        };
      }),
      ...(orders ?? []).map((o) => ({
        ledger_id: ledger.id,
        type: "income",
        category: "Restaurant",
        description: `${o.customer_name || "Walk-in Guest"} - ${o.payment_method || "Unknown"}`,
        amount: Number(o.total_amount || 0),
        source_table: "restaurant_orders",
        source_id: o.id,
        occurred_at: o.created_at,
        created_by_admin_id: closedBy,
      })),
      ...(expenses ?? []).map((e) => ({
        ledger_id: ledger.id,
        type: "expense",
        category: e.category || "Other",
        description: e.description,
        amount: Number(e.amount || 0),
        source_table: "expenses",
        source_id: e.id,
        occurred_at: e.created_at,
        created_by_admin_id: closedBy,
      })),
    ].filter((t) => Number(t.amount || 0) !== 0);

    if (snapshotTx.length > 0) {
      const { error: insErr } = await supabase.from("ledger_transactions").insert(snapshotTx);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ledger: updatedLedger });
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
