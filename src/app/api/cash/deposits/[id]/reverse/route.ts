import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { reverseCashDepositSchema } from "@/lib/validation-schemas";

function getReverseStatus(code: string) {
  if (code === "not_found") return 404;
  if (code === "invalid_status" || code === "already_reversed") return 400;
  return 400;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "cash.deposit.reverse");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, reverseCashDepositSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data: reverseResult, error } = await supabase.rpc("reverse_cash_deposit_request", {
      p_request_id: id,
      p_admin_id: adminId,
      p_reason: parsed.data.reversal_reason,
    });

    if (error) return dbError(error, "Failed to reverse cash deposit.");

    const result = typeof reverseResult === "object" && reverseResult !== null
      ? reverseResult as Record<string, unknown>
      : null;

    if (!result || result.ok !== true) {
      return apiError(
        String(result?.error_code || "reversal_failed"),
        String(result?.error_message || "Cash deposit reversal failed."),
        getReverseStatus(String(result?.error_code || "")),
      );
    }

    await supabase.from("audit_log").insert({
      entity_type: "cash_deposit_request",
      entity_id: id,
      action: "cash_deposit_reversed",
      changes: {
        reversal_reason: parsed.data.reversal_reason,
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
    return dbError(error, "Failed to reverse cash deposit.");
  }
}
