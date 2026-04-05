import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(req, "shifts.read");
  if ("error" in auth) return auth.error;

  const { id } = params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch the shift log with shift definition
    const { data: shiftLog, error: logErr } = await supabase
      .from("shift_logs")
      .select(
        `id, date, status, opened_by, closed_by, closed_at, close_notes, closing_type,
         total_income, total_expense, net_total,
         shifts ( id, name, start_time, end_time ),
         closed_by_user:admin_users!closed_by(name)`
      )
      .eq("id", id)
      .maybeSingle();

    if (logErr) throw logErr;
    if (!shiftLog) {
      return NextResponse.json({ error: "Shift log not found" }, { status: 404 });
    }

    // Only allow reading closed/locked shifts via this read-only endpoint
    if (shiftLog.status !== "CLOSED") {
      return NextResponse.json(
        { error: "This shift is still open. Use /api/shifts/current for active shift data." },
        { status: 400 }
      );
    }

    // Fetch all transactions for this shift log (immutable — no edits returned)
    const { data: transactions, error: txErr } = await supabase
      .from("shift_transactions")
      .select("id, source, reference_id, description, amount, type, category, performed_by, created_at, performed_by_user:admin_users!performed_by(name)")
      .eq("shift_log_id", id)
      .order("created_at", { ascending: true });

    if (txErr) throw txErr;

    const txList = transactions ?? [];
    const incomeTransactions = txList.filter((t: any) => t.type === "INCOME");
    const expenseTransactions = txList.filter((t: any) => t.type === "EXPENSE");

    // Recompute totals from raw transactions for integrity check
    const computedIncome = incomeTransactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const computedExpense = expenseTransactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const computedNet = computedIncome - computedExpense;

    const storedNet = Number(shiftLog.net_total || 0);
    const hasDiscrepancy = Math.abs(computedNet - storedNet) > 0.01;

    return NextResponse.json({
      shift_log: shiftLog,
      transactions: txList,
      income_transactions: incomeTransactions,
      expense_transactions: expenseTransactions,
      summary: {
        total_income: computedIncome,
        total_expense: computedExpense,
        net_total: computedNet,
        stored_net_total: storedNet,
        has_discrepancy: hasDiscrepancy,
        transaction_count: txList.length,
      },
      readonly: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
