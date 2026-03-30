import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireEnvSecret, apiError } from "@/lib/api-security";

const JWT_ISSUER = "dm-travelers-inn";
const JWT_AUDIENCE = "dm-admin-panel";
export const ADMIN_AUTH_COOKIE = "dm_admin_session";
const DEFAULT_ADMIN_TOKEN_TTL_SECONDS = 86400;

function getJwtSecret(): string {
  return requireEnvSecret("JWT_SECRET");
}

function getAdminTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return req.cookies.get(ADMIN_AUTH_COOKIE)?.value ?? null;
}

export function verifyAdminTokenValue(
  token: string
): { payload: jwt.JwtPayload } | { error: NextResponse } {
  try {
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
 * Verify the admin JWT token from the Authorization header.
 * Returns the decoded payload or a 401 NextResponse on failure.
 */
export function verifyAdminToken(
  req: NextRequest
): { payload: jwt.JwtPayload } | { error: NextResponse } {
  const token = getAdminTokenFromRequest(req);
  if (!token) {
    return { error: apiError("unauthorized", "Authentication required", 401) };
  }

  return verifyAdminTokenValue(token);
}

/**
 * Sign a new admin JWT token.
 */
export function signAdminToken(payload: Record<string, unknown>, expiresInSeconds = DEFAULT_ADMIN_TOKEN_TTL_SECONDS): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function setAdminSessionCookie(
  response: NextResponse,
  token: string,
  maxAge = DEFAULT_ADMIN_TOKEN_TTL_SECONDS
) {
  response.cookies.set({
    name: ADMIN_AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return response;
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
