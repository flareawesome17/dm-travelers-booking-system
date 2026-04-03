import { NextRequest, NextResponse } from "next/server";
import { apiError, checkRateLimit, dbError, rateLimitResponse } from "@/lib/api-security";
import { createWalletTransaction, extractWalletAccounts, listWalletAccounts, retrieveWallet } from "@/lib/paymongo";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  decryptTreasuryAccountNumber,
  signTreasuryCallbackToken,
  syncTreasuryWithdrawalFromPaymongo,
} from "@/lib/treasury";

async function resolveTreasuryWalletId() {
  const configured = String(process.env.PAYMONGO_TREASURY_WALLET_ID || "").trim();
  if (configured) {
    return { ok: true as const, walletId: configured, source: "env" as const };
  }

  const payload = await listWalletAccounts();
  const wallets = extractWalletAccounts(payload).filter(
    (wallet) => (wallet.currency || "PHP").toUpperCase() === "PHP" && wallet.status !== "disabled"
  );

  if (wallets.length === 1) {
    return { ok: true as const, walletId: wallets[0].id, source: "auto" as const };
  }

  if (wallets.length === 0) {
    return {
      ok: false as const,
      reason: "No accessible PHP PayMongo wallet was returned. Set PAYMONGO_TREASURY_WALLET_ID in .env.local.",
    };
  }

  return {
    ok: false as const,
    reason: `Multiple PayMongo wallets were returned (${wallets.length}). Set PAYMONGO_TREASURY_WALLET_ID in .env.local to choose the correct wallet explicitly.`,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "treasury.approve");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(req, {
    key: "admin_treasury_submit",
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const walletResolution = await resolveTreasuryWalletId();

    if (!walletResolution.ok) {
      return apiError("wallet_not_configured", walletResolution.reason, 500);
    }
    const walletId = walletResolution.walletId;

    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .select("id, amount, currency, status, idempotency_key, destination_id, destination_label, destination_provider, destination_institution_code, destination_account_name, paymongo_wallet_transaction_id, meta")
      .eq("id", id)
      .single();

    if (error || !withdrawal) {
      return apiError("not_found", "Withdrawal request not found.", 404);
    }
    if (!["approved", "failed"].includes(String(withdrawal.status))) {
      return apiError("invalid_status", "Only approved or failed treasury withdrawals can be submitted to PayMongo.", 400);
    }
    if (!withdrawal.destination_id) {
      return apiError("missing_destination", "Withdrawal destination is incomplete.", 400);
    }

    const { data: destination, error: destinationError } = await supabase
      .from("treasury_destinations")
      .select("id, label, provider, institution_name, institution_code, account_name, account_number_encrypted, account_number_masked, is_active")
      .eq("id", withdrawal.destination_id)
      .single();

    if (destinationError || !destination) {
      return apiError("destination_not_found", "Treasury destination not found.", 404);
    }
    if (!destination.is_active) {
      return apiError("destination_inactive", "This treasury destination is inactive.", 400);
    }

    const callbackToken = signTreasuryCallbackToken(withdrawal.id, String(withdrawal.idempotency_key || ""));
    const callbackUrl = `${req.nextUrl.origin}/api/treasury/paymongo/callback?withdrawal_id=${encodeURIComponent(withdrawal.id)}&token=${callbackToken}`;

    try {
      await retrieveWallet(walletId);
    } catch (walletError) {
      return dbError(walletError, "Configured PayMongo treasury wallet could not be retrieved.");
    }

    const accountNumber = decryptTreasuryAccountNumber(destination.account_number_encrypted);
    const amountInCentavos = Math.max(1, Math.round(Number(withdrawal.amount || 0) * 100));

    try {
      const payload = await createWalletTransaction({
        walletId,
        amountInCentavos,
        provider: destination.provider,
        receiverBankAccountName: destination.account_name,
        receiverBankAccountNumber: accountNumber,
        receiverBankCode: destination.institution_code,
        description: `Hotel treasury withdrawal to ${destination.label}`,
        purpose: "Hotel treasury withdrawal",
        callbackUrl,
        metadata: {
          withdrawal_id: withdrawal.id,
          source_app: "hotel",
          destination_id: destination.id,
        },
        idempotencyKey: String(withdrawal.idempotency_key),
      });

      const synced = await syncTreasuryWithdrawalFromPaymongo({
        supabase,
        withdrawalId: withdrawal.id,
        payload,
        adminId,
        note: "Submitted to PayMongo from Treasury.",
        source: "submit",
      });

      if (!synced.ok) {
        return apiError("paymongo_sync_failed", synced.reason, 400);
      }

      await supabase.from("audit_log").insert({
        entity_type: "treasury_withdrawal",
        entity_id: withdrawal.id,
        action: "treasury_withdrawal_submitted_to_paymongo",
        changes: {
          wallet_id: walletId,
          wallet_source: walletResolution.source,
          callback_url: callbackUrl,
          status: synced.status,
        },
        performed_by_admin_id: adminId,
      });

      return NextResponse.json({
        success: true,
        status: synced.status,
        external_reference: synced.externalReference || null,
      });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Failed to submit withdrawal to PayMongo.";
      const nowIso = new Date().toISOString();

      await supabase
        .from("treasury_withdrawals")
        .update({
          status: "failed",
          paymongo_wallet_id: walletId,
          paymongo_status: "failed",
          paymongo_provider_error: message,
          failure_message: message,
          failed_at: nowIso,
          submitted_at: nowIso,
          last_synced_at: nowIso,
          updated_at: nowIso,
          meta: {
            ...((typeof withdrawal.meta === "object" && withdrawal.meta ? withdrawal.meta : {}) as Record<string, unknown>),
            paymongo_submit_failed: true,
          },
        })
        .eq("id", withdrawal.id);

      await supabase.from("audit_log").insert({
        entity_type: "treasury_withdrawal",
        entity_id: withdrawal.id,
        action: "treasury_withdrawal_submit_failed",
        changes: {
          wallet_id: walletId,
          error: message,
        },
        performed_by_admin_id: adminId,
      });

      return apiError("paymongo_submit_failed", message, 400);
    }
  } catch (error) {
    return dbError(error, "Failed to submit withdrawal to PayMongo.");
  }
}
