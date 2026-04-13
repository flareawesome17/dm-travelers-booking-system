import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, checkRateLimit, dbError, parseAndValidate, rateLimitResponse } from "@/lib/api-security";
import { createCashDepositRequestSchema } from "@/lib/validation-schemas";
import { listCashDepositRequests } from "@/lib/cash";

function getRecordStatus(code: string) {
  if (code === "bank_account_not_found") return 404;
  if (code === "bank_account_inactive") return 400;
  if (code === "invalid_proof_bucket" || code === "insufficient_cash") return 400;
  return 400;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "cash.read");
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "").trim() || null;
    const supabase = getSupabaseAdmin();
    const deposits = await listCashDepositRequests(supabase, { status, limit: 200 });
    return NextResponse.json({ deposits });
  } catch (error) {
    return dbError(error, "Failed to load cash deposit history.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "cash.deposit.request");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(req, {
    key: "admin_cash_deposit_request",
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, createCashDepositRequestSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const input = parsed.data;

    const { data: bankAccount, error: bankAccountError } = await supabase
      .from("cash_bank_accounts")
      .select("id, label, bank_name, account_name, account_number_masked, branch_label, is_active")
      .eq("id", input.bank_account_id)
      .single();

    if (bankAccountError || !bankAccount) {
      return apiError("bank_account_not_found", "Cash bank account not found.", 404);
    }
    if (!bankAccount.is_active) {
      return apiError("bank_account_inactive", "This cash bank account is inactive.", 400);
    }
    if (input.proof.bucket !== "cash-deposit-proofs") {
      return apiError("invalid_proof_bucket", "Deposit proof bucket is invalid.", 400);
    }

    const amount = Number(input.amount.toFixed(2));
    const depositedAt = new Date(input.deposited_at).toISOString();

    const { data: recordResult, error } = await supabase.rpc("record_cash_deposit_request", {
      p_amount: amount,
      p_deposit_reference: input.deposit_reference,
      p_deposited_at: depositedAt,
      p_bank_account_id: bankAccount.id,
      p_bank_account_label: bankAccount.label,
      p_bank_name: bankAccount.bank_name,
      p_account_name: bankAccount.account_name,
      p_account_number_masked: bankAccount.account_number_masked,
      p_branch_label: bankAccount.branch_label || null,
      p_proof_bucket: input.proof.bucket,
      p_proof_path: input.proof.path,
      p_proof_filename: input.proof.filename,
      p_proof_content_type: input.proof.content_type,
      p_proof_size_bytes: input.proof.size,
      p_note: input.note || null,
      p_admin_id: adminId,
    });

    if (error) return dbError(error, "Failed to record cash deposit.");

    const result = typeof recordResult === "object" && recordResult !== null
      ? recordResult as Record<string, unknown>
      : null;

    if (!result || result.ok !== true || typeof result.deposit_id !== "string") {
      return apiError(
        String(result?.error_code || "recording_failed"),
        String(result?.error_message || "Cash deposit recording failed."),
        getRecordStatus(String(result?.error_code || "")),
      );
    }

    const { data: deposit, error: depositError } = await supabase
      .from("cash_deposit_requests")
      .select("*")
      .eq("id", result.deposit_id)
      .single();

    if (depositError || !deposit) return dbError(depositError, "Failed to load recorded cash deposit.");

    await supabase.from("audit_log").insert({
      entity_type: "cash_deposit_request",
      entity_id: deposit.id,
      action: "cash_deposit_recorded",
      changes: {
        amount: deposit.amount,
        deposit_reference: deposit.deposit_reference,
        deposited_at: deposit.deposited_at,
        bank_account_label: deposit.bank_account_label,
        bank_name: deposit.bank_name,
        account_number_masked: deposit.account_number_masked,
        ledger_entry_id: result.ledger_entry_id || null,
        available_cash_after: result.available_cash_after || null,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      success: true,
      deposit,
      available_cash_after: result.available_cash_after ?? null,
    }, { status: 201 });
  } catch (error) {
    return dbError(error, "Failed to record cash deposit.");
  }
}
