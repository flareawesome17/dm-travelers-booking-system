import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";

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

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "ledger.transactions.create");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const today = manilaDateString();
    const date = await findNextOpenLedgerDate(supabase, today);
    const ledger = await getOrCreateLedger(supabase, date);

    if (ledger.status === "closed") {
      return NextResponse.json({ error: "This day is already closed." }, { status: 400 });
    }

    const body = await req.json();
    const type = String(body.type || "").toLowerCase();
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();
    const amount = Number(body.amount || 0);
    const occurredAt = body.occurred_at ? String(body.occurred_at) : new Date().toISOString();

    if (type !== "income" && type !== "expense") {
      return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
    }
    if (!category || !description) {
      return NextResponse.json({ error: "Category and description are required." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const createdBy = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data, error } = await supabase
      .from("ledger_transactions")
      .insert({
        ledger_id: ledger.id,
        type,
        category,
        description,
        amount,
        source_table: "manual",
        occurred_at: occurredAt,
        created_by_admin_id: createdBy,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
