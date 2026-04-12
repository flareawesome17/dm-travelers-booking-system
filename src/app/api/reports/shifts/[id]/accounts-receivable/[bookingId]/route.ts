import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateShiftAccountsReceivableWorkbook } from "@/lib/accountsReceivableReports";

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
  { params }: { params: Promise<{ id: string; bookingId: string }> },
) {
  const auth = await requirePermission(req, "reports.shift_cash.export");
  if ("error" in auth) return auth.error;

  try {
    const { id, bookingId } = await params;
    const preparedByName = await getPreparedByName(
      typeof auth.payload?.sub === "string" ? auth.payload.sub : null,
    );
    const { buffer, fileName } = await generateShiftAccountsReceivableWorkbook({
      reportId: id,
      bookingId,
      preparedByName,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to export accounts receivable workbook." },
      { status: 500 },
    );
  }
}
