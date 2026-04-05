import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createMenuItemSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data: menuData, error } = await supabase.from("restaurant_menu").select("*").order("name");
    if (error) return dbError(error, "Failed to load menu");

    const { data: ingredientsData } = await supabase
      .from("menu_item_ingredients")
      .select("menu_item_id, quantity_required, inventory_items(id, name, current_stock, unit, recipe_unit, yield_per_unit)");

    const formattedData = (menuData ?? []).map((m) => {
       const mIngs = (ingredientsData ?? []).filter((i: any) => i.menu_item_id === m.id);
       let deficientIngredients: string[] = [];

       for (const ing of mIngs) {
          const invItem = ing.inventory_items as any;
          if (!invItem) continue;
          
          const rawUsage = Number(ing.quantity_required);
          const yieldAmt = Number(invItem.yield_per_unit) || 1;
          const reqQty = rawUsage / yieldAmt;
          
          if (Number(invItem.current_stock) < reqQty) {
              deficientIngredients.push(invItem.name);
          }
       }
       
       return {
          ...m,
          dynamic_available: deficientIngredients.length === 0,
          deficient_ingredients: deficientIngredients.join(", ")
       };
    });

    return NextResponse.json(formattedData);
  } catch { return internalError(); }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createMenuItemSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_menu").insert(parsed.data).select().single();
    if (error) return dbError(error, "Failed to create menu item");
    return NextResponse.json(data, { status: 201 });
  } catch { return internalError(); }
}
