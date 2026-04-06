import { getSupabaseAdmin } from "./supabase";

export type TimeConfig = {
  timezone: string;
  offset: string;
};

let cachedTimeConfig: TimeConfig | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 1000 * 60 * 5; // 5 minutes

export async function getGlobalTimeConfig(supabaseClient?: ReturnType<typeof getSupabaseAdmin>): Promise<TimeConfig> {
  const now = Date.now();
  if (cachedTimeConfig && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return cachedTimeConfig;
  }

  try {
    const supabase = supabaseClient || getSupabaseAdmin();
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["timezone", "timezone_offset"]);

    let timezone = "Asia/Manila";
    let offset = "+08:00";

    if (data && data.length > 0) {
      const tzRow = data.find((r) => r.key === "timezone");
      const offsetRow = data.find((r) => r.key === "timezone_offset");
      
      if (tzRow?.value) timezone = tzRow.value;
      if (offsetRow?.value) offset = offsetRow.value;
    }

    cachedTimeConfig = { timezone, offset };
    lastFetchTime = now;
    return cachedTimeConfig;
  } catch (error) {
    console.error("[SETTINGS_GET_ERROR] Failed to fetch time config:", error);
    // Fallback to defaults
    return { timezone: "Asia/Manila", offset: "+08:00" };
  }
}

export function clearSettingsCache() {
  cachedTimeConfig = null;
  lastFetchTime = 0;
}
