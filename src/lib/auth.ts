import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

/**
 * Verify the admin JWT token from the Authorization header.
 * Returns the decoded payload or a 401 NextResponse on failure.
 */
export function verifyAdminToken(
  req: NextRequest
): { payload: jwt.JwtPayload } | { error: NextResponse } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return { payload };
  } catch {
    return { error: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }) };
  }
}

/**
 * Sign a new admin JWT token.
 */
export function signAdminToken(payload: Record<string, unknown>, expiresInSeconds = 86400): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}
