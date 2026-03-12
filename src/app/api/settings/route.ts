import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("hotel_settings").select("key, value");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const settings: Record<string, string> = {};
    for (const row of data ?? []) { if (row.key) settings[row.key] = row.value ?? ""; }
    return NextResponse.json(settings);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
