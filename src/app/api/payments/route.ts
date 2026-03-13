import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import jwt from "jsonwebtoken";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    try {
      jwt.verify(token, process.env.JWT_SECRET || "changeme");
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, amount, method, type, transaction_id } = body;

    if (!booking_id || !amount || !method || !type) {
      return NextResponse.json({ error: "Missing required payment fields" }, { status: 400 });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch current booking details to calculate new balance
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("total_amount, deposit_paid, balance_due, status, restaurant_charges_total")
      .eq("id", booking_id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Grand total includes room + restaurant
    const grandTotal = Number(booking.total_amount) + Number(booking.restaurant_charges_total || 0);

    // 2. Insert the payment record
    const tId = transaction_id?.trim() || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { error: insertError } = await supabase
      .from("payments")
      .insert({
        booking_id,
        amount: payAmount,
        method,
        type,
        transaction_id: tId,
        status: "Success",
      });

    if (insertError) {
      console.error("Payment insert error:", insertError);
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }

    // 3. Calculate new totals
    let newDepositPaid = Number(booking.deposit_paid);
    if (type === "Deposit") {
      newDepositPaid += payAmount;
    }
    
    // We fetch all successful payments to ensure perfect accuracy for balance
    const { data: allPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("booking_id", booking_id)
      .eq("status", "Success");
      
    const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const newBalanceDue = Math.max(0, grandTotal - totalPaid);

    // 4. Determine if status should auto-update
    let newStatus = booking.status;
    if (booking.status === "Pending Payment" && payAmount > 0) {
      newStatus = "Confirmed";
    }

    // 5. Update the booking
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        deposit_paid: newDepositPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Booking update error after payment:", updateError);
      return NextResponse.json({ error: "Payment logged, but failed to update booking balance" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Payment recorded successfully",
      balance_due: newBalanceDue,
      status: newStatus
    });

  } catch (error: any) {
    console.error("Payment API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
