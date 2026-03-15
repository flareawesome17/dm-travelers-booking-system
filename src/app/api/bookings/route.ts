import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("*, guests(*), rooms(*), restaurant_orders:restaurant_orders(*)")
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

    const totalAmount = Number(body.total_amount || 0);
    const depositPaid = Number(body.deposit_paid || 0);
    const computedBalance = body.balance_due != null ? Number(body.balance_due) : Math.max(0, totalAmount - depositPaid);
    const computedStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : depositPaid > 0
          ? "Confirmed"
          : "Pending Payment";

    const bookingData = {
      ...body,
      guest_id: guestId,
      reference_number: body.reference_number || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      total_amount: totalAmount,
      deposit_paid: depositPaid,
      balance_due: computedBalance,
      status: computedStatus,
      room_type_requested: body.room_type_requested || "Standard",
    };
    delete bookingData.guest;
    const depositMethodRaw = typeof body.deposit_method === "string" ? body.deposit_method : null;
    delete bookingData.deposit_method;

    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) {
      console.error("Booking creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (depositPaid > 0 && data?.id) {
      const method = depositMethodRaw && ["Cash", "GCash", "Card", "Stripe", "PayPal"].includes(depositMethodRaw) ? depositMethodRaw : "Cash";
      const today = manilaDateString();
      const accountingDate = await findNextOpenLedgerDate(supabase, today);
      const transactionId = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}-${String(data.reference_number || "REF").replace(/[^A-Z0-9_-]/gi, "")}`;

      const { error: pErr } = await supabase.from("payments").insert({
        booking_id: data.id,
        transaction_id: transactionId,
        method,
        amount: depositPaid,
        type: "Deposit",
        status: "Success",
        accounting_date: accountingDate,
      });
      if (pErr) {
        console.error("Deposit payment insert error:", pErr);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Internal Server Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
