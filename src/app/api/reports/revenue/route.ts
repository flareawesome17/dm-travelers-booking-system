import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "reports.read");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const format = url.searchParams.get("format");

  try {
    const supabase = getSupabaseAdmin();
    const startDay = startDate ? startDate.split("T")[0] : null;
    const endDay = endDate ? endDate.split("T")[0] : null;

    // 1. Fetch Booking Payments (Rooms) - actual cash received
    let pQuery = supabase
      .from("payments")
      .select("id, booking_id, amount, method, status, transaction_time, accounting_date")
      .eq("status", "Success");
    if (startDay) pQuery = pQuery.gte("accounting_date", startDay);
    if (endDay) pQuery = pQuery.lte("accounting_date", endDay);
    const { data: payments, error: pErr } = await pQuery;
    if (pErr) throw pErr;

    // 2. Fetch Restaurant Orders (Dine-in/Walk-in only, as room service is in bookings)
    let rQuery = supabase.from("restaurant_orders")
      .select("total_amount, payment_method, created_at, status, order_source, accounting_date")
      .eq("status", "Paid")
      .not("order_source", "eq", "Room Service"); // Avoid double counting
    if (startDay) rQuery = rQuery.gte("accounting_date", startDay);
    if (endDay) rQuery = rQuery.lte("accounting_date", endDay);
    const { data: rOrders, error: rErr } = await rQuery;
    if (rErr) throw rErr;

    // 3. Fetch Expenses
    let eQuery = supabase.from("expenses").select("*, performed_by_user:admin_users!performed_by(name)");
    if (startDay) eQuery = eQuery.gte("date", startDay);
    if (endDay) eQuery = eQuery.lte("date", endDay);
    const { data: expenses, error: eErr } = await eQuery;
    if (eErr) throw eErr;

    // 4. Fetch Receivable Payments (LGU / Special collections)
    let rcQuery = supabase.from("receivable_payments")
      .select("id, amount, method, accounting_date, receivable_id");
    if (startDay) rcQuery = rcQuery.gte("accounting_date", startDay);
    if (endDay) rcQuery = rcQuery.lte("accounting_date", endDay);
    const { data: receivablePayments, error: rcErr } = await rcQuery;
    if (rcErr) throw rcErr;

    // --- Calculations (Actual Paid Revenue) ---
    const roomRevenue = (payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const restaurantRevenue = (rOrders ?? []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const receivableRevenue = (receivablePayments ?? []).reduce((s, rp) => s + Number(rp.amount || 0), 0);

    let totalRevenue = roomRevenue + restaurantRevenue + receivableRevenue;
    let totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
    let netProfit = totalRevenue - totalExpenses;

    const byMethod: Record<string, number> = {};
    (payments ?? []).forEach((p) => {
      const m = p.method || "Unknown";
      const amt = Number(p.amount || 0);
      if (amt > 0) byMethod[m] = (byMethod[m] || 0) + amt;
    });
    (rOrders ?? []).forEach((r) => {
      const m = r.payment_method || "Unknown";
      const paid = Number(r.total_amount || 0);
      if (paid > 0) byMethod[m] = (byMethod[m] || 0) + paid;
    });
    (receivablePayments ?? []).forEach((rp) => {
      const m = rp.method || "Unknown";
      const amt = Number(rp.amount || 0);
      if (amt > 0) byMethod[m] = (byMethod[m] || 0) + amt;
    });

    const bySource: Record<string, number> = {
      Rooms: roomRevenue,
      Restaurant: restaurantRevenue,
    };
    if (receivableRevenue > 0) {
      bySource["Receivables"] = receivableRevenue;
    }

    if (format === "csv") {
      const header = "Category,Amount\n";
      const rows = [
        `Room Revenue,${roomRevenue.toFixed(2)}`,
        `Restaurant Revenue,${restaurantRevenue.toFixed(2)}`,
        `Receivable Collections,${receivableRevenue.toFixed(2)}`,
        `Total Revenue,${totalRevenue.toFixed(2)}`,
        `Total Expenses,${totalExpenses.toFixed(2)}`,
        `Net Profit,${netProfit.toFixed(2)}`
      ].join("\n");
      return new NextResponse(header + rows, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=revenue_report.csv" } });
    }

    const bookingCount = Array.from(new Set((payments ?? []).map((p) => p.booking_id).filter(Boolean))).length;
    const orderCount = (rOrders ?? []).length;
    const receivableCollectionCount = (receivablePayments ?? []).length;

    // --- Shift Ledger Single Source of Truth for All Periods ---
    if (format !== "csv") {
      let shiftQuery = supabase
        .from("shift_logs")
        .select("id, status, total_income, total_expense, net_total")
        .order('date', { ascending: true });
      
      if (startDay) shiftQuery = shiftQuery.gte("date", startDay);
      if (endDay) shiftQuery = shiftQuery.lte("date", endDay);

      const { data: shiftLogs } = await shiftQuery;

      if (shiftLogs && shiftLogs.length > 0) {
        let shiftTotalIncome = 0;
        let shiftTotalExpense = 0;

        const openShiftIds = shiftLogs.filter(l => l.status !== "CLOSED").map(l => l.id);
        let openShiftTxs: any[] = [];

        if (openShiftIds.length > 0) {
          const { data: txs } = await supabase
            .from("shift_transactions")
            .select("shift_log_id, amount, type")
            .in("shift_log_id", openShiftIds);
          openShiftTxs = txs || [];
        }

        for (const log of shiftLogs) {
          if (log.status === "CLOSED") {
            shiftTotalIncome += Number(log.total_income || 0);
            shiftTotalExpense += Number(log.total_expense || 0);
          } else {
            const txList = openShiftTxs.filter(t => t.shift_log_id === log.id);
            shiftTotalIncome += txList.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount || 0), 0);
            shiftTotalExpense += txList.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount || 0), 0);
          }
        }

        totalRevenue = shiftTotalIncome;
        totalExpenses = shiftTotalExpense;
        netProfit = totalRevenue - totalExpenses;
      } else {
        // If no shifts exist in range, income is 0 because ledger is the source of truth
        totalRevenue = 0;
        totalExpenses = 0;
        netProfit = 0;
      }
    }

    return NextResponse.json({
      total_revenue: totalRevenue,
      room_revenue: roomRevenue,
      restaurant_revenue: restaurantRevenue,
      receivable_revenue: receivableRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      by_method: byMethod,
      by_source: bySource,
      booking_count: bookingCount,
      order_count: orderCount,
      receivable_collection_count: receivableCollectionCount,
      expenses_list: expenses || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
