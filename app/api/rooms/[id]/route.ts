import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

const patchSchema = z.object({
  room_number: z.string().min(1).optional(),
  room_type: z.string().optional(),
  floor: z.number().int().optional(),
  capacity: z.number().int().min(1).optional(),
  base_price_per_night: z.number().positive().optional(),
  status: z.enum(['Available', 'Occupied', 'Dirty', 'In Cleaning', 'Maintenance']).optional(),
  is_active: z.boolean().optional(),
  maintenance_flag: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'rooms.update')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
