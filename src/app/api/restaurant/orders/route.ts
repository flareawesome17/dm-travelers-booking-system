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
        total_amount: subtotal
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
           restaurant_charges_total: currentCharges + subtotal,
           balance_due: currentBalance + subtotal
         })
         .eq("id", booking_id);
    }

    // 4. Auto-deduct inventory based on recipes (non-blocking)
    const stockWarnings: string[] = [];
    try {
      for (const li of lineItems) {
        const { data: ingredients } = await supabase
          .from("menu_item_ingredients")
          .select("inventory_item_id, quantity_required, inventory_items(id, name, current_stock, min_stock_alert, unit)")
          .eq("menu_item_id", li.menu_item_id);

        if (ingredients && ingredients.length > 0) {
          for (const ing of ingredients) {
            const deductQty = Number(ing.quantity_required) * Number(li.quantity);
            const invItem = ing.inventory_items as any;
            if (!invItem) continue;

            const prevStock = Number(invItem.current_stock);
            const newStock = prevStock - deductQty;

            await supabase
              .from("inventory_items")
              .update({ current_stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", ing.inventory_item_id);

            await supabase.from("inventory_movements").insert({
              item_id: ing.inventory_item_id,
              type: "OUT",
              quantity: deductQty,
              previous_stock: prevStock,
              new_stock: newStock,
              source: "order",
              reference_id: orderData.id,
              notes: `Auto-deducted for order (${li.name} x${li.quantity})`,
              performed_by: auth.payload.sub || null,
            });

            if (newStock <= Number(invItem.min_stock_alert)) {
              stockWarnings.push(
                `"${invItem.name}" is at ${newStock} ${invItem.unit || "units"} (threshold: ${invItem.min_stock_alert})`
              );
            }
          }
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
        amount: subtotal,
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
