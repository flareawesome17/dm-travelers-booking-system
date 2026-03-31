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
        `id, date, status, opened_by, closed_by, closed_at, close_notes,
         total_income, total_expense, net_total,
         shifts ( id, name, start_time, end_time )`,
        { count: "exact" }
      )
      .eq("status", "CLOSED")
      .order("date", { ascending: false })
      .order("closed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsErr) throw logsErr;

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
