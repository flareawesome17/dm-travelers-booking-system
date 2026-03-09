import { NextRequest } from 'next/server';
import { verifyToken, getBearerToken } from '@/lib/auth/jwt';

export async function getAdminFromRequest(req: NextRequest): Promise<{ sub: string; email: string; role_id: number } | null> {
  const token = getBearerToken(req.headers.get('authorization'));
  if (!token) return null;
  return verifyToken(token);
}
