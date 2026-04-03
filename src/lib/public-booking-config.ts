import { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PublicBookingConfig = {
  depositPercent: number;
  cancellationPolicy: string;
  currency: string;
};

const DEFAULT_DEPOSIT_PERCENT = 30;
const DEFAULT_CURRENCY = "PHP";

function sanitizePercent(raw: unknown) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_DEPOSIT_PERCENT;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 100) return 100;
  return rounded;
}

function buildDefaultCancellationPolicy(depositPercent: number) {
  return [
    `A ${depositPercent}% down payment is required to confirm every online booking.`,
    "Cancellations made by guests will cancel the reservation slot immediately.",
    `Any collected down payment is non-refundable once a booking is cancelled.`,
    "Date changes or rebooking requests remain subject to room availability and management approval.",
  ].join(" ");
}

export async function getPublicBookingConfig(supabase: SupabaseAdminClient): Promise<PublicBookingConfig> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["deposit_percent", "cancellation_policy", "currency"]);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const key = typeof row.key === "string" ? row.key : "";
    if (!key) continue;
    map.set(key, String(row.value ?? ""));
  }

  const depositPercent = sanitizePercent(map.get("deposit_percent"));
  const cancellationPolicy = String(map.get("cancellation_policy") || "").trim() || buildDefaultCancellationPolicy(depositPercent);
  const currency = String(map.get("currency") || "").trim().toUpperCase() || DEFAULT_CURRENCY;

  return {
    depositPercent,
    cancellationPolicy,
    currency,
  };
}
