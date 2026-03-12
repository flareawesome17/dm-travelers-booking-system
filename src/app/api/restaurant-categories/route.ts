import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_categories").select("*").order("sort_order");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
