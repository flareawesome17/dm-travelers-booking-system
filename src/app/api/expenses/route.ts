import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const today = manilaDateString();
    let expenseDate = typeof body.date === "string" && body.date ? body.date : today;
    const { data: ledger, error: lErr } = await supabase
      .from("daily_ledgers")
      .select("status")
      .eq("date", expenseDate)
      .maybeSingle();
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
    if (ledger?.status === "closed") {
      if (expenseDate === today) {
        expenseDate = await findNextOpenLedgerDate(supabase, today);
      } else {
        return NextResponse.json({ error: "Selected date is closed. Choose an open day." }, { status: 400 });
      }
    }
    
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...body, date: expenseDate })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, recorded_for_date: expenseDate });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
