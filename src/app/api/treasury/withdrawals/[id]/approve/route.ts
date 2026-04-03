import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { approveTreasuryWithdrawalSchema } from "@/lib/validation-schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "treasury.approve");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, approveTreasuryWithdrawalSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const roleId = Number(auth.payload.role_id);

    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .select("id, status, requested_by_admin_id, meta")
      .eq("id", id)
      .single();

    if (error || !withdrawal) return apiError("not_found", "Withdrawal request not found.", 404);
    if (String(withdrawal.status) !== "pending_review") {
      return apiError("invalid_status", "Only pending withdrawal requests can be approved.", 400);
    }
    if (adminId && withdrawal.requested_by_admin_id === adminId && roleId !== 1) {
      return apiError("approval_conflict", "A different authorized admin must approve this withdrawal.", 403);
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("treasury_withdrawals")
      .update({
        status: "approved",
        approved_by_admin_id: adminId,
        approved_at: nowIso,
        updated_at: nowIso,
        meta: {
          ...((typeof withdrawal.meta === "object" && withdrawal.meta ? withdrawal.meta : {}) as Record<string, unknown>),
          approval_note: parsed.data.approval_note || null,
        },
      })
      .eq("id", id);

    if (updateError) return dbError(updateError, "Failed to approve withdrawal request.");

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: id,
      action: "treasury_withdrawal_approved",
      changes: {
        approval_note: parsed.data.approval_note || null,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return dbError(error, "Failed to approve withdrawal request.");
  }
}
