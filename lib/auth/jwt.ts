import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const alg = 'HS256';

export async function signToken(payload: { sub: string; email: string; role_id: number }) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string; role_id: number } | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as { sub: string; email: string; role_id: number };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
