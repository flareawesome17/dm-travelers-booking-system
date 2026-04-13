import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { updateCashBankAccountSchema } from "@/lib/validation-schemas";
import { encryptCashAccountNumber, maskCashAccountNumber } from "@/lib/cash";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "cash.bank_account.manage");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateCashBankAccountSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const nowIso = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from("cash_bank_accounts")
      .select("id, label, bank_name, account_name, account_number_masked, branch_label, is_active")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return apiError("not_found", "Cash bank account not found.", 404);
    }

    const updatePayload: Record<string, unknown> = {
      updated_by_admin_id: adminId,
      updated_at: nowIso,
    };

    const nextBankName = parsed.data.bank_name !== undefined ? parsed.data.bank_name.trim() : existing.bank_name;
    const nextLabel = parsed.data.label !== undefined ? parsed.data.label.trim() : (parsed.data.bank_name !== undefined ? nextBankName : existing.label);

    if (nextLabel !== existing.label) {
      const { data: duplicate } = await supabase
        .from("cash_bank_accounts")
        .select("id")
        .eq("label", nextLabel)
        .neq("id", id)
        .maybeSingle();

      if (duplicate) {
        return apiError("bank_account_exists", "A cash bank account with this label already exists.", 409);
      }
    }

    if (nextLabel !== existing.label) updatePayload.label = nextLabel;
    if (nextBankName !== existing.bank_name) updatePayload.bank_name = nextBankName;
    if (parsed.data.account_name !== undefined) updatePayload.account_name = String(parsed.data.account_name || "").trim();
    if (parsed.data.branch_label !== undefined) updatePayload.branch_label = parsed.data.branch_label || null;
    if (parsed.data.is_active !== undefined) updatePayload.is_active = parsed.data.is_active;
    if (parsed.data.account_number !== undefined) {
      const normalizedAccountNumber = String(parsed.data.account_number || "").trim();
      updatePayload.account_number_encrypted = encryptCashAccountNumber(normalizedAccountNumber);
      updatePayload.account_number_masked = maskCashAccountNumber(normalizedAccountNumber);
    }

    const { data: account, error } = await supabase
      .from("cash_bank_accounts")
      .update(updatePayload)
      .eq("id", id)
      .select("id, label, bank_name, account_name, account_number_masked, branch_label, is_active, created_at, updated_at")
      .single();

    if (error || !account) return dbError(error, "Failed to update cash bank account.");

    await supabase.from("audit_log").insert({
      entity_type: "cash_bank_account",
      entity_id: account.id,
      action: "cash_bank_account_updated",
      changes: {
        before: existing,
        after: account,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    return dbError(error, "Failed to update cash bank account.");
  }
}
