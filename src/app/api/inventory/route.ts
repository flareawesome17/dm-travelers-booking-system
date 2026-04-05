import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const lowStock = url.searchParams.get("low_stock");
    const search = url.searchParams.get("search");

    let query = supabase
      .from("inventory_items")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let items = data ?? [];

    // Filter low stock client-side since we need to compare two columns
    if (lowStock === "true") {
      items = items.filter((i: any) => Number(i.current_stock) <= Number(i.min_stock_alert));
    }

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { name, category, unit, current_stock, min_stock_alert, cost_per_unit, recipe_unit, yield_per_unit } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name: name.trim(),
        category: category || "ingredient",
        unit: unit || "pcs",
        current_stock: Number(current_stock) || 0,
        min_stock_alert: Number(min_stock_alert) || 5,
        cost_per_unit: Number(cost_per_unit) || 0,
        recipe_unit: recipe_unit || null,
        yield_per_unit: yield_per_unit ? Number(yield_per_unit) : 1,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If initial stock > 0, create an IN movement
    if (Number(current_stock) > 0 && data) {
      await supabase.from("inventory_movements").insert({
        item_id: data.id,
        type: "IN",
        quantity: Number(current_stock),
        previous_stock: 0,
        new_stock: Number(current_stock),
        source: "manual",
        notes: "Initial stock on creation",
        performed_by: auth.payload.sub || null,
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
