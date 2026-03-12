import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data: bookings, error } = await supabase.from("bookings").select("total_amount, deposit_paid, balance_due, payment_method").not("status", "eq", "Cancelled");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const total = (bookings ?? []).reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const byMethod: Record<string, number> = {};
    for (const b of bookings ?? []) {
      const m = b.payment_method || "Unknown";
      byMethod[m] = (byMethod[m] || 0) + Number(b.total_amount || 0);
    }

    if (format === "csv") {
      const header = "Payment Method,Amount\n";
      const rows = Object.entries(byMethod).map(([m, a]) => `${m},${a.toFixed(2)}`).join("\n");
      const csv = header + rows + `\nTotal,${total.toFixed(2)}`;
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=revenue.csv" } });
    }

    return NextResponse.json({ total, by_method: byMethod });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
