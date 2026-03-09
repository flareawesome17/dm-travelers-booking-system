import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

export async function GET(_req: NextRequest) {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('is_approved', true)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const createSchema = z.object({
  guest_name: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  booking_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      guest_name: parsed.data.guest_name,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
      booking_id: parsed.data.booking_id ?? null,
      is_approved: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
