import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { date } = await params;
    const supabase = getSupabaseAdmin();

    const { data: ledger, error: lErr } = await supabase
      .from("daily_ledgers")
      .select("*")
      .eq("date", date)
      .maybeSingle();
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
    if (!ledger) return NextResponse.json({ error: "Ledger not found" }, { status: 404 });

    const { data: transactions, error: tErr } = await supabase
      .from("ledger_transactions")
      .select("*")
      .eq("ledger_id", ledger.id)
      .order("occurred_at", { ascending: true });
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

    const income = (transactions ?? []).filter((t) => t.type === "income");
    const expense = (transactions ?? []).filter((t) => t.type === "expense");

    return NextResponse.json({
      ledger,
      income_transactions: income,
      expense_transactions: expense,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

