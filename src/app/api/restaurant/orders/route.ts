import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_orders").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  
  try {
    const body = await req.json();
    const { order_source, booking_reference, notes, items } = body;
    const supabase = getSupabaseAdmin();

    if (!items || !items.length) {
      return NextResponse.json({ error: "Order must contain items" }, { status: 400 });
    }

    let booking_id = null;
    let room_id = null;

    if (booking_reference) {
      const { data: bookingData, error: bErr } = await supabase
        .from("bookings")
        .select("id, room_id, restaurant_charges_total")
        .eq("reference_number", booking_reference)
        .single();
        
      if (bErr || !bookingData) {
        return NextResponse.json({ error: "Invalid booking reference" }, { status: 400 });
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
      const price = Number(mItem.price || 0);
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

    // Determine initial status based on source
    const initialStatus = order_source === "Room Service" ? "Charged to Room" : "Pending";

    // 1. Insert order
    const { data: orderData, error: oErr } = await supabase
      .from("restaurant_orders")
      .insert({
        booking_id,
        room_id,
        order_source,
        notes,
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

    return NextResponse.json(orderData, { status: 201 });

  } catch (err: any) { 
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 }); 
  }
}
