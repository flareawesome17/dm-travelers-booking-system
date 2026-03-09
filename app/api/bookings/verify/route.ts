import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  booking_id: z.string().uuid(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, verification_code, verification_code_expires_at, status')
    .eq('id', parsed.data.booking_id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'Pending Verification') {
    return NextResponse.json({ error: 'Booking already verified or expired' }, { status: 400 });
  }

  if (booking.verification_code !== parsed.data.code) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  const expires = booking.verification_code_expires_at ? new Date(booking.verification_code_expires_at) : null;
  if (expires && expires < new Date()) {
    return NextResponse.json({ error: 'Verification code expired' }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'Pending Payment',
      verification_code: null,
      verification_code_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.booking_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    booking_id: booking.id,
    message: 'Verified. Proceed to payment.',
  });
}
