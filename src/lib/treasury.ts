import crypto from "crypto";
import { requireEnvSecret, timingSafeCompare } from "@/lib/api-security";
import { extractWalletTransaction } from "@/lib/paymongo";
import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RecordHotelTreasuryInflowParams = {
  supabase: SupabaseAdminClient;
  bookingId: string;
  paymongoPaymentId: string;
  paymentIntentId?: string | null;
  grossAmount: number;
  netAmount?: number | null;
  feeAmount?: number | null;
  paidAtIso?: string | null;
  metadata?: Record<string, unknown>;
};

type CompleteTreasuryWithdrawalParams = {
  supabase: SupabaseAdminClient;
  withdrawalId: string;
  externalReference: string;
  adminId?: string | null;
  note?: string | null;
};

type SyncTreasuryWithdrawalParams = {
  supabase: SupabaseAdminClient;
  withdrawalId: string;
  payload: unknown;
  adminId?: string | null;
  note?: string | null;
  source: "submit" | "callback" | "sync";
};

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function getTreasuryEncryptionKey() {
  const directSecret = process.env.TREASURY_DESTINATION_SECRET?.trim();
  const fallbackSecret = process.env.JWT_SECRET?.trim();
  const secret = directSecret || fallbackSecret || requireEnvSecret("TREASURY_DESTINATION_SECRET");
  return crypto.createHash("sha256").update(secret).digest();
}

function getTreasuryCallbackSecret() {
  return (
    process.env.PAYMONGO_TREASURY_CALLBACK_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    requireEnvSecret("JWT_SECRET")
  );
}

function appendAuditMeta(base: unknown, patch: Record<string, unknown>) {
  return {
    ...((typeof base === "object" && base ? base : {}) as Record<string, unknown>),
    ...patch,
  };
}

