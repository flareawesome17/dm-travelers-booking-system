import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("*, guests(*), rooms(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET Bookings Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET Bookings Catch Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    // Create guest first if guest info is provided
    let guestId = body.guest_id;
    if (!guestId && body.guest) {
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert(body.guest)
        .select()
        .single();
      if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 });
      guestId = guest.id;
    }

    const bookingData = { 
      ...body, 
      guest_id: guestId,
      reference_number: body.reference_number || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      total_amount: body.total_amount || 0,
      balance_due: body.balance_due ?? Math.max(0, (body.total_amount || 0) - (body.deposit_paid || 0)),
      room_type_requested: body.room_type_requested || "Standard"
    };
    delete bookingData.guest;

    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) {
      console.error("Booking creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Internal Server Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
