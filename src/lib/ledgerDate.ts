import { getSupabaseAdmin } from "@/lib/supabase";
import { getGlobalTimeConfig } from "./settings";

export async function manilaDateString(d: Date = new Date(), supabaseClient?: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { timezone } = await getGlobalTimeConfig(supabaseClient);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function addDays(date: string, days: number, supabaseClient?: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { offset, timezone } = await getGlobalTimeConfig(supabaseClient);
  const tzOffset = offset || "+08:00";
  const tzName = timezone || "Asia/Manila";
  const d = new Date(`${date}T00:00:00${tzOffset}`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tzName,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function findNextOpenLedgerDate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  fromDate: string,
  maxLookaheadDays = 31
): Promise<string> {
  for (let i = 0; i <= maxLookaheadDays; i++) {
    const candidate = await addDays(fromDate, i, supabase);
    const { data, error } = await supabase
      .from("daily_ledgers")
      .select("status")
      .eq("date", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    if (data.status !== "closed") return candidate;
  }
  return fromDate;
}