export function encryptTreasuryAccountNumber(value: string) {
  const normalized = value.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTreasuryEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptTreasuryAccountNumber(payload: string) {
  const [ivB64, tagB64, dataB64] = String(payload || "").split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid treasury account payload.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getTreasuryEncryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskAccountNumber(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  if (!trimmed) return "";
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function signTreasuryCallbackToken(withdrawalId: string, idempotencyKey: string) {
  return crypto
    .createHmac("sha256", getTreasuryCallbackSecret())
    .update(`${withdrawalId}:${idempotencyKey}`)
    .digest("hex");
}

export function verifyTreasuryCallbackToken(withdrawalId: string, idempotencyKey: string, token: string) {
  const expected = signTreasuryCallbackToken(withdrawalId, idempotencyKey);
  return timingSafeCompare(expected, String(token || ""));
}

export async function listTreasuryDestinations(supabase: SupabaseAdminClient) {
  const { data, error } = await supabase
    .from("treasury_destinations")
    .select("id, label, provider, institution_name, institution_code, account_name, account_number_masked, is_active, created_at, updated_at")
    .order("label", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function recordHotelTreasuryInflow(params: RecordHotelTreasuryInflowParams) {
  const paymongoPaymentId = String(params.paymongoPaymentId || "").trim();
  if (!paymongoPaymentId) {
    return { ok: false as const, reason: "Missing PayMongo payment id." };
  }

  const { data: existingEntry } = await params.supabase
    .from("treasury_ledger_entries")
    .select("id")
    .eq("entry_type", "hotel_paymongo_inflow")
    .eq("external_payment_id", paymongoPaymentId)
    .maybeSingle();

  if (existingEntry) {
    return { ok: true as const, duplicate: true as const };
  }

  const { data: paymentRow } = await params.supabase
    .from("payments")
    .select("id, booking_id, amount, transaction_id, status")
    .eq("transaction_id", paymongoPaymentId)
    .eq("method", "QRPh")
    .maybeSingle();

  if (paymentRow && String(paymentRow.status) !== "Success") {
    return { ok: false as const, reason: "Only successful PayMongo payments can enter treasury." };
  }

  const ledgerAmount = toMoney(params.netAmount ?? params.grossAmount);
  if (ledgerAmount <= 0) {
    return { ok: false as const, reason: "Treasury inflow amount must be positive." };
  }

  const paidAtIso = params.paidAtIso && !Number.isNaN(new Date(params.paidAtIso).getTime())
    ? new Date(params.paidAtIso).toISOString()
    : new Date().toISOString();

  const { error } = await params.supabase.from("treasury_ledger_entries").insert({
    direction: "credit",
    entry_type: "hotel_paymongo_inflow",
    amount: ledgerAmount,
    currency: "PHP",
    provider: "PayMongo",
    source_app: "hotel",
    booking_id: paymentRow?.booking_id || params.bookingId,
    payment_row_id: paymentRow?.id || null,
    external_payment_id: paymongoPaymentId,
    payment_intent_id: params.paymentIntentId || null,
    description: "Hotel PayMongo inflow",
    meta: {
      gross_amount: toMoney(params.grossAmount),
      net_amount: ledgerAmount,
      fee_amount: toMoney(params.feeAmount),
      paid_at: paidAtIso,
      ...(params.metadata || {}),
    },
    created_at: paidAtIso,
  });

  if (error) {
    return { ok: false as const, reason: error.message || "Failed to record treasury inflow." };
  }

  return { ok: true as const, duplicate: false as const };
}

export async function getTreasurySummary(supabase: SupabaseAdminClient) {
  const [
    { data: ledgerTotals, error: ledgerTotalsError },
    { data: recentLedgerEntries, error: recentLedgerError },
    { data: withdrawalTotals, error: withdrawalTotalsError },
    { data: recentWithdrawals, error: recentWithdrawalsError },
    { data: destinations, error: destinationsError },
  ] = await Promise.all([
    supabase
      .from("treasury_ledger_entries")
      .select("direction, entry_type, amount, meta"),
    supabase
      .from("treasury_ledger_entries")
      .select("id, direction, entry_type, amount, currency, provider, booking_id, withdrawal_id, external_payment_id, payment_intent_id, description, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("treasury_withdrawals")
      .select("amount, status"),
    supabase
      .from("treasury_withdrawals")
      .select("id, amount, currency, status, destination_id, destination_label, destination_provider, destination_institution_name, destination_institution_code, destination_account_name, destination_account_masked, request_note, failure_message, external_reference, paymongo_wallet_id, paymongo_wallet_transaction_id, paymongo_transfer_id, paymongo_reference_number, paymongo_status, paymongo_provider_error_code, paymongo_provider_error, submitted_at, last_synced_at, requested_by_admin_id, approved_by_admin_id, requested_at, approved_at, processed_at, completed_at, cancelled_at, failed_at, meta, created_at, updated_at")
      .order("requested_at", { ascending: false })
      .limit(50),
    supabase
      .from("treasury_destinations")
      .select("id, label, provider, institution_name, institution_code, account_name, account_number_masked, is_active, created_at, updated_at")
      .order("label", { ascending: true }),
  ]);

  if (ledgerTotalsError) throw ledgerTotalsError;
  if (recentLedgerError) throw recentLedgerError;
  if (withdrawalTotalsError) throw withdrawalTotalsError;
  if (recentWithdrawalsError) throw recentWithdrawalsError;
  if (destinationsError) throw destinationsError;

  let totalCredits = 0;
  let totalDebits = 0;
  let hotelCollectedGross = 0;
  let hotelCollectedNet = 0;
  let paymongoFees = 0;

  for (const entry of ledgerTotals ?? []) {
    const amount = toMoney(entry.amount);
    if (entry.entry_type === "hotel_paymongo_inflow") {
      totalCredits += amount;
      const meta = typeof entry.meta === "object" && entry.meta ? entry.meta as Record<string, unknown> : {};
      hotelCollectedGross += toMoney(meta.gross_amount ?? amount);
      hotelCollectedNet += amount;
      paymongoFees += toMoney(meta.fee_amount);
    }
    if (entry.entry_type === "withdrawal_completed") {
      totalDebits += amount;
    }
  }

  let pendingWithdrawals = 0;
  let completedWithdrawals = 0;

  for (const withdrawal of withdrawalTotals ?? []) {
    const amount = toMoney(withdrawal.amount);
    if (["pending_review", "approved", "processing"].includes(String(withdrawal.status))) {
      pendingWithdrawals += amount;
    }
    if (String(withdrawal.status) === "succeeded") {
      completedWithdrawals += amount;
    }
  }

  const currentLedgerBalance = Math.max(0, Number((totalCredits - totalDebits).toFixed(2)));
  const withdrawableAmount = Math.max(0, Number((currentLedgerBalance - pendingWithdrawals).toFixed(2)));

  return {
    hotel_collected_gross: Number(hotelCollectedGross.toFixed(2)),
    hotel_collected_net: Number(hotelCollectedNet.toFixed(2)),
    paymongo_fees: Number(paymongoFees.toFixed(2)),
    completed_withdrawals: Number(completedWithdrawals.toFixed(2)),
    pending_withdrawals: Number(pendingWithdrawals.toFixed(2)),
    ledger_balance: currentLedgerBalance,
    withdrawable_amount: withdrawableAmount,
    entries: recentLedgerEntries ?? [],
    withdrawals: recentWithdrawals ?? [],
    destinations: destinations ?? [],
  };
}

export async function completeTreasuryWithdrawal(params: CompleteTreasuryWithdrawalParams) {
  const nowIso = new Date().toISOString();
  const { data: withdrawal, error } = await params.supabase
    .from("treasury_withdrawals")
    .select("id, amount, currency, status, destination_label, destination_provider, destination_institution_name, destination_institution_code, destination_account_name, destination_account_masked, request_note, meta")
    .eq("id", params.withdrawalId)
    .single();

  if (error || !withdrawal) {
    return { ok: false as const, reason: "Withdrawal request not found." };
  }

  const status = String(withdrawal.status || "");
  if (status === "succeeded") {
    return { ok: true as const, duplicate: true as const };
  }
  if (!["approved", "processing"].includes(status)) {
    return { ok: false as const, reason: "Only approved withdrawals can be completed." };
  }

  const { data: existingLedger } = await params.supabase
    .from("treasury_ledger_entries")
    .select("id")
    .eq("entry_type", "withdrawal_completed")
    .eq("withdrawal_id", withdrawal.id)
    .maybeSingle();

  if (!existingLedger) {
    const { error: insertError } = await params.supabase.from("treasury_ledger_entries").insert({
      direction: "debit",
      entry_type: "withdrawal_completed",
      amount: toMoney(withdrawal.amount),
      currency: String(withdrawal.currency || "PHP"),
      provider: "PayMongo",
      source_app: "hotel",
      withdrawal_id: withdrawal.id,
      description: `Treasury withdrawal to ${withdrawal.destination_label}`,
      meta: {
        destination_label: withdrawal.destination_label,
        destination_provider: withdrawal.destination_provider || null,
        destination_institution_name: withdrawal.destination_institution_name || null,
        destination_institution_code: withdrawal.destination_institution_code || null,
        destination_account_name: withdrawal.destination_account_name || null,
        destination_account_masked: withdrawal.destination_account_masked || null,
        note: params.note || withdrawal.request_note || null,
        completed_by_admin_id: params.adminId || null,
        external_reference: params.externalReference,
      },
      created_at: nowIso,
    });

    if (insertError) {
      return { ok: false as const, reason: insertError.message || "Failed to write treasury debit entry." };
    }
  }

  const { error: updateError } = await params.supabase
    .from("treasury_withdrawals")
    .update({
      status: "succeeded",
      external_reference: params.externalReference,
      failure_message: null,
      processed_at: nowIso,
      completed_at: nowIso,
      updated_at: nowIso,
      meta: {
        ...((typeof withdrawal.meta === "object" && withdrawal.meta ? withdrawal.meta : {}) as Record<string, unknown>),
        completed_by_admin_id: params.adminId || null,
        completion_note: params.note || null,
      },
    })
    .eq("id", withdrawal.id);

  if (updateError) {
    return { ok: false as const, reason: updateError.message || "Failed to complete withdrawal." };
  }

  return { ok: true as const, duplicate: false as const };
}

export async function syncTreasuryWithdrawalFromPaymongo(params: SyncTreasuryWithdrawalParams) {
  const parsed = extractWalletTransaction(params.payload);
  if (!parsed.walletTransactionId) {
    return { ok: false as const, reason: "PayMongo wallet transaction ID is missing." };
  }

  const { data: withdrawal, error } = await params.supabase
    .from("treasury_withdrawals")
    .select("id, amount, currency, status, destination_label, request_note, meta")
    .eq("id", params.withdrawalId)
    .single();

  if (error || !withdrawal) {
    return { ok: false as const, reason: "Withdrawal request not found." };
  }

  const nowIso = new Date().toISOString();
  const mappedStatus =
    parsed.status === "succeeded" ? "processing" : parsed.status === "failed" ? "failed" : "processing";
  const failureMessage =
    parsed.providerError ||
    (parsed.status === "failed" ? "PayMongo marked this transfer as failed." : null);
  const externalReference =
    parsed.referenceNumber || parsed.transferId || parsed.walletTransactionId;

  const { error: updateError } = await params.supabase
    .from("treasury_withdrawals")
    .update({
      status: parsed.status === "succeeded" ? "processing" : mappedStatus,
      currency: parsed.currency || String(withdrawal.currency || "PHP"),
      paymongo_wallet_id: parsed.walletId,
      paymongo_wallet_transaction_id: parsed.walletTransactionId,
      paymongo_transfer_id: parsed.transferId || null,
      paymongo_reference_number: parsed.referenceNumber || null,
      paymongo_status: parsed.status,
      paymongo_provider_error_code: parsed.providerErrorCode || null,
      paymongo_provider_error: parsed.providerError || null,
      external_reference: parsed.status === "succeeded" ? externalReference : withdrawal.status === "succeeded" ? externalReference : null,
      failure_message: parsed.status === "failed" ? failureMessage : null,
      failed_at: parsed.status === "failed" ? nowIso : null,
      submitted_at: parsed.createdAtIso || nowIso,
      last_synced_at: nowIso,
      updated_at: nowIso,
      meta: appendAuditMeta(withdrawal.meta, {
        paymongo_callback_url: parsed.callbackUrl || null,
        paymongo_description: parsed.description || null,
        paymongo_purpose: parsed.purpose || null,
        paymongo_transaction_type: parsed.type || null,
        paymongo_submission_source: params.source,
        paymongo_receiver: {
          bank_account_name: parsed.receiver.bankAccountName,
          bank_account_number_masked: parsed.receiver.bankAccountNumber
            ? maskAccountNumber(parsed.receiver.bankAccountNumber)
            : null,
          bank_code: parsed.receiver.bankCode,
          bank_name: parsed.receiver.bankName,
        },
        paymongo_sender: {
          bank_account_name: parsed.sender.bankAccountName,
          bank_account_number_masked: parsed.sender.bankAccountNumber
            ? maskAccountNumber(parsed.sender.bankAccountNumber)
            : null,
          bank_code: parsed.sender.bankCode,
          bank_name: parsed.sender.bankName,
        },
      }),
    })
    .eq("id", withdrawal.id);

  if (updateError) {
    return { ok: false as const, reason: updateError.message || "Failed to update treasury withdrawal state." };
  }

  if (parsed.status === "failed") {
    return { ok: true as const, status: "failed" as const, externalReference };
  }

  if (parsed.status === "succeeded") {
    const completed = await completeTreasuryWithdrawal({
      supabase: params.supabase,
      withdrawalId: withdrawal.id,
      externalReference,
      adminId: params.adminId,
      note: params.note || `Completed via PayMongo ${params.source} sync.`,
    });

    if (!completed.ok) {
      return { ok: false as const, reason: completed.reason };
    }

    return {
      ok: true as const,
      status: "succeeded" as const,
      externalReference,
      duplicate: completed.duplicate,
    };
  }

  return { ok: true as const, status: "processing" as const, externalReference };
}
