import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { createCashBankAccountSchema } from "@/lib/validation-schemas";
import { encryptCashAccountNumber, listCashBankAccounts, maskCashAccountNumber } from "@/lib/cash";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "cash.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const accounts = await listCashBankAccounts(supabase);
    return NextResponse.json({ accounts });
  } catch (error) {
    return dbError(error, "Failed to load cash bank accounts.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "cash.bank_account.manage");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createCashBankAccountSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const nowIso = new Date().toISOString();
    const input = parsed.data;
    const bankName = input.bank_name.trim();
    const normalizedLabel = String(input.label || "").trim() || bankName;
    const normalizedAccountName = String(input.account_name || "").trim();
    const normalizedAccountNumber = String(input.account_number || "").trim();

    const { data: existing } = await supabase
      .from("cash_bank_accounts")
      .select("id")
      .eq("label", normalizedLabel)
      .maybeSingle();

    if (existing) {
      return apiError("bank_account_exists", "A cash bank account with this label already exists.", 409);
    }

    const { data: account, error } = await supabase
      .from("cash_bank_accounts")
      .insert({
        label: normalizedLabel,
        bank_name: bankName,
        account_name: normalizedAccountName,
        account_number_encrypted: encryptCashAccountNumber(normalizedAccountNumber),
        account_number_masked: maskCashAccountNumber(normalizedAccountNumber),
        branch_label: input.branch_label || null,
        is_active: true,
        created_by_admin_id: adminId,
        updated_by_admin_id: adminId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, label, bank_name, account_name, account_number_masked, branch_label, is_active, created_at, updated_at")
      .single();

    if (error || !account) return dbError(error, "Failed to save cash bank account.");

    await supabase.from("audit_log").insert({
      entity_type: "cash_bank_account",
      entity_id: account.id,
      action: "cash_bank_account_created",
      changes: {
        label: account.label,
        bank_name: account.bank_name,
        account_name: account.account_name,
        account_number_masked: account.account_number_masked,
        branch_label: account.branch_label,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    return dbError(error, "Failed to save cash bank account.");
  }
}
