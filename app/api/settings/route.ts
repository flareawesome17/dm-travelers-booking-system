import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';

export async function GET(_req: NextRequest) {
  const { data, error } = await supabaseAdmin.from('settings').select('key, value, description');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Record<string, string> = {};
  for (const row of data || []) map[row.key] = row.value;
  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'settings.manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  for (const [key, value] of Object.entries(body)) {
    await supabaseAdmin.from('settings').upsert({ key, value: String(value), description: null }, { onConflict: 'key' });
  }
  return NextResponse.json({ ok: true });
}
