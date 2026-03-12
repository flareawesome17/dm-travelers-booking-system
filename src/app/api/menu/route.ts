import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("menu_items").select("*").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("menu_items").insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
