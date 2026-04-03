import { NextRequest, NextResponse } from "next/server";
import { apiError, dbError } from "@/lib/api-security";
import { getSupabaseAdmin } from "@/lib/supabase";
import { syncTreasuryWithdrawalFromPaymongo, verifyTreasuryCallbackToken } from "@/lib/treasury";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const withdrawalId = String(url.searchParams.get("withdrawal_id") || "").trim();
    const token = String(url.searchParams.get("token") || "").trim();

    if (!withdrawalId || !token) {
      return apiError("invalid_callback", "Missing callback credentials.", 401);
    }

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return apiError("invalid_json", "Callback payload must be valid JSON.", 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .select("id, idempotency_key")
      .eq("id", withdrawalId)
      .single();

    if (error || !withdrawal) {
      return apiError("not_found", "Withdrawal request not found.", 404);
    }

    if (!verifyTreasuryCallbackToken(withdrawal.id, String(withdrawal.idempotency_key || ""), token)) {
      return apiError("invalid_callback", "Callback token mismatch.", 401);
    }

    const synced = await syncTreasuryWithdrawalFromPaymongo({
      supabase,
      withdrawalId: withdrawal.id,
      payload,
      note: "Updated from PayMongo callback.",
      source: "callback",
    });

    if (!synced.ok) {
      return apiError("callback_sync_failed", synced.reason, 400);
    }

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: withdrawal.id,
      action: "treasury_withdrawal_callback_received",
      changes: {
        status: synced.status,
        external_reference: synced.externalReference || null,
      },
      performed_by_admin_id: null,
    });

    return NextResponse.json({ received: true, status: synced.status });
  } catch (error) {
    return dbError(error, "Failed to process PayMongo treasury callback.");
  }
}
