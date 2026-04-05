import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    console.log("[PUBLIC_MENU] Fetching dishes at", now);

    const { data: activeDiscounts } = await supabase
      .from("discounts")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .eq("apply_to_restaurant", true)
      .order("created_at", { ascending: false });

    const latestDiscount = activeDiscounts?.[0] || null;

    const { data: menuItems, error: mErr } = await supabase
      .from("restaurant_menu")
      .select("id, name, description, price, category, is_available, image_url")
      .eq("is_available", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (mErr) {
      console.error("[PUBLIC_MENU] Error fetching menuItems:", mErr);
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    console.log("[PUBLIC_MENU] Found items:", menuItems?.length || 0);

    const data = (menuItems ?? []).map((item: any) => {
      const p = Number(item.price);
      let discountedPrice = p;
      let discountDetails = null;

      if (latestDiscount) {
        let discountAmt = 0;
        if (latestDiscount.type === "percent") {
          discountAmt = (p * latestDiscount.value) / 100;
        } else {
          discountAmt = latestDiscount.value;
        }
        discountedPrice = Math.max(0, p - discountAmt);
        discountDetails = {
          name: latestDiscount.name,
          type: latestDiscount.type,
          value: latestDiscount.value,
          amount: discountAmt
        };
      }

      return {
        ...item,
        original_price: p,
        price: discountedPrice,
        discount: discountDetails
      };
    });

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[PUBLIC_MENU_GET_CRITICAL]", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
