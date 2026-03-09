import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAdminFromRequest } from '@/lib/api/auth';
import { hasPermission } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !hasPermission(admin.role_id, 'reports.read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start') || new Date().toISOString().slice(0, 10);
  const end = searchParams.get('end') || start;

  const { count: totalRooms } = await supabaseAdmin
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('check_in_date, check_out_date')
    .not('status', 'in', '("Cancelled","No Show")')
    .lte('check_in_date', end)
    .gte('check_out_date', start);

  const days: Record<string, number> = {};
  const startD = new Date(start);
  const endD = new Date(end);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    days[day] = 0;
  }

  const total = totalRooms || 1;
  for (const b of bookings || []) {
    const a = new Date(b.check_in_date);
    const out = new Date(b.check_out_date);
    for (let d = new Date(a); d < out; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      if (days[day] !== undefined) days[day]++;
    }
  }

  const series = Object.entries(days).map(([date, count]) => ({
    date,
    occupancy: total ? Math.round((count / total) * 100) : 0,
    count,
  }));

  return NextResponse.json({ total_rooms: total, series });
}
