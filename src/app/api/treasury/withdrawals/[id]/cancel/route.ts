import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError } from "@/lib/api-security";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "treasury.approve");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .select("id, status")
      .eq("id", id)
      .single();

    if (error || !withdrawal) return apiError("not_found", "Withdrawal request not found.", 404);
    if (["succeeded", "cancelled"].includes(String(withdrawal.status))) {
      return apiError("invalid_status", "This withdrawal can no longer be cancelled.", 400);
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("treasury_withdrawals")
      .update({
        status: "cancelled",
        cancelled_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (updateError) return dbError(updateError, "Failed to cancel withdrawal request.");

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: id,
      action: "treasury_withdrawal_cancelled",
      changes: {},
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return dbError(error, "Failed to cancel withdrawal request.");
  }
}
