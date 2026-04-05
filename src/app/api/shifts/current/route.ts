import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import {
  getOrCreateActiveShiftLog,
  minutesUntilShiftEnd,
  manilaTimeString,
  type ShiftDefinition,
} from "@/lib/shiftUtils";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "shifts.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : undefined;

    const { shift, shiftLog, shifts, is_overtime } = await getOrCreateActiveShiftLog(adminId);

    // Fetch transactions for this shift log
    const { data: transactions, error: txErr } = await supabase
      .from("shift_transactions")
      .select("id, source, reference_id, description, amount, type, category, performed_by, created_at, performed_by_user:admin_users!performed_by(name)")
      .eq("shift_log_id", shiftLog.id)
      .order("created_at", { ascending: false });

    if (txErr) throw txErr;

    const txList = transactions ?? [];
    const incomeTransactions = txList.filter((t: any) => t.type === "INCOME");
    const expenseTransactions = txList.filter((t: any) => t.type === "EXPENSE");

    const totalIncome = incomeTransactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalExpense = expenseTransactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const netTotal = totalIncome - totalExpense;

    // Calculate time remaining
    const currentTime = manilaTimeString();
    const minsRemaining = minutesUntilShiftEnd(shift as ShiftDefinition, currentTime);
    const isEndingSoon = minsRemaining <= 30;

    // Check if previous shift is still open (blocks current shift operations)
    const shiftsSorted = (shifts as ShiftDefinition[]).filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = shiftsSorted.findIndex(s => s.id === shift.id);
    let previousShiftOpen = false;

    if (currentIndex > 0) {
      const prevShift = shiftsSorted[currentIndex - 1];
      const { data: prevLog } = await supabase
        .from("shift_logs")
        .select("id, status")
        .eq("shift_id", prevShift.id)
        .eq("status", "OPEN")
        .maybeSingle();

      if (prevLog && !is_overtime) previousShiftOpen = true; // Don't flag previous if THIS shift is the overtime one
    }

    return NextResponse.json({
      shift,
      shift_log: {
        ...shiftLog,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
      },
      income_transactions: incomeTransactions,
      expense_transactions: expenseTransactions,
      totals: { total_income: totalIncome, total_expense: totalExpense, net_total: netTotal },
      time: {
        current_time: currentTime,
        minutes_remaining: is_overtime ? 0 : minsRemaining,
        is_ending_soon: isEndingSoon,
        shift_start: shift.start_time,
        shift_end: shift.end_time,
      },
      warnings: {
        previous_shift_open: previousShiftOpen,
        is_overtime: is_overtime,
        ending_soon: (isEndingSoon && !is_overtime)
          ? `⏰ ${minsRemaining} minutes remaining in ${shift.name} shift. Please close the ledger soon.`
          : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
