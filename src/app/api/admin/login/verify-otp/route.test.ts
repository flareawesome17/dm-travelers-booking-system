import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  getSupabaseAdminMock,
  parseAndValidateMock,
  checkRateLimitMock,
  rateLimitResponseMock,
  timingSafeCompareMock,
  apiErrorMock,
  internalErrorMock,
  signAdminTokenMock,
  setAdminSessionCookieMock,
  createAdminSessionSnapshotMock,
} = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  timingSafeCompareMock: vi.fn(),
  apiErrorMock: vi.fn(),
  internalErrorMock: vi.fn(),
  signAdminTokenMock: vi.fn(),
  setAdminSessionCookieMock: vi.fn(),
  createAdminSessionSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/auth", () => ({
  signAdminToken: signAdminTokenMock,
  setAdminSessionCookie: setAdminSessionCookieMock,
}));

vi.mock("@/lib/admin-session", () => ({
  createAdminSessionSnapshot: createAdminSessionSnapshotMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
    checkRateLimit: checkRateLimitMock,
    rateLimitResponse: rateLimitResponseMock,
    timingSafeCompare: timingSafeCompareMock,
    apiError: apiErrorMock,
    internalError: internalErrorMock,
  };
});

import { POST } from "./route";

function createRequest() {
  return {
    headers: new Headers(),
  } as any;
}

function createSupabaseMock(options: {
  user?: Record<string, unknown> | null;
  otpRow?: Record<string, unknown> | null;
}) {
  const otpAttemptsEqMock = vi.fn(async () => ({ error: null }));
  const otpUsedEqMock = vi.fn(async () => ({ error: null }));
  const otpUpdateMock = vi.fn((payload: Record<string, unknown>) => {
    if ("used_at" in payload) {
      return {
        eq: otpUsedEqMock,
      };
    }

    return {
      eq: otpAttemptsEqMock,
    };
  });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "admin_users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: options.user ?? null,
                  error: options.user ? null : { message: "not found" },
                })),
              })),
            })),
          })),
        };
      }

      if (table === "admin_login_otps") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: options.otpRow ?? null,
                  error: null,
                })),
              })),
            })),
          })),
          update: otpUpdateMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    otpAttemptsEqMock,
    otpUsedEqMock,
  };
}

describe("POST /api/admin/login/verify-otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_LOGIN_OTP_SECRET = "test-admin-otp-secret";
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        otp_id: "otp-1",
        otp: "ABC123",
        email: "admin@example.com",
      },
    });
    checkRateLimitMock.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    rateLimitResponseMock.mockImplementation((resetAt: number) =>
      NextResponse.json({ error: `limited:${resetAt}` }, { status: 429 })
    );
    apiErrorMock.mockImplementation((code: string, message: string, status: number) =>
      NextResponse.json({ error: { code, message } }, { status })
    );
    internalErrorMock.mockImplementation(() =>
      NextResponse.json({ error: { code: "internal_error" } }, { status: 500 })
    );
    signAdminTokenMock.mockReturnValue("signed-admin-token");
    createAdminSessionSnapshotMock.mockImplementation((payload: Record<string, unknown>) => ({
      user: {
        id: payload.sub,
        email: payload.email,
      },
      expires_at: null,
    }));
    setAdminSessionCookieMock.mockImplementation((response: NextResponse) => {
      response.headers.set("x-session-cookie", "set");
      return response;
    });
  });

  it("returns the shared throttle response when OTP verification is rate limited", async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: 34567,
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "limited:34567" });
  });

  it("rejects OTPs that are already marked used", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        is_active: true,
      },
      otpRow: {
        id: "otp-1",
        otp_hash: "hash",
        expires_at: "2099-04-10T00:00:00.000Z",
        used_at: "2026-03-31T00:00:00.000Z",
        attempts: 0,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "otp_used",
        message: "OTP already used. Please login again.",
      },
    });
  });

  it("rejects expired OTPs before comparing hashes", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        is_active: true,
      },
      otpRow: {
        id: "otp-1",
        otp_hash: "hash",
        expires_at: "2026-03-30T00:00:00.000Z",
        used_at: null,
        attempts: 0,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "otp_expired",
        message: "OTP expired. Please login again.",
      },
    });
    expect(timingSafeCompareMock).not.toHaveBeenCalled();
  });

  it("rejects OTPs once the per-code attempt cap has been reached", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        is_active: true,
      },
      otpRow: {
        id: "otp-1",
        otp_hash: "hash",
        expires_at: "2099-04-10T00:00:00.000Z",
        used_at: null,
        attempts: 5,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "too_many_attempts",
        message: "Too many attempts. Please login again.",
      },
    });
  });

  it("increments OTP attempts when the provided code is incorrect", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        is_active: true,
      },
      otpRow: {
        id: "otp-1",
        otp_hash: "stored-hash",
        expires_at: "2099-04-10T00:00:00.000Z",
        used_at: null,
        attempts: 2,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    timingSafeCompareMock.mockReturnValue(false);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "invalid_otp",
        message: "Invalid OTP.",
      },
    });
    expect(supabaseState.otpAttemptsEqMock).toHaveBeenCalledWith("id", "otp-1");
  });

  it("issues the admin session cookie when OTP verification succeeds", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role_id: 2,
        is_active: true,
      },
      otpRow: {
        id: "otp-1",
        otp_hash: "stored-hash",
        expires_at: "2099-04-10T00:00:00.000Z",
        used_at: null,
        attempts: 0,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    timingSafeCompareMock.mockReturnValue(true);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(signAdminTokenMock).toHaveBeenCalledOnce();
    expect(supabaseState.otpUsedEqMock).toHaveBeenCalledWith("id", "otp-1");
    expect(setAdminSessionCookieMock).toHaveBeenCalledOnce();
    expect(response.headers.get("x-session-cookie")).toBe("set");
    expect(body).toEqual({
      session: {
        user: {
          id: "admin-1",
          email: "admin@example.com",
        },
        expires_at: null,
      },
    });
  });
});
