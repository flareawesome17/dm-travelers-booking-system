import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { signToken } from '@/lib/auth/jwt';
import { checkLoginRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';
  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts' },
      { status: 429, headers: limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : {} }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, password_hash, role_id, is_active')
    .eq('email', parsed.data.email)
    .single();

  if (!user || !user.is_active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role_id: user.role_id,
  });

  return NextResponse.json({ token, user: { id: user.id, email: user.email, role_id: user.role_id } });
}
