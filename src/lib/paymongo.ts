import crypto from "crypto";
import { requireEnvSecret, timingSafeCompare } from "@/lib/api-security";

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    const obj = asRecord(current);
    if (!obj || !(key in obj)) return undefined;
    current = obj[key];
  }
  return current;
}

function firstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractPaymongoErrorMessage(payload: unknown) {
  const errors = readPath(payload, ["errors"]);
  if (Array.isArray(errors) && errors.length > 0) {
    const first = asRecord(errors[0]);
    const detail = first ? first.detail : null;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    const code = first ? first.code : null;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  const message = readPath(payload, ["message"]);
  if (typeof message === "string" && message.trim()) return message.trim();
  return "PayMongo request failed.";
}

function getPaymongoBaseUrl() {
  return process.env.PAYMONGO_API_BASE_URL?.trim() || "https://api.paymongo.com/v1";
}

function getPaymongoSecretKey() {
  return requireEnvSecret("PAYMONGO_SECRET_KEY");
}

export async function paymongoRequest(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: JsonObject;
    idempotencyKey?: string;
  }
) {
  const secret = getPaymongoSecretKey();
  const url = `${getPaymongoBaseUrl().replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const auth = Buffer.from(`${secret}:`).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: options?.method || "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: unknown = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      throw new Error(extractPaymongoErrorMessage(payload));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizePaymongoIntentStatus(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "processing";
  if (raw === "succeeded") return "succeeded";
  if (raw === "awaiting_next_action") return "awaiting_next_action";
  if (raw === "awaiting_payment_method") return "awaiting_payment_method";
  if (raw === "cancelled") return "cancelled";
  return "processing";
}

export function normalizeSessionStatus(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "succeeded") return "succeeded";
  if (raw === "failed") return "failed";
  if (raw === "expired") return "expired";
  if (raw === "cancelled") return "cancelled";
  if (raw === "awaiting_payment_method") return "awaiting_payment_method";
  if (raw === "awaiting_next_action") return "awaiting_next_action";
  return "processing";
}

export function sanitizePaymongoQrExpirySeconds(value: unknown) {
  const fallback = 1_800;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 60) return 60;
  if (rounded > 9_000) return 9_000;
  return rounded;
}

export async function createQrPhPaymentIntent(args: {
  amountInCentavos: number;
  description: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}) {
  return paymongoRequest("/payment_intents", {
    method: "POST",
    idempotencyKey: args.idempotencyKey,
    body: {
      data: {
        attributes: {
          amount: args.amountInCentavos,
          currency: "PHP",
          capture_type: "automatic",
          payment_method_allowed: ["qrph"],
          description: args.description,
          metadata: args.metadata,
        },
      },
    },
  });
}

export async function createQrPhPaymentMethod(args: {
  name: string;
  email: string;
  phone?: string | null;
  expirySeconds: number;
  idempotencyKey: string;
}) {
  const billing: Record<string, unknown> = {
    name: args.name,
    email: args.email,
  };
  if (args.phone) billing.phone = args.phone;

  return paymongoRequest("/payment_methods", {
    method: "POST",
    idempotencyKey: args.idempotencyKey,
    body: {
      data: {
        attributes: {
          type: "qrph",
          expiry_seconds: sanitizePaymongoQrExpirySeconds(args.expirySeconds),
          billing,
        },
      },
    },
  });
}

export async function attachPaymentMethodToIntent(args: {
  paymentIntentId: string;
  paymentMethodId: string;
  idempotencyKey: string;
}) {
  return paymongoRequest(`/payment_intents/${args.paymentIntentId}/attach`, {
    method: "POST",
    idempotencyKey: args.idempotencyKey,
    body: {
      data: {
        attributes: {
          payment_method: args.paymentMethodId,
        },
      },
    },
  });
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  return paymongoRequest(`/payment_intents/${paymentIntentId}`);
}

export async function retrievePayment(paymentId: string) {
  return paymongoRequest(`/payments/${paymentId}`);
}

export async function retrieveWallet(walletId: string) {
  return paymongoRequest(`/wallets/${walletId}`);
}

export async function listWalletAccounts() {
  return paymongoRequest("/wallets");
}

export async function createWalletTransaction(args: {
  walletId: string;
  amountInCentavos: number;
  provider: "instapay" | "pesonet";
  receiverBankAccountName: string;
  receiverBankAccountNumber: string;
  receiverBankCode: string;
  description: string;
  purpose: string;
  callbackUrl?: string | null;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}) {
  return paymongoRequest(`/wallets/${args.walletId}/transactions`, {
    method: "POST",
    idempotencyKey: args.idempotencyKey,
    body: {
      data: {
        attributes: {
          amount: Math.max(1, Math.round(args.amountInCentavos)),
          currency: "PHP",
          provider: args.provider,
          // PayMongo's transfer guide and wallet-transaction callback schema use the legacy Wallet API shape here.
          type: "send_money",
          description: args.description,
          purpose: args.purpose,
          callback_url: args.callbackUrl || undefined,
          metadata: args.metadata || undefined,
          receiver: {
            bank_account_name: args.receiverBankAccountName,
            bank_account_number: args.receiverBankAccountNumber,
            bank_code: args.receiverBankCode,
          },
        },
      },
    },
  });
}

export async function retrieveWalletTransaction(args: {
  walletId: string;
  walletTransactionId: string;
}) {
  return paymongoRequest(`/wallets/${args.walletId}/transactions/${args.walletTransactionId}`);
}

export async function listReceivingInstitutions(provider: "instapay" | "pesonet") {
  const params = new URLSearchParams({ provider });
  return paymongoRequest(`/wallets/receiving_institutions?${params.toString()}`);
}

export function extractPaymentIntentId(payload: unknown) {
  return firstString(
    readPath(payload, ["data", "id"]),
    readPath(payload, ["id"])
  );
}

export function extractPaymentMethodId(payload: unknown) {
  return firstString(
    readPath(payload, ["data", "id"]),
    readPath(payload, ["id"])
  );
}

export function extractPaymentIntentStatus(payload: unknown) {
  return normalizePaymongoIntentStatus(
    readPath(payload, ["data", "attributes", "status"]) ??
      readPath(payload, ["attributes", "status"])
  );
}

export function extractPaymentIdFromPaymentIntent(payload: unknown) {
  const payments = readPath(payload, ["data", "attributes", "payments"]);
  if (Array.isArray(payments) && payments.length > 0) {
    const first = asRecord(payments[0]);
    if (first) {
      const id = firstString(first.id);
      if (id) return id;
      const nested = asRecord(first.data);
      if (nested) {
        const nestedId = firstString(nested.id);
        if (nestedId) return nestedId;
      }
    }
  }
  return null;
}

export function extractPaymentFinancials(payload: unknown) {
  const grossAmount = toFiniteNumber(
    readPath(payload, ["data", "attributes", "amount"]) ??
      readPath(payload, ["attributes", "amount"])
  );
  const feeAmount = toFiniteNumber(
    readPath(payload, ["data", "attributes", "fee"]) ??
      readPath(payload, ["data", "attributes", "fee_amount"]) ??
      readPath(payload, ["attributes", "fee"]) ??
      readPath(payload, ["attributes", "fee_amount"])
  );
  const netAmount = toFiniteNumber(
    readPath(payload, ["data", "attributes", "net_amount"]) ??
      readPath(payload, ["attributes", "net_amount"])
  );

  return {
    grossAmountInCentavos: grossAmount && grossAmount > 0 ? Math.round(grossAmount) : null,
    feeAmountInCentavos: feeAmount && feeAmount > 0 ? Math.round(feeAmount) : 0,
    netAmountInCentavos:
      netAmount && netAmount > 0
        ? Math.round(netAmount)
        : grossAmount && grossAmount > 0
          ? Math.max(0, Math.round(grossAmount - (feeAmount || 0)))
          : null,
  };
}

export function extractPaymentMetadata(payload: unknown) {
  const metadata = readPath(payload, ["data", "attributes", "metadata"]) ?? readPath(payload, ["attributes", "metadata"]);
  return asRecord(metadata) || {};
}

export function extractReceivingInstitutions(payload: unknown) {
  const rows = readPath(payload, ["data"]);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const record = asRecord(row);
      const attributes = asRecord(record?.attributes) || {};
      const code = firstString(
        record?.id,
        attributes.code,
        attributes.short_code,
        attributes.bank_code
      );
      const name = firstString(
        attributes.name,
        attributes.display_name,
        attributes.bank_name
      );
      const provider = firstString(
        attributes.provider,
        attributes.channel
      );

      if (!code || !name) return null;

      return {
        code,
        name,
        provider: provider?.toLowerCase() || null,
      };
    })
    .filter((item): item is { code: string; name: string; provider: string | null } => !!item)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeWalletTransactionStatus(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "succeeded") return "succeeded";
  if (raw === "failed") return "failed";
  if (raw === "pending") return "pending";
  return "pending";
}

export function extractWalletAccounts(payload: unknown) {
  const rows = readPath(payload, ["data"]);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const record = asRecord(row);
      const attrs = asRecord(record?.attributes) || {};
      const id = firstString(record?.id);
      if (!id) return null;

      return {
        id,
        status: firstString(attrs.status)?.toLowerCase() || null,
        livemode: typeof attrs.livemode === "boolean" ? attrs.livemode : null,
        currency: firstString(attrs.currency) || null,
        availableAmountInCentavos: toFiniteNumber(attrs.available_amount),
        pendingAmountInCentavos: toFiniteNumber(attrs.pending_amount),
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        status: string | null;
        livemode: boolean | null;
        currency: string | null;
        availableAmountInCentavos: number | null;
        pendingAmountInCentavos: number | null;
      } => !!item
    );
}

function asIsoTimestampFromUnix(value: unknown) {
  const unix = toFiniteNumber(value);
  if (!unix || unix <= 0) return null;
  return new Date(unix * 1000).toISOString();
}

export function extractWalletTransaction(payload: unknown) {
  const attrs = asRecord(readPath(payload, ["data", "attributes"])) || asRecord(readPath(payload, ["attributes"])) || {};
  const receiver = asRecord(attrs.receiver) || {};
  const sender = asRecord(attrs.sender) || {};

  return {
    walletTransactionId: firstString(readPath(payload, ["data", "id"]), readPath(payload, ["id"])),
    walletId: firstString(attrs.wallet_id),
    amountInCentavos: toFiniteNumber(attrs.amount),
    netAmountInCentavos: toFiniteNumber(attrs.net_amount),
    feeAmountInCentavos: toFiniteNumber(attrs.fee),
    currency: firstString(attrs.currency) || "PHP",
    status: normalizeWalletTransactionStatus(attrs.status),
    transferId: firstString(attrs.transfer_id),
    referenceNumber: firstString(attrs.reference_number),
    provider: firstString(attrs.provider)?.toLowerCase() || null,
    providerError: firstString(attrs.provider_error),
    providerErrorCode: firstString(attrs.provider_error_code),
    callbackUrl: firstString(attrs.callback_url),
    description: firstString(attrs.description),
    purpose: firstString(attrs.purpose),
    type: firstString(attrs.type),
    livemode: Boolean(attrs.livemode),
    metadata: asRecord(attrs.metadata) || {},
    receiver: {
      bankAccountName: firstString(receiver.bank_account_name),
      bankAccountNumber: firstString(receiver.bank_account_number),
      bankCode: firstString(receiver.bank_code),
      bankId: firstString(receiver.bank_id),
      bankName: firstString(receiver.bank_name),
    },
    sender: {
      bankAccountName: firstString(sender.bank_account_name),
      bankAccountNumber: firstString(sender.bank_account_number),
      bankCode: firstString(sender.bank_code),
      bankId: firstString(sender.bank_id),
      bankName: firstString(sender.bank_name),
    },
    createdAtIso: asIsoTimestampFromUnix(attrs.created_at),
    updatedAtIso: asIsoTimestampFromUnix(attrs.updated_at),
  };
}

export function extractQrPhDisplayData(payload: unknown, fallbackExpirySeconds: number) {
  const imageUrl = firstString(
    readPath(payload, ["data", "attributes", "next_action", "code", "image_url"]),
    readPath(payload, ["data", "attributes", "next_action", "code", "image"]),
    readPath(payload, ["data", "attributes", "next_action", "qrph_display_qr", "image_url"]),
    readPath(payload, ["data", "attributes", "next_action", "display_qr", "image_url"]),
    readPath(payload, ["data", "attributes", "next_action", "image_url"])
  );
  const expiryUnix = toFiniteNumber(
    readPath(payload, ["data", "attributes", "next_action", "code", "expires_at"]) ??
      readPath(payload, ["data", "attributes", "next_action", "expires_at"])
  );
  const expiresAtIso = expiryUnix && expiryUnix > 0
    ? new Date(expiryUnix * 1000).toISOString()
    : new Date(Date.now() + sanitizePaymongoQrExpirySeconds(fallbackExpirySeconds) * 1000).toISOString();

  return { imageUrl, expiresAtIso };
}

function decodeWebhookSecret(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  try {
    const decoded = Buffer.from(trimmed, "base64");
    const reEncoded = Buffer.from(decoded).toString("base64").replace(/=+$/g, "");
    const normalized = trimmed.replace(/=+$/g, "");
    if (decoded.length > 0 && reEncoded === normalized) {
      return decoded;
    }
  } catch {
    // Fallback to raw utf-8 secret.
  }
  return Buffer.from(trimmed, "utf8");
}

function parseSignatureHeader(header: string) {
  const result: Record<string, string> = {};
  for (const token of header.split(",")) {
    const [rawKey, ...rest] = token.trim().split("=");
    const key = rawKey?.trim().toLowerCase();
    if (!key) continue;
    const value = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
    if (!value) continue;
    result[key] = value;
  }
  return result;
}

export function verifyPaymongoWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string;
  toleranceSeconds?: number;
}) {
  const toleranceSeconds = args.toleranceSeconds ?? 300;
  const parsed = parseSignatureHeader(args.signatureHeader);
  const t = parsed.t;
  const signedTimestamp = t || "";
  let timestamp = t ? Number(t) : NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, reason: "Invalid signature timestamp." };
  }
  if (timestamp > 1_000_000_000_000) {
    timestamp = Math.floor(timestamp / 1000);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { ok: false, reason: "Webhook timestamp is outside tolerance." };
  }

  const secretRaw = requireEnvSecret("PAYMONGO_WEBHOOK_SECRET");
  const secret = decodeWebhookSecret(secretRaw);
  if (!secret) {
    return { ok: false, reason: "Invalid webhook secret encoding." };
  }

  const message = `${signedTimestamp}.${args.rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const candidates = [parsed.v1, parsed.li, parsed.te].filter((value): value is string => typeof value === "string" && !!value);
  const matched = candidates.some((candidate) => timingSafeCompare(candidate, expected));

  return matched ? { ok: true } : { ok: false, reason: "Webhook signature mismatch." };
}

export function parsePaymongoWebhookEvent(payload: unknown) {
  const eventId = firstString(readPath(payload, ["data", "id"])) || "";
  const type = firstString(readPath(payload, ["data", "attributes", "type"])) || "";
  const payment = asRecord(readPath(payload, ["data", "attributes", "data"])) || {};
  const paymentId = firstString(payment.id) || "";
  const paymentAttrs = asRecord(payment.attributes) || {};
  const paymentIntentId = firstString(paymentAttrs.payment_intent_id) || "";
  const amountInCentavos = toFiniteNumber(paymentAttrs.amount) ?? 0;
  const status = firstString(paymentAttrs.status) || "";
  const paidAtUnix = toFiniteNumber(paymentAttrs.paid_at);
  const paidAtIso = paidAtUnix && paidAtUnix > 0 ? new Date(paidAtUnix * 1000).toISOString() : null;

  return {
    eventId,
    type,
    paymentId,
    paymentIntentId,
    amountInCentavos,
    status,
    paidAtIso,
    failureCode: firstString(paymentAttrs.failure_code),
    failureMessage: firstString(paymentAttrs.failure_message),
  };
}
