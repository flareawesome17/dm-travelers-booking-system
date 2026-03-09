import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { checkBookingRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { sendVerificationEmail } from '@/lib/services/email';
import crypto from 'crypto';

const createSchema = z.object({
  room_type_requested: z.string().min(1),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  num_adults: z.number().int().min(1).default(1),
  num_children: z.number().int().min(0).default(0),
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
  phone_number: z.string().max(50).optional(),
  special_requests: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*, guests(*), rooms(room_number)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';
  const limit = checkBookingRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : {} }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const ref = `DM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const code = crypto.randomInt(100000, 999999).toString();

  const { data: roomTypes } = await supabaseAdmin.from('room_types').select('id, name').eq('name', p.room_type_requested).single();
  const typeId = roomTypes?.id;
  const { data: sampleRoom } = await supabaseAdmin.from('rooms').select('base_price_per_night').eq('room_type', p.room_type_requested).limit(1).single();
  const rate = Number(sampleRoom?.base_price_per_night || 0);
  const nights = Math.ceil((new Date(p.check_out_date).getTime() - new Date(p.check_in_date).getTime()) / (24 * 60 * 60 * 1000));
  const totalAmount = rate * nights;
  const depositPercent = 0.3;
  const depositPaid = 0;
  const balanceDue = totalAmount;

  const { data: guest, error: guestErr } = await supabaseAdmin
    .from('guests')
    .insert({ full_name: p.full_name, email: p.email, phone_number: p.phone_number || null })
    .select('id')
    .single();

  if (guestErr || !guest) {
    return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data: booking, error: bookErr } = await supabaseAdmin
    .from('bookings')
    .insert({
      reference_number: ref,
      guest_id: guest.id,
      room_type_requested: p.room_type_requested,
      check_in_date: p.check_in_date,
      check_out_date: p.check_out_date,
      num_adults: p.num_adults,
      num_children: p.num_children,
      total_amount: totalAmount,
      deposit_paid: depositPaid,
      balance_due: balanceDue,
      status: 'Pending Verification',
      verification_code: code,
      verification_code_expires_at: expiresAt,
      special_requests: p.special_requests || null,
    })
    .select('id, reference_number')
    .single();

  if (bookErr || !booking) {
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  try {
    await sendVerificationEmail(p.email, code);
  } catch (e) {
    // still return success; code is in DB for manual verification
  }

  return NextResponse.json({
    booking_id: booking.id,
    reference_number: booking.reference_number,
    message: 'Verification code sent to your email.',
  });
}
