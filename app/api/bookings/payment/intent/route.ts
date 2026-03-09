import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createStripePaymentIntent } from '@/lib/services/payment';
import { z } from 'zod';

const bodySchema = z.object({
  booking_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, reference_number, total_amount, status')
    .eq('id', parsed.data.booking_id)
    .single();

  if (error || !booking || booking.status !== 'Pending Payment') {
    return NextResponse.json({ error: 'Booking not found or not ready for payment' }, { status: 404 });
  }

  const depositAmount = Number(booking.total_amount) * 0.3;
  const result = await createStripePaymentIntent(
    depositAmount,
    booking.id,
    booking.reference_number
  );

  if (!result) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
  }

  return NextResponse.json({
    client_secret: result.clientSecret,
    payment_intent_id: result.paymentIntentId,
  });
}
