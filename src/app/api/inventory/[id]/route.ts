import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, "inventory.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: item, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Also fetch recent movements
    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch recipe links (which menu items use this ingredient)
    const { data: recipes } = await supabase
      .from("menu_item_ingredients")
      .select("*, restaurant_menu(id, name, category, price)")
      .eq("inventory_item_id", id);

    return NextResponse.json({
      item,
      movements: movements ?? [],
      recipes: recipes ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.min_stock_alert !== undefined) updates.min_stock_alert = Number(body.min_stock_alert);
    if (body.cost_per_unit !== undefined) updates.cost_per_unit = Number(body.cost_per_unit);
    if (body.recipe_unit !== undefined) updates.recipe_unit = body.recipe_unit || null;
    if (body.yield_per_unit !== undefined) updates.yield_per_unit = body.yield_per_unit ? Number(body.yield_per_unit) : 1;

    const { data, error } = await supabase
      .from("inventory_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Soft delete
    const { error } = await supabase
      .from("inventory_items")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
