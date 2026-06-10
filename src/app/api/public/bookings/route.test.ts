import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  getSupabaseAdminMock,
  sendMailMock,
  checkRateLimitMock,
  rateLimitResponseMock,
} = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  sendMailMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  rateLimitResponseMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/mailer", () => ({
  sendMail: sendMailMock,
}));

vi.mock("@/lib/api-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-security")>("@/lib/api-security");
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    rateLimitResponse: rateLimitResponseMock,
  };
});

import { POST } from "./route";

function createJsonRequest(body: unknown, headers?: HeadersInit) {
  return {
    json: async () => body,
    headers: new Headers(headers),
  } as any;
}

function createSupabaseMock(options?: {
  rooms?: Array<Record<string, unknown>>;
  bookings?: Array<Record<string, unknown>>;
  existingGuestId?: string | null;
  createdBookingId?: string;
}) {
  const cleanupVerificationLtMock = vi.fn(async () => ({ error: null }));
  const cleanupVerificationEqMock = vi.fn(() => ({ lt: cleanupVerificationLtMock }));
  const cleanupVerificationDeleteMock = vi.fn(() => ({ eq: cleanupVerificationEqMock }));
  const cleanupPaymentLtMock = vi.fn(async () => ({ error: null }));
  const cleanupPaymentNotMock = vi.fn(() => ({ lt: cleanupPaymentLtMock }));
  const cleanupPaymentEqMock = vi.fn(() => ({ not: cleanupPaymentNotMock }));
  const cleanupPaymentDeleteMock = vi.fn(() => ({ eq: cleanupPaymentEqMock }));
  const cancelBookingEqMock = vi.fn(async () => ({ error: null }));
  const cancelBookingDeleteMock = vi.fn(() => ({ eq: cancelBookingEqMock }));
  const bookingInsertSingleMock = vi.fn(async () => ({
    data: {
      id: options?.createdBookingId ?? "booking-1",
      reference_number: "DM-TEST123",
      check_in_date: "2026-04-10",
      check_out_date: "2026-04-12",
      room_type_requested: "Deluxe",
      total_amount: 2400,
      deposit_paid: 0,
      balance_due: 2400,
      status: "Pending Verification",
    },
    error: null,
  }));
  const bookingInsertSelectMock = vi.fn(() => ({
    single: bookingInsertSingleMock,
  }));
  const bookingInsertMock = vi.fn(() => ({
    select: bookingInsertSelectMock,
  }));
  const bookingDeleteMock = vi
    .fn()
    .mockImplementationOnce(cleanupVerificationDeleteMock)
    .mockImplementationOnce(cleanupPaymentDeleteMock)
    .mockImplementation(cancelBookingDeleteMock);
  const existingGuestMaybeSingleMock = vi.fn(async () => ({
    data: options?.existingGuestId ? { id: options.existingGuestId } : null,
    error: null,
  }));
  const guestInsertSingleMock = vi.fn(async () => ({
    data: { id: "guest-1" },
    error: null,
  }));
  const guestInsertSelectMock = vi.fn(() => ({
    single: guestInsertSingleMock,
  }));
  const guestInsertMock = vi.fn(() => ({
    select: guestInsertSelectMock,
  }));
  const guestUpdateEqMock = vi.fn(async () => ({ error: null }));
  const guestUpdateMock = vi.fn(() => ({ eq: guestUpdateEqMock }));
  const roomsEqActiveMock = vi.fn(async () => ({
    data: options?.rooms ?? [],
    error: null,
  }));
  const roomsEqTypeMock = vi.fn(() => ({
    eq: roomsEqActiveMock,
  }));
  const bookingsGteMock = vi.fn(async () => ({
    data: options?.bookings ?? [],
    error: null,
  }));
  const bookingsLteMock = vi.fn(() => ({
    gte: bookingsGteMock,
  }));
  const bookingsNotMock = vi.fn(() => ({
    lte: bookingsLteMock,
  }));
  const bookingsInMock = vi.fn(() => ({
    not: bookingsNotMock,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            eq: roomsEqTypeMock,
          })),
        };
      }

      if (table === "bookings") {
        return {
          delete: bookingDeleteMock,
          select: vi.fn(() => ({
            in: bookingsInMock,
          })),
          insert: bookingInsertMock,
        };
      }

      if (table === "guests") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: existingGuestMaybeSingleMock,
              })),
            })),
          })),
          insert: guestInsertMock,
          update: guestUpdateMock,
        };
      }

      if (table === "discounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === "settings") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    cleanupVerificationDeleteMock,
    cleanupVerificationEqMock,
    cleanupVerificationLtMock,
    cancelBookingEqMock,
  };
}

