import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { approveCashDepositSchema } from "@/lib/validation-schemas";

function getApprovalStatus(code: string) {
  if (code === "not_found") return 404;
  if (code === "approval_conflict") return 403;
  if (code === "insufficient_cash") return 400;
  if (code === "invalid_status") return 400;
  return 400;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "cash.deposit.approve");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, approveCashDepositSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data: approvalResult, error } = await supabase.rpc("approve_cash_deposit_request", {
      p_request_id: id,
      p_admin_id: adminId,
      p_approval_note: parsed.data.approval_note || null,
    });

    if (error) return dbError(error, "Failed to approve cash deposit request.");

    const result = typeof approvalResult === "object" && approvalResult !== null
      ? approvalResult as Record<string, unknown>
      : null;

    if (!result || result.ok !== true) {
      return apiError(
        String(result?.error_code || "approval_failed"),
        String(result?.error_message || "Cash deposit approval failed."),
        getApprovalStatus(String(result?.error_code || "")),
      );
    }

    await supabase.from("audit_log").insert({
      entity_type: "cash_deposit_request",
      entity_id: id,
      action: "cash_deposit_approved",
      changes: {
        approval_note: parsed.data.approval_note || null,
        ledger_entry_id: result.ledger_entry_id || null,
        available_cash_after: result.available_cash_after || null,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      success: true,
      available_cash_after: result.available_cash_after ?? null,
    });
  } catch (error) {
    return dbError(error, "Failed to approve cash deposit request.");
  }
}
