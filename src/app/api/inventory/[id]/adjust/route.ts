import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { broadcastSystemMessage } from "@/lib/activity-hub";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, "inventory.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { type, quantity, source, notes } = body;

    if (!type || !["IN", "OUT", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get current stock
    const { data: item, error: iErr } = await supabase
      .from("inventory_items")
      .select("id, name, current_stock, min_stock_alert, unit")
      .eq("id", id)
      .single();

    if (iErr || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const previousStock = Number(item.current_stock);
    let newStock: number;

    if (type === "IN") {
      newStock = previousStock + qty;
    } else if (type === "OUT") {
      newStock = previousStock - qty; // Can go negative (per spec)
    } else {
      // ADJUSTMENT: set to exact value
      newStock = qty;
    }

    // Update stock
    const { error: uErr } = await supabase
      .from("inventory_items")
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    // Record movement
    const { data: movement, error: mErr } = await supabase
      .from("inventory_movements")
      .insert({
        item_id: id,
        type,
        quantity: type === "ADJUSTMENT" ? Math.abs(newStock - previousStock) : qty,
        previous_stock: previousStock,
        new_stock: newStock,
        source: source || "manual",
        notes: notes || null,
        performed_by: auth.payload.sub || null,
      })
      .select()
      .single();

    if (mErr) {
      console.error("[Inventory] Movement insert failed:", mErr);
    }

    // Write audit log
    await supabase.from("audit_log").insert({
      entity_type: "inventory_item",
      entity_id: id,
      action: `stock_${type.toLowerCase()}`,
      changes: {
        type,
        quantity: qty,
        previous_stock: previousStock,
        new_stock: newStock,
        source: source || "manual",
        notes: notes || null,
      },
      performed_by_admin_id: auth.payload.sub || null,
    });

    // Build response with low stock warning
    const lowStockWarning = newStock <= Number(item.min_stock_alert);

    // Broadcast low stock alert to Activity Hub (fire-and-forget)
    if (lowStockWarning) {
      broadcastSystemMessage({
        content: `⚠️ Low stock: "${item.name}" is at ${newStock} ${item.unit || "units"} (min: ${item.min_stock_alert}).`,
        category: "inventory",
        metadata: { item_id: id, current_stock: newStock, min_stock_alert: item.min_stock_alert },
      }, supabase).catch(() => {});
    }

    return NextResponse.json({
      item: { ...item, current_stock: newStock },
      movement,
      warning: lowStockWarning
        ? `⚠️ Low stock alert: "${item.name}" is at ${newStock} ${item.unit || "units"} (threshold: ${item.min_stock_alert})`
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
