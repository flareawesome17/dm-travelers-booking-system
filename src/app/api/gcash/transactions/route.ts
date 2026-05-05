import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, checkRateLimit, dbError, parseAndValidate, rateLimitResponse } from "@/lib/api-security";
import { createGcashTransactionSchema } from "@/lib/validation-schemas";
import { listGcashTransactions } from "@/lib/gcash";

function getRecordStatus(code: string) {
  if (code === "insufficient_gcash" || code === "invalid_amount" || code === "invalid_type") return 400;
  return 400;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "gcash.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const transactions = await listGcashTransactions(supabase, { limit: 200 });
    return NextResponse.json({ transactions });
  } catch (error) {
    return dbError(error, "Failed to load GCash transactions.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "gcash.transact");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(req, {
    key: "admin_gcash_transaction",
    maxRequests: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, createGcashTransactionSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const input = parsed.data;
    const amount = Number(input.amount.toFixed(2));
    const effectiveAt = input.effective_at ? new Date(input.effective_at).toISOString() : new Date().toISOString();

    const { data: recordResult, error } = await supabase.rpc("record_gcash_transaction", {
      p_entry_type: input.transaction_type,
      p_amount: amount,
      p_transaction_reference: input.transaction_reference || null,
      p_customer_name: input.customer_name || null,
      p_recipient_number: input.recipient_number || null,
      p_effective_at: effectiveAt,
      p_note: input.note || null,
      p_admin_id: adminId,
    });

    if (error) return dbError(error, "Failed to record GCash transaction.");

    const result = typeof recordResult === "object" && recordResult !== null
      ? recordResult as Record<string, unknown>
      : null;

    if (!result || result.ok !== true || typeof result.ledger_entry_id !== "string") {
      return apiError(
        String(result?.error_code || "recording_failed"),
        String(result?.error_message || "GCash transaction recording failed."),
        getRecordStatus(String(result?.error_code || "")),
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("gcash_ledger_entries")
      .select("*")
      .eq("id", result.ledger_entry_id)
      .single();

    if (transactionError || !transaction) {
      return dbError(transactionError, "Failed to load recorded GCash transaction.");
    }

    await supabase.from("audit_log").insert({
      entity_type: "gcash_ledger_entry",
      entity_id: transaction.id,
      action: "gcash_transaction_recorded",
      changes: {
        entry_type: transaction.entry_type,
        amount: transaction.amount,
        service_charge: transaction.service_charge,
        transaction_reference: transaction.transaction_reference,
        customer_name: transaction.customer_name,
        recipient_number: transaction.recipient_number,
        available_gcash_after: result.available_gcash_after || null,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      success: true,
      transaction,
      service_charge: result.service_charge ?? null,
      total_collected_from_customer: result.total_collected_from_customer ?? null,
      available_gcash_after: result.available_gcash_after ?? null,
    }, { status: 201 });
  } catch (error) {
    return dbError(error, "Failed to record GCash transaction.");
  }
}
