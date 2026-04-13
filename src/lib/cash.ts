import crypto from "crypto";
import { requireEnvSecret } from "@/lib/api-security";
import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type CashAmountRow = { amount?: number | string | null };
type CashRestaurantRow = { total_amount?: number | string | null };
type CashLedgerRow = {
  id?: string;
  direction?: "credit" | "debit" | string | null;
  entry_type?: "bank_deposit" | "deposit_reversal" | "opening_adjustment" | string | null;
  amount?: number | string | null;
  effective_at?: string | null;
  deposit_request_id?: string | null;
  description?: string | null;
  note?: string | null;
  performed_by_admin_id?: string | null;
  created_at?: string | null;
};

type CashPendingRow = { amount?: number | string | null };

type CashDepositRequestRecord = {
  id: string;
  amount: number | string;
  deposit_reference: string;
  deposited_at: string;
  bank_account_id: string | null;
  bank_account_label: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  branch_label: string | null;
  proof_bucket: string;
  proof_path: string;
  proof_filename: string | null;
  proof_content_type: string | null;
  proof_size_bytes: number | null;
  note: string | null;
  status: string;
  approval_note: string | null;
  rejection_note: string | null;
  cancellation_note: string | null;
  reversal_reason: string | null;
  linked_reversal_entry_id: string | null;
  requested_by_admin_id: string | null;
  approved_by_admin_id: string | null;
  rejected_by_admin_id: string | null;
  cancelled_by_admin_id: string | null;
  reversed_by_admin_id: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  reversed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CashSummary = {
  cash_receipts_total: number;
  restaurant_cash_total: number;
  cash_expenses_total: number;
  approved_deposits_total: number;
  opening_adjustments_total: number;
  reversals_total: number;
  available_cash: number;
  pending_request_total: number;
  pending_request_count: number;
};

export type CashBankAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  branch_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CashDepositRequest = CashDepositRequestRecord & {
  requested_by_name: string | null;
  approved_by_name: string | null;
  rejected_by_name: string | null;
  cancelled_by_name: string | null;
  reversed_by_name: string | null;
};

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function getCashEncryptionKey() {
  const directSecret = process.env.CASH_ACCOUNT_SECRET?.trim();
  const fallbackSecret = process.env.TREASURY_DESTINATION_SECRET?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const secret = directSecret || fallbackSecret || jwtSecret || requireEnvSecret("JWT_SECRET");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptCashAccountNumber(value: string) {
  const normalized = value.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCashEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptCashAccountNumber(payload: string) {
  const [ivB64, tagB64, dataB64] = String(payload || "").split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid cash account payload.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getCashEncryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskCashAccountNumber(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  if (!trimmed) return "";
  if (trimmed.length <= 4) return trimmed;
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

type CashProofFile = {
  data?: string;
  name?: string;
  type?: string;
};

const CASH_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf"]);
const CASH_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const CASH_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function verifyCashProofMagicBytes(buffer: Buffer, ext: string) {
  if (buffer.length < 4) return false;

  switch (ext) {
    case "jpg":
    case "jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case "gif":
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    case "webp":
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    case "pdf":
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    default:
      return false;
  }
}

export function validateCashProofUpload(file: CashProofFile) {
  if (!file?.data || !file?.name) {
    return { valid: false as const, error: "Proof file data and name are required." };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!CASH_ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false as const, error: "Only JPG, PNG, WEBP, GIF, or PDF proof files are allowed." };
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !CASH_ALLOWED_MIMES.has(mime)) {
    return { valid: false as const, error: "Proof file type is not allowed." };
  }

  const base64Data = file.data.includes(",") ? file.data.split(",")[1] : file.data;
  if (!base64Data) {
    return { valid: false as const, error: "Invalid proof file payload." };
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > CASH_MAX_FILE_SIZE_BYTES) {
    return { valid: false as const, error: "Proof file exceeds the 8MB limit." };
  }

  if (!verifyCashProofMagicBytes(buffer, ext)) {
    return { valid: false as const, error: "Proof file content does not match its extension." };
  }

  return { valid: true as const, buffer, ext };
}

export function buildCashSummary(args: {
  paymentRows: CashAmountRow[];
  restaurantRows: CashRestaurantRow[];
  expenseRows: CashAmountRow[];
  ledgerRows: CashLedgerRow[];
  pendingRows: CashPendingRow[];
}): CashSummary {
  const cashReceiptsTotal = roundMoney(args.paymentRows.reduce((sum, row) => sum + toMoney(row.amount), 0));
  const restaurantCashTotal = roundMoney(args.restaurantRows.reduce((sum, row) => sum + toMoney(row.total_amount), 0));
  const cashExpensesTotal = roundMoney(args.expenseRows.reduce((sum, row) => sum + toMoney(row.amount), 0));

  let approvedDepositsTotal = 0;
  let openingAdjustmentsTotal = 0;
  let reversalsTotal = 0;
  let ledgerNetEffect = 0;

  for (const row of args.ledgerRows) {
    const amount = toMoney(row.amount);
    const signedAmount = String(row.direction) === "credit" ? amount : -amount;
    ledgerNetEffect += signedAmount;

    if (row.entry_type === "bank_deposit") {
      approvedDepositsTotal += amount;
    } else if (row.entry_type === "opening_adjustment") {
      openingAdjustmentsTotal += signedAmount;
    } else if (row.entry_type === "deposit_reversal") {
      reversalsTotal += amount;
    }
  }

  const pendingRequestTotal = roundMoney(args.pendingRows.reduce((sum, row) => sum + toMoney(row.amount), 0));
  const availableCash = roundMoney(
    cashReceiptsTotal +
    restaurantCashTotal -
    cashExpensesTotal +
    ledgerNetEffect,
  );

  return {
    cash_receipts_total: cashReceiptsTotal,
    restaurant_cash_total: restaurantCashTotal,
    cash_expenses_total: cashExpensesTotal,
    approved_deposits_total: roundMoney(approvedDepositsTotal),
    opening_adjustments_total: roundMoney(openingAdjustmentsTotal),
    reversals_total: roundMoney(reversalsTotal),
    available_cash: availableCash,
    pending_request_total: pendingRequestTotal,
    pending_request_count: args.pendingRows.length,
  };
}

export async function getCashSummary(supabase: SupabaseAdminClient) {
  const [
    { data: paymentRows, error: paymentError },
    { data: restaurantRows, error: restaurantError },
    { data: expenseRows, error: expenseError },
    { data: ledgerRows, error: ledgerError },
    { data: pendingRows, error: pendingError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "Success")
      .eq("method", "Cash"),
    supabase
      .from("restaurant_orders")
      .select("total_amount")
      .eq("status", "Paid")
      .eq("payment_method", "Cash"),
    supabase
      .from("expenses")
      .select("amount")
      .eq("payment_method", "Cash"),
    supabase
      .from("cash_ledger_entries")
      .select("id, direction, entry_type, amount, effective_at, deposit_request_id, description, note, performed_by_admin_id, created_at"),
    supabase
      .from("cash_deposit_requests")
      .select("amount")
      .eq("status", "pending_review"),
  ]);

  if (paymentError) throw paymentError;
  if (restaurantError) throw restaurantError;
  if (expenseError) throw expenseError;
  if (ledgerError) throw ledgerError;
  if (pendingError) throw pendingError;

  return buildCashSummary({
    paymentRows: paymentRows ?? [],
    restaurantRows: restaurantRows ?? [],
    expenseRows: expenseRows ?? [],
    ledgerRows: ledgerRows ?? [],
    pendingRows: pendingRows ?? [],
  });
}

export async function listCashBankAccounts(
  supabase: SupabaseAdminClient,
  options?: { activeOnly?: boolean },
) {
  let query = supabase
    .from("cash_bank_accounts")
    .select("id, label, bank_name, account_name, account_number_masked, branch_label, is_active, created_at, updated_at")
    .order("label", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CashBankAccount[];
}

export async function listCashDepositRequests(
  supabase: SupabaseAdminClient,
  options?: { status?: string | null; limit?: number },
) {
  let query = supabase
    .from("cash_deposit_requests")
    .select("*")
    .order("deposited_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as CashDepositRequestRecord[];
  const adminIds = Array.from(new Set(rows.flatMap((row) => [
    row.requested_by_admin_id,
    row.approved_by_admin_id,
    row.rejected_by_admin_id,
    row.cancelled_by_admin_id,
    row.reversed_by_admin_id,
  ].filter((value): value is string => Boolean(value)))));

  let adminNameMap = new Map<string, string | null>();
  if (adminIds.length > 0) {
    const { data: admins, error: adminError } = await supabase
      .from("admin_users")
      .select("id, name")
      .in("id", adminIds);

    if (adminError) throw adminError;
    adminNameMap = new Map((admins ?? []).map((admin) => [admin.id, admin.name || null]));
  }

  return rows.map<CashDepositRequest>((row) => ({
    ...row,
    requested_by_name: row.requested_by_admin_id ? adminNameMap.get(row.requested_by_admin_id) ?? null : null,
    approved_by_name: row.approved_by_admin_id ? adminNameMap.get(row.approved_by_admin_id) ?? null : null,
    rejected_by_name: row.rejected_by_admin_id ? adminNameMap.get(row.rejected_by_admin_id) ?? null : null,
    cancelled_by_name: row.cancelled_by_admin_id ? adminNameMap.get(row.cancelled_by_admin_id) ?? null : null,
    reversed_by_name: row.reversed_by_admin_id ? adminNameMap.get(row.reversed_by_admin_id) ?? null : null,
  }));
}

export async function createCashProofSignedUrl(
  supabase: SupabaseAdminClient,
  bucket: string,
  path: string,
  expiresInSeconds = 120,
) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds, {
    download: true,
  });

  if (error) throw error;
  return data.signedUrl;
}
