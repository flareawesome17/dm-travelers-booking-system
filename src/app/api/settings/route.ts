import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const settings: Record<string, string> = {};
    for (const row of data ?? []) { if (row.key) settings[row.key] = row.value ?? ""; }
    return NextResponse.json(settings);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // body should be an object of key-value pairs
    const updates = Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    const { error } = await supabase
      .from("settings")
      .upsert(updates, { onConflict: "key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
