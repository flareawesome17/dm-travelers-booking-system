import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createStripePaymentIntent, confirmStripePayment } from '@/lib/services/payment';
import { allocateRoom } from '@/lib/services/allocation';
import { sendBookingConfirmation } from '@/lib/services/email';
import QRCode from 'qrcode';
import { z } from 'zod';

const bodySchema = z.object({
  booking_id: z.string().uuid(),
  method: z.enum(['Stripe', 'PayPal', 'GCash']),
  payment_intent_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('*, guests(*)')
    .eq('id', parsed.data.booking_id)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'Pending Payment') {
    return NextResponse.json({ error: 'Booking not in Pending Payment state' }, { status: 400 });
  }

  const depositAmount = Number(booking.total_amount) * 0.3;

  if (parsed.data.method === 'Stripe') {
    if (parsed.data.payment_intent_id) {
      const ok = await confirmStripePayment(parsed.data.payment_intent_id);
      if (!ok) return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 });
    }
    // If no payment_intent_id (e.g. demo or pay-at-hotel flow), allow confirmation for 30% deposit
  }
  // PayPal / GCash: integrate their confirmation in production

  const roomId = await allocateRoom(
    booking.room_type_requested,
    booking.check_in_date,
    booking.check_out_date
  );

  const qrPayload = `${booking.reference_number}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload).catch(() => null);

  const { error: payErr } = await supabaseAdmin.from('payments').insert({
    booking_id: booking.id,
    transaction_id: `dep-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    method: parsed.data.method,
    amount: depositAmount,
    type: 'Deposit',
    status: 'Success',
  });

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'Confirmed',
      deposit_paid: depositAmount,
      balance_due: Number(booking.total_amount) - depositAmount,
      room_id: roomId,
      guest_qr_code: qrPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.booking_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (roomId) {
    await supabaseAdmin.from('rooms').update({ status: 'Occupied', updated_at: new Date().toISOString() }).eq('id', roomId);
  }

  const guest = Array.isArray(booking.guests) ? booking.guests[0] : booking.guests;
  const email = guest?.email || '';
  if (email) {
    try {
      await sendBookingConfirmation(
        email,
        booking.reference_number,
        qrDataUrl,
        booking.check_in_date,
        booking.check_out_date,
        Number(booking.total_amount) - depositAmount
      );
    } catch (_) {}
  }

  return NextResponse.json({
    success: true,
    reference_number: booking.reference_number,
    guest_qr_code: qrPayload,
    qr_data_url: qrDataUrl,
  });
}
