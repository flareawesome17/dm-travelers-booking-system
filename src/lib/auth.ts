import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireEnvSecret, apiError } from "@/lib/api-security";

const JWT_ISSUER = "dm-travelers-inn";
const JWT_AUDIENCE = "dm-admin-panel";

function getJwtSecret(): string {
  return requireEnvSecret("JWT_SECRET");
}

/**
 * Verify the admin JWT token from the Authorization header.
 * Returns the decoded payload or a 401 NextResponse on failure.
 */
export function verifyAdminToken(
  req: NextRequest
): { payload: jwt.JwtPayload } | { error: NextResponse } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: apiError("unauthorized", "Authentication required", 401) };
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    return { payload };
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? "Token expired"
        : "Invalid token";
    return { error: apiError("invalid_token", message, 401) };
  }
}

/**
 * Sign a new admin JWT token.
 */
export function signAdminToken(payload: Record<string, unknown>, expiresInSeconds = 86400): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}