describe("POST /api/public/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue({
      allowed: true,
      remaining: 2,
      resetAt: Date.now() + 60_000,
    });
    rateLimitResponseMock.mockImplementation((resetAt: number) =>
      NextResponse.json({ error: `limited:${resetAt}` }, { status: 429 })
    );
  });

  it("rejects invalid booking payloads before touching the database", async () => {
    const response = await POST(
      createJsonRequest({
        email: "guest@example.com",
        phone_number: "0917",
        room_type_requested: "Deluxe",
        check_in_date: "2026-04-10",
        check_out_date: "2026-04-12",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Full name is required." });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns the configured rate-limit response when public booking throttle is exhausted", async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: 12345,
    });

    const response = await POST(createJsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(rateLimitResponseMock).toHaveBeenCalledWith(12345);
    expect(body).toEqual({ error: "limited:12345" });
  });

  it("cancels expired pending bookings before rejecting unavailable inventory", async () => {
    const supabaseState = createSupabaseMock({ rooms: [] });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        full_name: "Guest One",
        email: "guest@example.com",
        phone_number: "09171234567",
        room_id_requested: "room-1",
        check_in_date: "2026-04-10",
        check_out_date: "2026-04-12",
        human_check: true,
        agree_terms: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "This room type is not available right now." });
    expect(supabaseState.cleanupVerificationDeleteMock).toHaveBeenCalled();
    expect(supabaseState.cleanupVerificationEqMock).toHaveBeenCalledWith("status", "Pending Verification");
    expect(supabaseState.cleanupVerificationLtMock).toHaveBeenCalled();
  });

  it("rejects overlapping reservations when all candidate rooms are already occupied", async () => {
    const supabaseState = createSupabaseMock({
      rooms: [
        {
          id: "room-1",
          room_number: "101",
          room_type: "Deluxe",
          is_active: true,
          status: "Available",
          rate_24h_enabled: true,
          rate_24h_price: 1200,
        },
      ],
      bookings: [
        {
          room_id: "room-1",
          check_in_date: "2026-04-11",
          check_out_date: "2026-04-13",
          status: "Confirmed",
          verification_code_expires_at: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        full_name: "Guest One",
        email: "guest@example.com",
        phone_number: "09171234567",
        room_id_requested: "room-1",
        check_in_date: "2026-04-10",
        check_out_date: "2026-04-12",
        human_check: true,
        agree_terms: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "No rooms available for your selected dates." });
  });

  it("cancels the pending booking when verification mail delivery fails", async () => {
    const supabaseState = createSupabaseMock({
      rooms: [
        {
          id: "room-1",
          room_number: "101",
          room_type: "Deluxe",
          is_active: true,
          status: "Available",
          rate_24h_enabled: true,
          rate_24h_price: 1200,
        },
      ],
      bookings: [],
      existingGuestId: "guest-1",
      createdBookingId: "booking-mail-fail",
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);
    sendMailMock.mockRejectedValue(new Error("smtp unavailable"));

    const response = await POST(
      createJsonRequest({
        full_name: "Guest One",
        email: "guest@example.com",
        phone_number: "09171234567",
        room_id_requested: "room-1",
        check_in_date: "2026-04-10",
        check_out_date: "2026-04-12",
        human_check: true,
        agree_terms: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "smtp unavailable" });
    expect(supabaseState.cancelBookingEqMock).toHaveBeenCalledWith("id", "booking-mail-fail");
  });
});
