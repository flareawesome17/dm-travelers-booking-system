import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type OtherServiceType = {
  id: string;
  code: string;
  name: string;
  rate_amount: number | string;
  unit_label: string;
  unit_description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type OtherServiceRecord = {
  id: string;
  service_type_id: string | null;
  service_code: string;
  service_name: string;
  unit_label: string;
  unit_rate: number | string;
  quantity: number | string;
  total_amount: number | string;
  payment_method: string;
  payment_reference: string | null;
  customer_name: string | null;
  room_number: string | null;
  note: string | null;
  accounting_date: string;
  recorded_by_admin_id: string | null;
  created_at: string;
  recorded_by_name?: string | null;
};

export type OtherServicesSummary = {
  total_revenue: number;
  transaction_count: number;
  by_service: Record<string, number>;
  by_method: Record<string, number>;
};

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateOtherServiceTotal(rate: number, quantity: number) {
  if (!Number.isFinite(rate) || !Number.isFinite(quantity) || rate < 0 || quantity <= 0) return 0;
  return roundMoney(rate * quantity);
}

export function buildOtherServicesSummary(records: OtherServiceRecord[]): OtherServicesSummary {
  const byService: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  let totalRevenue = 0;

  for (const record of records) {
    const amount = toMoney(record.total_amount);
    totalRevenue += amount;
    const serviceKey = record.service_name || record.service_code || "Other";
    const methodKey = record.payment_method || "Unknown";
    byService[serviceKey] = roundMoney((byService[serviceKey] || 0) + amount);
    byMethod[methodKey] = roundMoney((byMethod[methodKey] || 0) + amount);
  }

  return {
    total_revenue: roundMoney(totalRevenue),
    transaction_count: records.length,
    by_service: byService,
    by_method: byMethod,
  };
}

export async function listOtherServiceTypes(supabase: SupabaseAdminClient, options?: { activeOnly?: boolean }) {
  let query = supabase
    .from("other_service_types")
    .select("id, code, name, rate_amount, unit_label, unit_description, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OtherServiceType[];
}

export async function listOtherServiceRecords(supabase: SupabaseAdminClient, options?: { limit?: number }) {
  const { data, error } = await supabase
    .from("other_service_records")
    .select("id, service_type_id, service_code, service_name, unit_label, unit_rate, quantity, total_amount, payment_method, payment_reference, customer_name, room_number, note, accounting_date, recorded_by_admin_id, created_at")
    .order("accounting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 200);

  if (error) throw error;

  const rows = (data ?? []) as OtherServiceRecord[];
  const adminIds = Array.from(new Set(rows.map((row) => row.recorded_by_admin_id).filter((value): value is string => Boolean(value))));

  let adminNameMap = new Map<string, string | null>();
  if (adminIds.length > 0) {
    const { data: admins, error: adminError } = await supabase
      .from("admin_users")
      .select("id, name")
      .in("id", adminIds);

    if (adminError) throw adminError;
    adminNameMap = new Map((admins ?? []).map((admin) => [admin.id, admin.name || null]));
  }

  return rows.map((row) => ({
    ...row,
    recorded_by_name: row.recorded_by_admin_id ? adminNameMap.get(row.recorded_by_admin_id) ?? null : null,
  }));
}
