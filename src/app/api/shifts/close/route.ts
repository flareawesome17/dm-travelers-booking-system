import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { getOrCreateActiveShiftLog } from "@/lib/shiftUtils";
import { broadcastSystemMessage } from "@/lib/activity-hub";
import { finalizeShiftCashReport } from "@/lib/shiftCashReports";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "shifts.close");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { close_notes } = body;
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const supabase = getSupabaseAdmin();
    const { shift, shiftLog } = await getOrCreateActiveShiftLog(adminId || undefined);

    if (shiftLog.status === "CLOSED") {
      return NextResponse.json(
        { error: "This shift is already closed." },
        { status: 400 },
      );
    }

    const { data: transactions, error: txErr } = await supabase
      .from("shift_transactions")
      .select("type, amount")
      .eq("shift_log_id", shiftLog.id);

    if (txErr) throw txErr;

    const txList = transactions ?? [];
    const totalIncome = txList
      .filter((transaction: any) => transaction.type === "INCOME")
      .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0);
    const totalExpense = txList
      .filter((transaction: any) => transaction.type === "EXPENSE")
      .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0);
    const netTotal = totalIncome - totalExpense;

    const { data: closedLog, error: closeError } = await supabase
      .from("shift_logs")
      .update({
        status: "CLOSED",
        closed_at: new Date().toISOString(),
        closed_by: adminId,
        close_notes: close_notes || null,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        closing_type: "MANUAL",
      })
      .eq("id", shiftLog.id)
      .select()
      .single();

    if (closeError) {
      return NextResponse.json({ error: closeError.message }, { status: 500 });
    }

    await supabase.from("audit_log").insert({
      entity_type: "shift_log",
      entity_id: shiftLog.id,
      action: "shift_closed",
      changes: {
        shift_name: shift.name,
        date: shiftLog.date,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        close_notes: close_notes || null,
      },
      performed_by_admin_id: adminId,
    });

    let report_warning: string | null = null;
    try {
      await finalizeShiftCashReport(shiftLog.id, { supabase });
    } catch (reportError) {
      console.error("[SHIFT_REPORT_FINALIZE_ERROR]", reportError);
      report_warning =
        "Shift closed successfully, but the cash report snapshot could not be finalized. The report will fall back to live reconstruction until this is resolved.";
    }

    broadcastSystemMessage(
      {
        content: `${shift.name} shift has been closed. Income: PHP ${totalIncome.toLocaleString()} | Expenses: PHP ${totalExpense.toLocaleString()} | Net: PHP ${netTotal.toLocaleString()}.`,
        category: "shift",
        metadata: { shift_log_id: shiftLog.id, shift_name: shift.name },
      },
      supabase,
    ).catch(() => {});

    return NextResponse.json({
      message: `${shift.name} shift closed successfully.`,
      shift_log: closedLog,
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        transaction_count: txList.length,
      },
      report_warning,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
