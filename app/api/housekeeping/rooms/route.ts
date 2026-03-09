import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'housekeeping.read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .in('status', ['Dirty', 'In Cleaning', 'Maintenance', 'Clean'])
    .order('status')
    .order('room_number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
