import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await getAdminFromRequest(_req);
  if (admin && !hasPermission(admin.role_id, 'bookings.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const byId = uuidRegex.test(id);
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*, guests(*), rooms(room_number, room_type)')
    .eq(byId ? 'id' : 'reference_number', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

const patchSchema = z.object({
  status: z.enum(['Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled', 'No Show']).optional(),
  room_id: z.string().uuid().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'bookings.update')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.room_id !== undefined) update.room_id = parsed.data.room_id;

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
