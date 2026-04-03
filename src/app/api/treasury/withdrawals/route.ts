import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, checkRateLimit, dbError, parseAndValidate, rateLimitResponse } from "@/lib/api-security";
import { createTreasuryWithdrawalSchema } from "@/lib/validation-schemas";
import { getTreasurySummary } from "@/lib/treasury";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "treasury.withdraw");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(req, {
    key: "admin_treasury_withdrawals",
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const parsed = await parseAndValidate(req, createTreasuryWithdrawalSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const summary = await getTreasurySummary(supabase);
    const amount = Number(parsed.data.amount.toFixed(2));

    if (amount > summary.withdrawable_amount) {
      return apiError(
        "withdrawal_exceeds_available",
        `Requested amount exceeds hotel withdrawable funds. Available: ${summary.withdrawable_amount.toFixed(2)}.`,
        400
      );
    }

    const nowIso = new Date().toISOString();
    const { data: destination, error: destinationError } = await supabase
      .from("treasury_destinations")
      .select("id, label, provider, institution_name, institution_code, account_name, account_number_masked, is_active")
      .eq("id", parsed.data.destination_id)
      .single();

    if (destinationError || !destination) {
      return apiError("destination_not_found", "Treasury destination not found.", 404);
    }
    if (!destination.is_active) {
      return apiError("destination_inactive", "This treasury destination is inactive.", 400);
    }

    const idempotencyKey = crypto.randomUUID();

    const { data: withdrawal, error } = await supabase
      .from("treasury_withdrawals")
      .insert({
        provider: "PayMongo",
        amount,
        currency: "PHP",
        status: "pending_review",
        destination_id: destination.id,
        destination_label: destination.label,
        destination_provider: destination.provider,
        destination_institution_name: destination.institution_name,
        destination_institution_code: destination.institution_code,
        destination_account_name: destination.account_name,
        destination_account_masked: destination.account_number_masked,
        request_note: parsed.data.request_note || null,
        idempotency_key: idempotencyKey,
        requested_by_admin_id: adminId,
        requested_at: nowIso,
        updated_at: nowIso,
        meta: {
          destination_id: destination.id,
          destination_account_masked: destination.account_number_masked,
          source_app: "hotel",
        },
      })
      .select("id, amount, status, destination_id, destination_label, destination_provider, destination_institution_name, destination_institution_code, destination_account_name, destination_account_masked, requested_at")
      .single();

    if (error || !withdrawal) return dbError(error, "Failed to create treasury withdrawal request.");

    await supabase.from("audit_log").insert({
      entity_type: "treasury_withdrawal",
      entity_id: withdrawal.id,
      action: "treasury_withdrawal_requested",
      changes: {
        amount,
        destination_label: destination.label,
        destination_provider: destination.provider,
        destination_institution_name: destination.institution_name,
        destination_institution_code: destination.institution_code,
        destination_account_name: destination.account_name,
        destination_account_masked: destination.account_number_masked,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({
      success: true,
      withdrawal,
      withdrawable_amount: summary.withdrawable_amount,
    });
  } catch (error) {
    return dbError(error, "Failed to create treasury withdrawal request.");
  }
}
