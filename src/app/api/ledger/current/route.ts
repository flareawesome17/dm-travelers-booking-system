import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

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

async function getOrCreateLedger(date: string) {
  const supabase = getSupabaseAdmin();
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

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const date = manilaDateString();
    const ledger = await getOrCreateLedger(date);

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

    const incomeTransactions = [
      ...(payments ?? []).map((p) => {
        const b = p.booking_id ? bookingById.get(p.booking_id) : undefined;
        const guest = b?.guest_name ? ` - ${b.guest_name}` : "";
        const ref = b?.reference_number ? ` (${b.reference_number})` : "";
        return {
          id: p.id,
          type: "income" as const,
          category: "Room Booking Payment",
          description: `${p.type} - ${p.method}${ref}${guest}`,
          amount: Number(p.amount || 0),
          occurred_at: p.transaction_time,
          source_table: "payments",
          source_id: p.id,
        };
      }),
      ...(orders ?? []).map((o) => ({
        id: o.id,
        type: "income" as const,
        category: "Restaurant",
        description: `${o.customer_name || "Walk-in Guest"} - ${o.payment_method || "Unknown"}`,
        amount: Number(o.total_amount || 0),
        occurred_at: o.created_at,
        source_table: "restaurant_orders",
        source_id: o.id,
      })),
      ...(manualTx ?? [])
        .filter((t) => t.type === "income")
        .map((t) => ({
          id: t.id,
          type: "income" as const,
          category: t.category,
          description: t.description,
          amount: Number(t.amount || 0),
          occurred_at: t.occurred_at,
          source_table: "manual",
          source_id: t.id,
        })),
    ];

    const expenseTransactions = [
      ...(expenses ?? []).map((e) => ({
        id: e.id,
        type: "expense" as const,
        category: e.category || "Other",
        description: e.description,
        amount: Number(e.amount || 0),
        occurred_at: e.created_at,
        source_table: "expenses",
        source_id: e.id,
      })),
      ...(manualTx ?? [])
        .filter((t) => t.type === "expense")
        .map((t) => ({
          id: t.id,
          type: "expense" as const,
          category: t.category,
          description: t.description,
          amount: Number(t.amount || 0),
          occurred_at: t.occurred_at,
          source_table: "manual",
          source_id: t.id,
        })),
    ];

    const totalIncome = incomeTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalExpense = expenseTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
    const netTotal = totalIncome - totalExpense;

    return NextResponse.json({
      date,
      ledger: { ...ledger, total_income: totalIncome, total_expense: totalExpense, net_total: netTotal },
      income_transactions: incomeTransactions,
      expense_transactions: expenseTransactions,
      totals: { total_income: totalIncome, total_expense: totalExpense, net_total: netTotal },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
