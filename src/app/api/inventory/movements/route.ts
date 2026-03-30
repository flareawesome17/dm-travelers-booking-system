import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const itemId = url.searchParams.get("item_id");
    const type = url.searchParams.get("type");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

    let query = supabase
      .from("inventory_movements")
      .select("*, inventory_items(id, name, unit)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (itemId) query = query.eq("item_id", itemId);
    if (type && ["IN", "OUT", "ADJUSTMENT"].includes(type)) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
