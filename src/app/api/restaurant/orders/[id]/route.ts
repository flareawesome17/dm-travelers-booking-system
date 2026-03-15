import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

function manilaDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("restaurant_orders")
      .select("*, items:restaurant_order_items(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data: existingOrder, error: oErr } = await supabase
      .from("restaurant_orders")
      .select("id, created_at, accounting_date")
      .eq("id", id)
      .single();
    if (oErr || !existingOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const orderDate =
      existingOrder.accounting_date ||
      (existingOrder.created_at ? manilaDateString(new Date(existingOrder.created_at)) : null);
    if (orderDate) {
      const { data: ledger, error: lErr } = await supabase
        .from("daily_ledgers")
        .select("status")
        .eq("date", orderDate)
        .maybeSingle();
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
      if (ledger?.status === "closed") {
        return NextResponse.json({ error: "This day is closed. Record adjustments on the next open day." }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("restaurant_orders")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: existingOrder, error: oErr } = await supabase
      .from("restaurant_orders")
      .select("id, created_at, accounting_date")
      .eq("id", id)
      .single();
    if (oErr || !existingOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const orderDate =
      existingOrder.accounting_date ||
      (existingOrder.created_at ? manilaDateString(new Date(existingOrder.created_at)) : null);
    if (orderDate) {
      const { data: ledger, error: lErr } = await supabase
        .from("daily_ledgers")
        .select("status")
        .eq("date", orderDate)
        .maybeSingle();
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
      if (ledger?.status === "closed") {
        return NextResponse.json({ error: "This day is closed. Record adjustments on the next open day." }, { status: 400 });
      }
    }
    
    // Delete line items first due to foreign key constraints if any
    await supabase.from("restaurant_order_items").delete().eq("order_id", id);
    
    const { error } = await supabase.from("restaurant_orders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
