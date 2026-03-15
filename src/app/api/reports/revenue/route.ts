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
    let eQuery = supabase.from("expenses").select("*");
    if (startDay) eQuery = eQuery.gte("date", startDay);
    if (endDay) eQuery = eQuery.lte("date", endDay);
    const { data: expenses, error: eErr } = await eQuery;
    if (eErr) throw eErr;

    // --- Calculations (Actual Paid Revenue) ---
    const roomRevenue = (payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);

    const restaurantRevenue = (rOrders ?? []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const totalRevenue = roomRevenue + restaurantRevenue;
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

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

    const bySource = {
      Rooms: roomRevenue,
      Restaurant: restaurantRevenue
    };

    if (format === "csv") {
      const header = "Category,Amount\n";
      const rows = [
        `Room Revenue,${roomRevenue.toFixed(2)}`,
        `Restaurant Revenue,${restaurantRevenue.toFixed(2)}`,
        `Total Revenue,${totalRevenue.toFixed(2)}`,
        `Total Expenses,${totalExpenses.toFixed(2)}`,
        `Net Profit,${netProfit.toFixed(2)}`
      ].join("\n");
      return new NextResponse(header + rows, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=revenue_report.csv" } });
    }

    const bookingCount = Array.from(new Set((payments ?? []).map((p) => p.booking_id).filter(Boolean))).length;
    const orderCount = (rOrders ?? []).length;

    return NextResponse.json({
      total_revenue: totalRevenue,
      room_revenue: roomRevenue,
      restaurant_revenue: restaurantRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      by_method: byMethod,
      by_source: bySource,
      booking_count: bookingCount,
      order_count: orderCount,
      expenses_list: expenses || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
