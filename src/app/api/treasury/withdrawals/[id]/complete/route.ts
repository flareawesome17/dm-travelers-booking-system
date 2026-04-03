import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { completeTreasuryWithdrawalSchema } from "@/lib/validation-schemas";
import { completeTreasuryWithdrawal } from "@/lib/treasury";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "treasury.approve");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, completeTreasuryWithdrawalSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const result = await completeTreasuryWithdrawal({
      supabase,
      withdrawalId: id,
      externalReference: parsed.data.external_reference,
      adminId,
      note: parsed.data.completion_note || null,
    });

    if (!result.ok) {
      return apiError("withdrawal_completion_failed", result.reason, 400);
    }

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: id,
      action: "treasury_withdrawal_completed",
      changes: {
        external_reference: parsed.data.external_reference,
        completion_note: parsed.data.completion_note || null,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, duplicate: result.duplicate });
  } catch (error) {
    return dbError(error, "Failed to complete withdrawal.");
  }
}
