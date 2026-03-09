import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'users.manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, role_id, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role_id: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'users.manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 10);
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      email: parsed.data.email,
      password_hash,
      role_id: parsed.data.role_id,
    })
    .select('id, email, role_id, is_active, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
