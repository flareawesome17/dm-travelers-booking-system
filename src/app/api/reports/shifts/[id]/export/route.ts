import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  generateShiftCashReportWorkbook,
  getShiftCashReportById,
} from "@/lib/shiftCashReports";

async function getPreparedByName(adminId: string | null | undefined) {
  if (!adminId) return "";

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_users")
    .select("name, email")
    .eq("id", adminId)
    .maybeSingle();

  if (error) throw error;

  const displayName = typeof data?.name === "string" ? data.name.trim() : "";
  const email = typeof data?.email === "string" ? data.email.trim() : "";
  return displayName || email || "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(req, "reports.shift_cash.export");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const report = await getShiftCashReportById(id);
    const preparedByName = await getPreparedByName(
      typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
    );
    const workbook = await generateShiftCashReportWorkbook(report, { preparedByName });
    const fileName = `cash-on-hand-${report.shift_log.date}-${report.shift_log.shifts?.name || "shift"}.xlsx`;

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName.replace(/\s+/g, "-").toLowerCase()}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to export shift report." },
      { status: 500 },
    );
  }
}
