import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getCurrentShiftCashReport } from "@/lib/shiftCashReports";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "reports.shift_cash.read");
  if ("error" in auth) return auth.error;

  try {
    const report = await getCurrentShiftCashReport();
    return NextResponse.json(report);
  } catch (error: any) {
    console.error("[reports/shifts/current] Failed to load current shift report", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load current shift report." },
      { status: 500 },
    );
  }
}
