import { getSupabaseAdmin } from "@/lib/supabase";

export function manilaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
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
    const candidate = addDays(fromDate, i);
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

