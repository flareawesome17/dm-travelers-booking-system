import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { rejectCashDepositSchema } from "@/lib/validation-schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "cash.deposit.approve");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, rejectCashDepositSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const nowIso = new Date().toISOString();

    const { data: requestRow, error } = await supabase
      .from("cash_deposit_requests")
      .select("id, status")
      .eq("id", id)
      .single();

    if (error || !requestRow) {
      return apiError("not_found", "Cash deposit request not found.", 404);
    }
    if (requestRow.status !== "pending_review") {
      return apiError("invalid_status", "Only pending deposit requests can be rejected.", 400);
    }

    const { error: updateError } = await supabase
      .from("cash_deposit_requests")
      .update({
        status: "rejected",
        rejection_note: parsed.data.rejection_note,
        rejected_by_admin_id: adminId,
        rejected_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (updateError) return dbError(updateError, "Failed to reject cash deposit request.");

    await supabase.from("audit_log").insert({
      entity_type: "cash_deposit_request",
      entity_id: id,
      action: "cash_deposit_rejected",
      changes: {
        rejection_note: parsed.data.rejection_note,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return dbError(error, "Failed to reject cash deposit request.");
  }
}
