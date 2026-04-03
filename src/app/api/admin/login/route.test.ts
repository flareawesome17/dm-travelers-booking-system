import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  getSupabaseAdminMock,
  sendMailMock,
  parseAndValidateMock,
  checkRateLimitMock,
  rateLimitResponseMock,
  apiErrorMock,
  internalErrorMock,
  bcryptCompareMock,
} = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  sendMailMock: vi.fn(),
  parseAndValidateMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
  apiErrorMock: vi.fn(),
  internalErrorMock: vi.fn(),
  bcryptCompareMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/mailer", () => ({
  sendMail: sendMailMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
  },
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    parseAndValidate: parseAndValidateMock,
    checkRateLimit: checkRateLimitMock,
    rateLimitResponse: rateLimitResponseMock,
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

function createSupabaseMock(options?: {
  user?: Record<string, unknown> | null;
}) {
  const selectSingleMock = vi.fn(async () => ({
    data: options?.user ?? null,
    error: options?.user ? null : { message: "not found" },
  }));

  const otpInsertSingleMock = vi.fn(async () => ({
    data: { id: "otp-1" },
    error: null,
  }));

  const otpUpdateEqMock = vi.fn(async () => ({
    error: null,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "admin_users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: unknown) => {
              if (column === "email") {
                return {
                  eq: vi.fn((secondColumn: string, secondValue: unknown) => {
                    expect(secondColumn).toBe("is_active");
                    expect(secondValue).toBe(true);
                    return {
                      single: selectSingleMock,
                    };
                  }),
                };
              }

              throw new Error(`Unexpected column: ${column}=${String(value)}`);
            }),
          })),
        };
      }

      if (table === "admin_login_otps") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: otpInsertSingleMock,
            })),
          })),
          update: vi.fn(() => ({
            eq: otpUpdateEqMock,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
  };
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_LOGIN_OTP_SECRET = "test-admin-otp-secret";
    parseAndValidateMock.mockResolvedValue({
      success: true,
      data: {
        email: "admin@example.com",
        password: "secret",
      },
    });
    checkRateLimitMock.mockReturnValue({
      allowed: true,
      remaining: 4,
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
    sendMailMock.mockResolvedValue(undefined);
  });

  it("returns the shared throttle response when login attempts exceed the route limit", async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: 67890,
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(rateLimitResponseMock).toHaveBeenCalledWith(67890);
    expect(body).toEqual({ error: "limited:67890" });
  });

  it("rejects invalid credentials when no active admin account matches the email", async () => {
    const supabaseState = createSupabaseMock({ user: null });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "invalid_credentials",
        message: "Invalid email or password",
      },
    });
    expect(bcryptCompareMock).not.toHaveBeenCalled();
  });

  it("creates an OTP challenge for valid active credentials", async () => {
    const supabaseState = createSupabaseMock({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        password_hash: "hashed-password",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    bcryptCompareMock.mockResolvedValue(true);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(body).toMatchObject({
      requires_otp: true,
      otp_id: "otp-1",
      to: "a***@example.com",
    });
  });
});
