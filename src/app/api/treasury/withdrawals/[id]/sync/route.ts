import { NextRequest, NextResponse } from "next/server";
import { apiError, checkRateLimit, dbError, rateLimitResponse } from "@/lib/api-security";
import { retrieveWalletTransaction } from "@/lib/paymongo";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { syncTreasuryWithdrawalFromPaymongo } from "@/lib/treasury";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "treasury.approve");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(req, {
    key: "admin_treasury_sync",
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .select("id, status, paymongo_wallet_id, paymongo_wallet_transaction_id")
      .eq("id", id)
      .single();

    if (error || !withdrawal) {
      return apiError("not_found", "Withdrawal request not found.", 404);
    }
    if (!withdrawal.paymongo_wallet_id || !withdrawal.paymongo_wallet_transaction_id) {
      return apiError("not_submitted", "This withdrawal has not been submitted to PayMongo yet.", 400);
    }

    const payload = await retrieveWalletTransaction({
      walletId: withdrawal.paymongo_wallet_id,
      walletTransactionId: withdrawal.paymongo_wallet_transaction_id,
    });

    const synced = await syncTreasuryWithdrawalFromPaymongo({
      supabase,
      withdrawalId: withdrawal.id,
      payload,
      adminId,
      note: "Synced from PayMongo Treasury status check.",
      source: "sync",
    });

    if (!synced.ok) {
      return apiError("paymongo_sync_failed", synced.reason, 400);
    }

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: withdrawal.id,
      action: "treasury_withdrawal_synced_from_paymongo",
      changes: {
        status: synced.status,
        wallet_transaction_id: withdrawal.paymongo_wallet_transaction_id,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      success: true,
      status: synced.status,
      external_reference: synced.externalReference || null,
    });
  } catch (error) {
    return dbError(error, "Failed to sync PayMongo withdrawal status.");
  }
}
