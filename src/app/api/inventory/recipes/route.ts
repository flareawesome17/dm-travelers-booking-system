import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const menuItemId = url.searchParams.get("menu_item_id");

    let query = supabase
      .from("menu_item_ingredients")
      .select("*, inventory_items(id, name, unit, current_stock, min_stock_alert), restaurant_menu(id, name)");

    if (menuItemId) {
      query = query.eq("menu_item_id", menuItemId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { menu_item_id, inventory_item_id, quantity_required } = body;

    if (!menu_item_id || !inventory_item_id) {
      return NextResponse.json({ error: "menu_item_id and inventory_item_id are required" }, { status: 400 });
    }

    const qty = Number(quantity_required);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity_required must be positive" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Upsert: if mapping already exists, update quantity
    const { data: existing } = await supabase
      .from("menu_item_ingredients")
      .select("id")
      .eq("menu_item_id", menu_item_id)
      .eq("inventory_item_id", inventory_item_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("menu_item_ingredients")
        .update({ quantity_required: qty })
        .eq("id", existing.id)
        .select("*, inventory_items(id, name, unit), restaurant_menu(id, name)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("menu_item_ingredients")
      .insert({ menu_item_id, inventory_item_id, quantity_required: qty })
      .select("*, inventory_items(id, name, unit), restaurant_menu(id, name)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("menu_item_ingredients")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
