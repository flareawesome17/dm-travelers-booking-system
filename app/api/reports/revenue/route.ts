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
  const start = searchParams.get('start') || new Date().toISOString().slice(0, 7) + '-01';
  const end = searchParams.get('end') || new Date().toISOString().slice(0, 10);
  const format = searchParams.get('format'); // csv | pdf

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('amount, method, type, transaction_time, booking_id')
    .eq('status', 'Success')
    .gte('transaction_time', start)
    .lte('transaction_time', end + 'T23:59:59.999Z');

  const byMethod: Record<string, number> = {};
  let total = 0;
  for (const p of payments || []) {
    const amt = Number(p.amount);
    total += amt;
    byMethod[p.method] = (byMethod[p.method] || 0) + amt;
  }

  const summary = { total, by_method: byMethod, start, end };

  if (format === 'csv') {
    const header = 'Date,Method,Type,Amount\n';
    const rows = (payments || [])
      .map((p) => `${(p as { transaction_time: string }).transaction_time.slice(0, 10)},${p.method},${p.type},${p.amount}`)
      .join('\n');
    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="revenue-${start}-${end}.csv"`,
      },
    });
  }

  return NextResponse.json(summary);
}
