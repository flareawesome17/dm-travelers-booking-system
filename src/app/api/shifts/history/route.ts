import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "shifts.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;

    const { data: logs, error: logsErr, count } = await supabase
      .from("shift_logs")
      .select(
        `id, date, status, opened_by, closed_by, closed_at, close_notes, closing_type,
         total_income, total_expense, net_total,
         shifts ( id, name, start_time, end_time ),
         closed_by_user:admin_users!closed_by(name)`,
        { count: "exact" }
      )
      .eq("status", "CLOSED")
      .order("date", { ascending: false })
      .order("closed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsErr) throw logsErr;

    // Data Healing: Fix shifts that have zero totals but might have transactions (especially AUTO closed ones)
    const logsToFix = (logs ?? []).filter(
      (log: any) => log.net_total === 0 && log.total_income === 0 && log.total_expense === 0
    );

    if (logsToFix.length > 0) {
      // We don't await this to keep the API responsive, but we do perform the updates
      for (const log of logsToFix) {
        const { data: txs } = await supabase
          .from("shift_transactions")
          .select("type, amount")
          .eq("shift_log_id", log.id);

        if (txs && txs.length > 0) {
          const income = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount || 0), 0);
          const expense = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount || 0), 0);
          const net = income - expense;

          if (income !== 0 || expense !== 0) {
            await supabase
              .from("shift_logs")
              .update({ total_income: income, total_expense: expense, net_total: net })
              .eq("id", log.id);
            
            // Update the local object so the user sees the fix immediately
            log.total_income = income;
            log.total_expense = expense;
            log.net_total = net;
          }
        }
      }
    }

    return NextResponse.json({
      data: logs ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
