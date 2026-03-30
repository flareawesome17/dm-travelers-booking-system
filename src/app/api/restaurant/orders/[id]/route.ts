import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { addShiftTransaction } from "@/lib/shiftUtils";
import { apiError, dbError, internalError } from "@/lib/api-security";
import { toMoneyNumber } from "@/lib/bookingTotals";

function manilaDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function ensureLedgerOpen(supabase: ReturnType<typeof getSupabaseAdmin>, orderDate: string | null) {
  if (!orderDate) return null;

  const { data: ledger, error } = await supabase
    .from("daily_ledgers")
    .select("status")
    .eq("date", orderDate)
    .maybeSingle();

  if (error) return dbError(error, "Failed to verify ledger status");
  if (ledger?.status === "closed") {
    return apiError("ledger_closed", "This day is closed. Record adjustments on the next open day.", 400);
  }

  return null;
}

async function getRecordedRestaurantShiftNet(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("shift_transactions")
    .select("type, amount")
    .eq("source", "restaurant")
    .eq("reference_id", orderId);

  if (error) {
    console.error("[SHIFT_TRANSACTION_LOOKUP_ERROR]", error);
    return 0;
  }

  return (data ?? []).reduce((sum, tx: { type?: string | null; amount?: number | string | null }) => {
    const amount = toMoneyNumber(tx.amount);
    return sum + (tx.type === "EXPENSE" ? -amount : amount);
  }, 0);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "restaurant.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("restaurant_orders")
      .select("*, items:restaurant_order_items(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return apiError("not_found", "Order not found", 404);
      }
      return dbError(error, "Failed to load order");
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[RESTAURANT_ORDER_GET_ERROR]", error);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "restaurant.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("restaurant_orders")
      .select("id, status, total_amount, customer_name, payment_method, created_at, accounting_date")
      .eq("id", id)
      .single();

    if (existingOrderError || !existingOrder) {
      if ((existingOrderError as { code?: string } | null)?.code === "PGRST116") {
        return apiError("not_found", "Order not found", 404);
      }
      return dbError(existingOrderError, "Failed to load order");
    }

    const orderDate =
      existingOrder.accounting_date ||
      (existingOrder.created_at ? manilaDateString(new Date(existingOrder.created_at)) : null);

    const ledgerError = await ensureLedgerOpen(supabase, orderDate);
    if (ledgerError) return ledgerError;

    const { data, error } = await supabase
      .from("restaurant_orders")
      .update(body)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return dbError(error, "Failed to update order");

    const previousStatus = existingOrder.status;
    const nextStatus = data.status;
    const currentShiftNet = await getRecordedRestaurantShiftNet(supabase, id);

    if (previousStatus !== "Paid" && nextStatus === "Paid" && currentShiftNet <= 0) {
      await addShiftTransaction({
        source: "restaurant",
        referenceId: id,
        description: `Restaurant order - ${data.customer_name || "Walk-in"} (${data.payment_method || "Cash"})`,
        amount: toMoneyNumber(data.total_amount),
        type: "INCOME",
        category: "Restaurant",
      });
    }

    if (previousStatus === "Paid" && nextStatus !== "Paid" && currentShiftNet > 0) {
      await addShiftTransaction({
        source: "restaurant",
        referenceId: id,
        description: `Reversed restaurant order - ${data.customer_name || "Walk-in"}`,
        amount: currentShiftNet,
        type: "EXPENSE",
        category: "Restaurant",
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[RESTAURANT_ORDER_PATCH_ERROR]", error);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "restaurant.delete");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const performedBy = typeof auth.payload.sub === "string" ? auth.payload.sub : null;

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("restaurant_orders")
      .select("id, booking_id, status, total_amount, customer_name, payment_method, created_at, accounting_date")
      .eq("id", id)
      .single();

    if (existingOrderError || !existingOrder) {
      if ((existingOrderError as { code?: string } | null)?.code === "PGRST116") {
        return apiError("not_found", "Order not found", 404);
      }
      return dbError(existingOrderError, "Failed to load order");
    }

    const orderDate =
      existingOrder.accounting_date ||
      (existingOrder.created_at ? manilaDateString(new Date(existingOrder.created_at)) : null);

    const ledgerError = await ensureLedgerOpen(supabase, orderDate);
    if (ledgerError) return ledgerError;

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("restaurant_order_items")
      .select("menu_item_id, quantity, name")
      .eq("order_id", id);

    if (orderItemsError) return dbError(orderItemsError, "Failed to load order items");

    const itemMenuIds = Array.from(
      new Set((orderItems ?? []).map((item) => item.menu_item_id).filter((value): value is string => Boolean(value))),
    );

    if (itemMenuIds.length > 0) {
      const { data: ingredients, error: ingredientsError } = await supabase
        .from("menu_item_ingredients")
        .select("menu_item_id, inventory_item_id, quantity_required")
        .in("menu_item_id", itemMenuIds);

      if (ingredientsError) return dbError(ingredientsError, "Failed to load recipe ingredients");

      const restoredQuantities = new Map<string, number>();
      for (const item of orderItems ?? []) {
        const itemQuantity = toMoneyNumber(item.quantity);
        for (const ingredient of (ingredients ?? []).filter((entry) => entry.menu_item_id === item.menu_item_id)) {
          const inventoryItemId = ingredient.inventory_item_id;
          if (!inventoryItemId) continue;
          const restoreAmount = toMoneyNumber(ingredient.quantity_required) * itemQuantity;
          restoredQuantities.set(
            inventoryItemId,
            toMoneyNumber(restoredQuantities.get(inventoryItemId)) + restoreAmount,
          );
        }
      }

      const inventoryIds = Array.from(restoredQuantities.keys());
      if (inventoryIds.length > 0) {
        const { data: inventoryItems, error: inventoryItemsError } = await supabase
          .from("inventory_items")
          .select("id, current_stock")
          .in("id", inventoryIds);

        if (inventoryItemsError) return dbError(inventoryItemsError, "Failed to load inventory items");

        for (const inventoryItem of inventoryItems ?? []) {
          const restoreAmount = restoredQuantities.get(inventoryItem.id);
          if (!restoreAmount) continue;

          const previousStock = toMoneyNumber(inventoryItem.current_stock);
          const newStock = previousStock + restoreAmount;

          const { error: updateInventoryError } = await supabase
            .from("inventory_items")
            .update({
              current_stock: newStock,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inventoryItem.id);

          if (updateInventoryError) return dbError(updateInventoryError, "Failed to restore inventory stock");

          const { error: movementError } = await supabase
            .from("inventory_movements")
            .insert({
              item_id: inventoryItem.id,
              type: "IN",
              quantity: restoreAmount,
              previous_stock: previousStock,
              new_stock: newStock,
              source: "order",
              reference_id: id,
              notes: "Restored from cancelled order.",
              performed_by: performedBy,
            });

          if (movementError) return dbError(movementError, "Failed to log inventory restoration");
        }
      }
    }

    if (existingOrder.booking_id && existingOrder.status === "Charged to Room") {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("restaurant_charges_total, balance_due")
        .eq("id", existingOrder.booking_id)
        .single();

      if (bookingError) return dbError(bookingError, "Failed to load booking charges");

      const orderTotal = toMoneyNumber(existingOrder.total_amount);
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({
          restaurant_charges_total: Math.max(0, toMoneyNumber(booking.restaurant_charges_total) - orderTotal),
          balance_due: Math.max(0, toMoneyNumber(booking.balance_due) - orderTotal),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOrder.booking_id);

      if (bookingUpdateError) return dbError(bookingUpdateError, "Failed to restore booking charges");
    }

    const currentShiftNet = await getRecordedRestaurantShiftNet(supabase, id);
    if (currentShiftNet > 0) {
      await addShiftTransaction({
        source: "restaurant",
        referenceId: id,
        description: `Reversed cancelled order - ${existingOrder.customer_name || "Walk-in"}`,
        amount: currentShiftNet,
        type: "EXPENSE",
        category: "Restaurant",
      });
    }

    const { error: deleteItemsError } = await supabase
      .from("restaurant_order_items")
      .delete()
      .eq("order_id", id);

    if (deleteItemsError) return dbError(deleteItemsError, "Failed to delete order items");

    const { error: deleteOrderError } = await supabase
      .from("restaurant_orders")
      .delete()
      .eq("id", id);

    if (deleteOrderError) return dbError(deleteOrderError, "Failed to delete order");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RESTAURANT_ORDER_DELETE_ERROR]", error);
    return internalError();
  }
}
