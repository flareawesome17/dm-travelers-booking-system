import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const format = url.searchParams.get("format");

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch Bookings (Rooms)
    let bQuery = supabase.from("bookings").select("total_amount, deposit_paid, balance_due, payment_method, created_at, status").not("status", "eq", "Cancelled");
    if (startDate) bQuery = bQuery.gte("created_at", startDate);
    if (endDate) bQuery = bQuery.lte("created_at", endDate);
    const { data: bookings, error: bErr } = await bQuery;
    if (bErr) throw bErr;

    // 2. Fetch Restaurant Orders (Dine-in/Walk-in only, as room service is in bookings)
    let rQuery = supabase.from("restaurant_orders")
      .select("total_amount, payment_method, created_at, status, order_source")
      .not("status", "eq", "Cancelled")
      .not("order_source", "eq", "Room Service"); // Avoid double counting
    if (startDate) rQuery = rQuery.gte("created_at", startDate);
    if (endDate) rQuery = rQuery.lte("created_at", endDate);
    const { data: rOrders, error: rErr } = await rQuery;
    if (rErr) throw rErr;

    // 3. Fetch Expenses
    let eQuery = supabase.from("expenses").select("*");
    if (startDate) eQuery = eQuery.gte("date", startDate.split("T")[0]);
    if (endDate) eQuery = eQuery.lte("date", endDate.split("T")[0]);
    const { data: expenses, error: eErr } = await eQuery;
    if (eErr) throw eErr;

    // --- Calculations ---
    const roomRevenue = (bookings ?? []).reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const restaurantRevenue = (rOrders ?? []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalRevenue = roomRevenue + restaurantRevenue;
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const byMethod: Record<string, number> = {};
    [...(bookings ?? []), ...(rOrders ?? [])].forEach((item) => {
      const m = item.payment_method || "Unknown";
      byMethod[m] = (byMethod[m] || 0) + Number(item.total_amount || 0);
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

    return NextResponse.json({
      total_revenue: totalRevenue,
      room_revenue: roomRevenue,
      restaurant_revenue: restaurantRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      by_method: byMethod,
      by_source: bySource,
      booking_count: bookings?.length || 0,
      order_count: rOrders?.length || 0,
      expenses_list: expenses || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
