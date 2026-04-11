import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getShiftCashReportById } from "@/lib/shiftCashReports";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(req, "reports.shift_cash.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const report = await getShiftCashReportById(id);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load shift report." },
      { status: 500 },
    );
  }
}
