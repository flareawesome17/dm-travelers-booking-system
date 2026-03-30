import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, apiError, dbError } from "@/lib/api-security";
import { updateSettingsSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "settings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error) return dbError(error, "Failed to load settings");
    const settings: Record<string, string> = {};
    for (const row of data ?? []) { if (row.key) settings[row.key] = row.value ?? ""; }
    return NextResponse.json(settings);
  } catch { return dbError(null, "Failed to load settings"); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "settings.write");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateSettingsSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const updates = Object.entries(parsed.data).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    const { error } = await supabase
      .from("settings")
      .upsert(updates, { onConflict: "key" });

    if (error) return dbError(error, "Failed to update settings");
    return NextResponse.json({ success: true });
  } catch {
    return dbError(null, "Failed to update settings");
  }
}
