import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { addShiftTransaction } from "@/lib/shiftUtils";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "restaurant.read");
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_orders").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "restaurant.create");
  if ("error" in auth) return auth.error;
  
  try {
    const body = await req.json();
    const { order_source, customer_name, payment_method, booking_reference, notes, items, is_lgu_order } = body;
    const supabase = getSupabaseAdmin();

    const today = manilaDateString();
    const accountingDate = await findNextOpenLedgerDate(supabase, today);

    if (!items || !items.length) {
      return NextResponse.json({ error: "Order must contain items" }, { status: 400 });
    }

    let booking_id = null;
    let room_id = null;

    if (booking_reference) {
      const { data: bookingData, error: bErr } = await supabase
        .from("bookings")
        .select("id, room_id, restaurant_charges_total, status")
        .eq("reference_number", booking_reference)
        .single();
        
      if (bErr || !bookingData) {
        return NextResponse.json({ error: "Invalid booking reference" }, { status: 400 });
      }

      if (order_source === "Room Service") {
        if (bookingData.status !== "Checked-In") {
          return NextResponse.json(
            { error: "Only checked-in bookings can be charged for room service." },
            { status: 400 }
          );
        }
        if (!bookingData.room_id) {
          return NextResponse.json({ error: "This booking has no assigned room." }, { status: 400 });
        }
      }
      booking_id = bookingData.id;
      room_id = bookingData.room_id || null;
    }

    // Prepare line items & calculate total
    const itemIds = items.map((i: any) => i.menu_item_id);
    const { data: menuData, error: mErr } = await supabase
      .from("restaurant_menu")
      .select("*")
      .in("id", itemIds);
      
    if (mErr || !menuData || menuData.length !== itemIds.length) {
       return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
    }

    let subtotal = 0;
    const lineItems = items.map((clientItem: any) => {
      const mItem = menuData.find((m) => m.id === clientItem.menu_item_id);
      let price = Number(mItem.price || 0);

      // Feature 5 - LGU Markup
      if (is_lgu_order && mItem.lgu_markup_percentage) {
        price = price + (price * (mItem.lgu_markup_percentage / 100));
      }

      const qty = Number(clientItem.quantity || 1);
      const lineTotal = price * qty;
      subtotal += lineTotal;

      return {
        menu_item_id: mItem.id,
        name: mItem.name,
        category: mItem.category,
        unit_price: price,
        quantity: qty,
        line_total: lineTotal
      };
    });

    // Determine initial status based on source and payment
    let initialStatus = "Pending";
    if (order_source === "Room Service") {
      initialStatus = "Charged to Room";
    } else if (payment_method && payment_method !== "Pending Payment") {
      initialStatus = "Paid";
    }

    // 0. Pre-validate Inventory Availability (Strict Block)
    const inventoryRequirements: Record<string, { qty: number, item: any, lines: string[] }> = {};
    
    for (const li of lineItems) {
      const { data: ingredients } = await supabase
        .from("menu_item_ingredients")
        .select("inventory_item_id, quantity_required, inventory_items(id, name, current_stock, min_stock_alert, unit, recipe_unit, yield_per_unit)")
        .eq("menu_item_id", li.menu_item_id);

      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          const invItem = ing.inventory_items as any;
          if (!invItem) continue;

          const rawRecipeUsage = Number(ing.quantity_required) * Number(li.quantity);
          const yieldAmt = Number(invItem.yield_per_unit) || 1;
          const deductQty = rawRecipeUsage / yieldAmt;

          if (!inventoryRequirements[invItem.id]) {
            inventoryRequirements[invItem.id] = { qty: 0, item: invItem, lines: [] };
          }
          inventoryRequirements[invItem.id].qty += deductQty;
          inventoryRequirements[invItem.id].lines.push(`${li.name} x${li.quantity}`);
        }
      }
    }

    const insufficientItems = [];
    for (const req of Object.values(inventoryRequirements)) {
      if (Number(req.item.current_stock) < req.qty) {
        insufficientItems.push(`${req.item.name} (has ${Number(req.item.current_stock).toFixed(2)}, needs ${req.qty.toFixed(2)} ${req.item.unit})`);
      }
    }

    if (insufficientItems.length > 0) {
      return NextResponse.json(
        { error: `Insufficient inventory: ${insufficientItems.join(" | ")}` },
        { status: 400 }
      );
    }

    // Fetch active global restaurant discounts
    const now = new Date().toISOString();
    const { data: activeDiscounts } = await supabase
      .from("discounts")
      .select("*")
      .eq("is_active", true)
      .eq("apply_to_restaurant", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .order("created_at", { ascending: false });

    const activeDiscount = activeDiscounts?.[0];
    let discountAmount = 0;
    if (activeDiscount) {
      if (activeDiscount.type === "percent") {
        discountAmount = (subtotal * Number(activeDiscount.value)) / 100;
      } else {
        discountAmount = Number(activeDiscount.value);
      }
    }

    const finalTotal = Math.max(0, subtotal - discountAmount);

    // 1. Insert order
    const { data: orderData, error: oErr } = await supabase
      .from("restaurant_orders")
      .insert({
        booking_id,
        room_id,
        order_source,
        customer_name,
        accounting_date: accountingDate,
        payment_method: order_source === "Room Service" ? "Charged to Room" : (payment_method || "Pending Payment"),
        notes,
        is_lgu_order,
        status: initialStatus,
        subtotal,
        service_charge: 0,
        total_amount: finalTotal,
        discount_id: activeDiscount?.id || null,
        discount_type: activeDiscount?.type || null,
        discount_value: activeDiscount?.value || 0,
        discount_amount: discountAmount,
      })
      .select()
      .single();

    if (oErr || !orderData) {
      return NextResponse.json({ error: oErr?.message || "Failed to create order" }, { status: 500 });
    }

    // 2. Insert line items
    const linesToInsert = lineItems.map(l => ({ ...l, order_id: orderData.id }));
    const { error: iErr } = await supabase.from("restaurant_order_items").insert(linesToInsert);
    
    if (iErr) {
       // Ideally we'd rollback here, but we'll return an error for now
       return NextResponse.json({ error: "Order created but failed to save line items" }, { status: 500 });
    }

    // 3. Update parent booking if charged to room
    if (booking_id && orderData.status === "Charged to Room") {
       const { data: existingBooking } = await supabase
         .from("bookings")
         .select("restaurant_charges_total, balance_due")
         .eq("id", booking_id)
         .single();
         
       const currentCharges = Number(existingBooking?.restaurant_charges_total || 0);
       const currentBalance = Number(existingBooking?.balance_due || 0);
        await supabase
          .from("bookings")
          .update({ 
            restaurant_charges_total: currentCharges + finalTotal,
            balance_due: currentBalance + finalTotal
          })
          .eq("id", booking_id);
    }

    // 4. Auto-deduct inventory using validated requirements
    const stockWarnings: string[] = [];
    try {
      for (const req of Object.values(inventoryRequirements)) {
        const invItem = req.item;
        const prevStock = Number(invItem.current_stock);
        const newStock = prevStock - req.qty;

        await supabase
          .from("inventory_items")
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", invItem.id);

        await supabase.from("inventory_movements").insert({
          item_id: invItem.id,
          type: "OUT",
          quantity: req.qty,
          previous_stock: prevStock,
          new_stock: newStock,
          source: "order",
          reference_id: orderData.id,
          notes: `Auto-deducted for order (${req.lines.join(", ")})`,
          performed_by: auth.payload.sub || null,
        });

        if (newStock <= Number(invItem.min_stock_alert)) {
          stockWarnings.push(
            `"${invItem.name}" is at ${newStock.toFixed(2)} ${invItem.unit || "units"} (threshold: ${invItem.min_stock_alert})`
          );
        }
      }
    } catch (invErr) {
      console.error("[Inventory Deduction] Non-blocking error:", invErr);
    }

    // 5. Record shift transaction (non-blocking)
    if (orderData.status === "Paid") {
      addShiftTransaction({
        source: "restaurant",
        referenceId: orderData.id,
        description: `Restaurant order - ${customer_name || "Walk-in"} (${payment_method || "Cash"})`,
        amount: finalTotal,
        type: "INCOME",
        category: "Restaurant",
      });
    }

    return NextResponse.json({
      ...orderData,
      stock_warnings: stockWarnings.length > 0 ? stockWarnings : undefined,
    }, { status: 201 });

  } catch (err: any) { 
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 }); 
  }
}
