import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema, ZodError } from "zod";
import crypto from "crypto";

// ─── Standardized API Error Response ───────────────────────────────────────────

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: Array<{ field: string; message: string; code: string }>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

export function validationError(zodError: ZodError): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: zodError.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      },
    },
    { status: 422 }
  );
}

export function internalError(): NextResponse<ApiErrorResponse> {
  return apiError("internal_error", "Internal server error", 500);
}

export function unauthorizedError(): NextResponse<ApiErrorResponse> {
  return apiError("unauthorized", "Authentication required", 401);
}

export function forbiddenError(): NextResponse<ApiErrorResponse> {
  return apiError("forbidden", "Insufficient permissions", 403);
}

// ─── Safe Database Error (never leaks internals) ───────────────────────────────

export function dbError(error: unknown, fallbackMessage = "Operation failed"): NextResponse<ApiErrorResponse> {
  // Log the real error server-side for debugging
  console.error("[DB_ERROR]", error);
  return apiError("database_error", fallbackMessage, 500);
}

// ─── Input Validation ──────────────────────────────────────────────────────────

export function validateBody<T>(body: unknown, schema: ZodSchema<T>):
  | { success: true; data: T }
  | { success: false; error: NextResponse<ApiErrorResponse> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, error: validationError(result.error) };
  }
  return { success: true, data: result.data };
}

export async function parseAndValidate<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<
  | { success: true; data: T }
  | { success: false; error: NextResponse<ApiErrorResponse> }
> {
  try {
    const body = await req.json();
    return validateBody(body, schema);
  } catch {
    return {
      success: false,
      error: apiError("invalid_json", "Request body must be valid JSON", 400),
    };
  }
}

// ─── Rate Limiting (In-Memory) ─────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leak
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}

export function checkRateLimit(
  req: NextRequest,
  options: {
    /** Unique key prefix for this limiter (e.g., "login", "public_booking") */
    key: string;
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
  }
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanupExpiredEntries();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const storeKey = `${options.key}:${ip}`;
  const now = Date.now();

  const existing = rateLimitStore.get(storeKey);

  if (!existing || existing.resetAt <= now) {
    // New window
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    rateLimitStore.set(storeKey, entry);
    return { allowed: true, remaining: options.maxRequests - 1, resetAt: entry.resetAt };
  }

  existing.count++;
  rateLimitStore.set(storeKey, existing);

  if (existing.count > options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

export function rateLimitResponse(resetAt: number): NextResponse<ApiErrorResponse> {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: {
        code: "rate_limit_exceeded",
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}

// ─── File Upload Validation ────────────────────────────────────────────────────

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateFileUpload(file: {
  data?: string;
  name?: string;
  type?: string;
}): { valid: true; buffer: Buffer; ext: string } | { valid: false; error: string } {
  if (!file?.data || !file?.name) {
    return { valid: false, error: "File data and name are required" };
  }

  // Validate extension
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed. Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(", ")}`,
    };
  }

  // Validate MIME type
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_IMAGE_MIMES.has(mime)) {
    return {
      valid: false,
      error: `MIME type ${mime} is not allowed. Allowed: ${Array.from(ALLOWED_IMAGE_MIMES).join(", ")}`,
    };
  }

  // Extract base64 data
  const base64Data = file.data.includes(",") ? file.data.split(",")[1] : file.data;
  if (!base64Data) {
    return { valid: false, error: "Invalid base64 data" };
  }

  // Validate size
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB`,
    };
  }

  // Validate magic bytes (basic MIME verification for common image types)
  if (!verifyMagicBytes(buffer, ext)) {
    return { valid: false, error: "File content does not match its extension" };
  }

  return { valid: true, buffer, ext };
}

function verifyMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  switch (ext) {
    case "jpg":
    case "jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "gif":
      return (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      );
    case "webp":
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    default:
      return true; // Unknown extension, skip check
  }
}

// ─── Timing-Safe Comparison ────────────────────────────────────────────────────

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Secure Secret Accessor ────────────────────────────────────────────────────

export function requireEnvSecret(name: string): string {
  const value = process.env[name];
  if (!value || value === "changeme") {
    throw new Error(
      `SECURITY: Environment variable ${name} is missing or set to an insecure default. ` +
      `Set a strong, unique value in .env.local before running in production.`
    );
  }
  return value;
}
