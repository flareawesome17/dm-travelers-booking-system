import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkIn = searchParams.get('check_in');
  const checkOut = searchParams.get('check_out');
  const admin = await getAdminFromRequest(req);

  if (admin && hasPermission(admin.role_id, 'rooms.read')) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('room_number');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data: rooms, error } = await supabaseAdmin
    .from('rooms')
    .select('id, room_number, room_type, floor, capacity, base_price_per_night, amenities, image_urls, status')
    .eq('is_active', true)
    .in('status', ['Available', 'Clean'])
    .order('room_number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (checkIn && checkOut && rooms?.length) {
    const { data: booked } = await supabaseAdmin
      .from('bookings')
      .select('room_id')
      .not('status', 'in', '("Cancelled","No Show")')
      .lte('check_in_date', checkOut)
      .gte('check_out_date', checkIn);
    const bookedIds = new Set((booked || []).map((b: { room_id: string }) => b.room_id));
    const available = rooms.filter((r: { id: string }) => !bookedIds.has(r.id));
    return NextResponse.json(available);
  }

  return NextResponse.json(rooms || []);
}

const createSchema = z.object({
  room_number: z.string().min(1),
  room_type: z.string().min(1),
  room_type_id: z.number().int().optional(),
  floor: z.number().int().optional(),
  capacity: z.number().int().min(1).default(2),
  base_price_per_night: z.number().positive(),
  amenities: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'rooms.create')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .insert({
      room_number: parsed.data.room_number,
      room_type: parsed.data.room_type,
      room_type_id: parsed.data.room_type_id ?? null,
      floor: parsed.data.floor ?? null,
      capacity: parsed.data.capacity,
      base_price_per_night: parsed.data.base_price_per_night,
      status: 'Available',
      amenities: parsed.data.amenities ?? [],
      image_urls: parsed.data.image_urls ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
