import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type AmountRow = { amount?: number | string | null; notes?: string | null };
type RestaurantGcashRow = { total_amount?: number | string | null };
export type GcashLedgerRow = {
  id?: string;
  direction?: "credit" | "debit" | string | null;
  entry_type?: "cash_in" | "load" | "opening_adjustment" | string | null;
  amount?: number | string | null;
  service_charge?: number | string | null;
  effective_at?: string | null;
  transaction_reference?: string | null;
  customer_name?: string | null;
  recipient_number?: string | null;
  description?: string | null;
  note?: string | null;
  performed_by_admin_id?: string | null;
  created_at?: string | null;
};

export type GcashSummary = {
  booking_gcash_total: number;
  restaurant_gcash_total: number;
  receivable_gcash_total: number;
  other_services_gcash_total: number;
  gcash_expenses_total: number;
  manual_cash_in_total: number;
  manual_load_total: number;
  service_charges_total: number;
  opening_adjustments_total: number;
  available_gcash: number;
};

export type GcashTransaction = GcashLedgerRow & {
  performed_by_name: string | null;
};

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateGcashServiceCharge(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return roundMoney(Math.ceil(amount / 1000) * 20);
}

export function buildGcashSummary(args: {
  paymentRows: AmountRow[];
  restaurantRows: RestaurantGcashRow[];
  receivableRows: AmountRow[];
  otherServiceRows?: RestaurantGcashRow[];
  expenseRows: AmountRow[];
  ledgerRows: GcashLedgerRow[];
}): GcashSummary {
  const bookingGcashTotal = roundMoney(args.paymentRows.reduce((sum, row) => sum + toMoney(row.amount), 0));
  const restaurantGcashTotal = roundMoney(args.restaurantRows.reduce((sum, row) => sum + toMoney(row.total_amount), 0));
  const receivableGcashTotal = roundMoney(
    args.receivableRows
      .filter((row) => !String(row.notes || "").startsWith("Synced from booking payment"))
      .reduce((sum, row) => sum + toMoney(row.amount), 0),
  );
  const otherServicesGcashTotal = roundMoney((args.otherServiceRows ?? []).reduce((sum, row) => sum + toMoney(row.total_amount), 0));
  const gcashExpensesTotal = roundMoney(args.expenseRows.reduce((sum, row) => sum + toMoney(row.amount), 0));

  let manualCashInTotal = 0;
  let manualLoadTotal = 0;
  let serviceChargesTotal = 0;
  let openingAdjustmentsTotal = 0;
  let ledgerNetEffect = 0;

  for (const row of args.ledgerRows) {
    const amount = toMoney(row.amount);
    const signedAmount = String(row.direction) === "credit" ? amount : -amount;
    ledgerNetEffect += signedAmount;

    if (row.entry_type === "cash_in") {
      manualCashInTotal += amount;
      serviceChargesTotal += toMoney(row.service_charge);
    } else if (row.entry_type === "load") {
      manualLoadTotal += amount;
      serviceChargesTotal += toMoney(row.service_charge);
    } else if (row.entry_type === "opening_adjustment") {
      openingAdjustmentsTotal += signedAmount;
    }
  }

  return {
    booking_gcash_total: bookingGcashTotal,
    restaurant_gcash_total: restaurantGcashTotal,
    receivable_gcash_total: receivableGcashTotal,
    other_services_gcash_total: otherServicesGcashTotal,
    gcash_expenses_total: gcashExpensesTotal,
    manual_cash_in_total: roundMoney(manualCashInTotal),
    manual_load_total: roundMoney(manualLoadTotal),
    service_charges_total: roundMoney(serviceChargesTotal),
    opening_adjustments_total: roundMoney(openingAdjustmentsTotal),
    available_gcash: roundMoney(
      bookingGcashTotal +
      restaurantGcashTotal +
      receivableGcashTotal -
      gcashExpensesTotal +
      otherServicesGcashTotal +
      ledgerNetEffect,
    ),
  };
}

export async function getGcashSummary(supabase: SupabaseAdminClient) {
  const [
    { data: paymentRows, error: paymentError },
    { data: restaurantRows, error: restaurantError },
    { data: receivableRows, error: receivableError },
    { data: otherServiceRows, error: otherServiceError },
    { data: expenseRows, error: expenseError },
    { data: ledgerRows, error: ledgerError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "Success")
      .eq("method", "GCash"),
    supabase
      .from("restaurant_orders")
      .select("total_amount")
      .eq("status", "Paid")
      .eq("payment_method", "GCash"),
    supabase
      .from("receivable_payments")
      .select("amount, notes")
      .eq("method", "GCash"),
    supabase
      .from("other_service_records")
      .select("total_amount")
      .eq("payment_method", "GCash"),
    supabase
      .from("expenses")
      .select("amount")
      .eq("payment_method", "GCash"),
    supabase
      .from("gcash_ledger_entries")
      .select("id, direction, entry_type, amount, service_charge, effective_at, transaction_reference, customer_name, recipient_number, description, note, performed_by_admin_id, created_at"),
  ]);

  if (paymentError) throw paymentError;
  if (restaurantError) throw restaurantError;
  if (receivableError) throw receivableError;
  if (otherServiceError) throw otherServiceError;
  if (expenseError) throw expenseError;
  if (ledgerError) throw ledgerError;

  return buildGcashSummary({
    paymentRows: paymentRows ?? [],
    restaurantRows: restaurantRows ?? [],
    receivableRows: receivableRows ?? [],
    otherServiceRows: otherServiceRows ?? [],
    expenseRows: expenseRows ?? [],
    ledgerRows: ledgerRows ?? [],
  });
}

export async function listGcashTransactions(
  supabase: SupabaseAdminClient,
  options?: { limit?: number },
) {
  const { data, error } = await supabase
    .from("gcash_ledger_entries")
    .select("id, direction, entry_type, amount, service_charge, effective_at, transaction_reference, customer_name, recipient_number, description, note, performed_by_admin_id, created_at")
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 200);

  if (error) throw error;

  const rows = (data ?? []) as GcashLedgerRow[];
  const adminIds = Array.from(new Set(rows.map((row) => row.performed_by_admin_id).filter((value): value is string => Boolean(value))));

  let adminNameMap = new Map<string, string | null>();
  if (adminIds.length > 0) {
    const { data: admins, error: adminError } = await supabase
      .from("admin_users")
      .select("id, name")
      .in("id", adminIds);

    if (adminError) throw adminError;
    adminNameMap = new Map((admins ?? []).map((admin) => [admin.id, admin.name || null]));
  }

  return rows.map<GcashTransaction>((row) => ({
    ...row,
    performed_by_name: row.performed_by_admin_id ? adminNameMap.get(row.performed_by_admin_id) ?? null : null,
  }));
}
