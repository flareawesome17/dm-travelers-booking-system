import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminMock, sendMailMock } = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

vi.mock("@/lib/mailer", () => ({
  sendMail: sendMailMock,
}));

import { POST } from "./route";

function createJsonRequest(body: unknown) {
  return {
    json: async () => body,
  } as any;
}

function createSupabaseMock(options: {
  booking: Record<string, unknown>;
  updateError?: { message: string } | null;
}) {
  const bookingUpdateEqMock = vi.fn(async () => ({
    error: options.updateError ?? null,
  }));
  const bookingUpdateMock = vi.fn(() => ({
    eq: bookingUpdateEqMock,
  }));
  const bookingSingleMock = vi.fn(async () => ({
    data: options.booking,
    error: null,
  }));

  const supabase = {
    from: vi.fn((table: string) => {
      if (table !== "bookings") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: bookingSingleMock,
          })),
        })),
        update: bookingUpdateMock,
      };
    }),
  };

  return {
    supabase,
    bookingUpdateEqMock,
  };
}

describe("POST /api/public/bookings/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects verification attempts for bookings that are no longer pending", async () => {
    const supabaseState = createSupabaseMock({
      booking: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        reference_number: "DM-1001",
        status: "Confirmed",
        verification_code: null,
        verification_code_expires_at: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        booking_id: "550e8400-e29b-41d4-a716-446655440000",
        email: "guest@example.com",
        code: "123456",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "This booking is not pending verification." });
  });

  it("cancels expired pending bookings when their code is no longer valid", async () => {
    const supabaseState = createSupabaseMock({
      booking: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        reference_number: "DM-1002",
        status: "Pending Verification",
        verification_code: "123456",
        verification_code_expires_at: "2026-03-30T00:00:00.000Z",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        booking_id: "550e8400-e29b-41d4-a716-446655440001",
        email: "guest@example.com",
        code: "123456",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Code expired. Please create a new booking." });
    expect(supabaseState.bookingUpdateEqMock).toHaveBeenCalledWith(
      "id",
      "550e8400-e29b-41d4-a716-446655440001"
    );
  });

  it("rejects incorrect verification codes without mutating the booking", async () => {
    const supabaseState = createSupabaseMock({
      booking: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        reference_number: "DM-1003",
        status: "Pending Verification",
        verification_code: "123456",
        verification_code_expires_at: "2099-04-10T00:00:00.000Z",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        booking_id: "550e8400-e29b-41d4-a716-446655440002",
        email: "guest@example.com",
        code: "999999",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Incorrect code." });
    expect(supabaseState.bookingUpdateEqMock).not.toHaveBeenCalled();
  });

  it("confirms pending bookings and returns the financial summary fields used by the frontend", async () => {
    const supabaseState = createSupabaseMock({
      booking: {
        id: "550e8400-e29b-41d4-a716-446655440003",
        reference_number: "DM-1004",
        status: "Pending Verification",
        verification_code: "123456",
        verification_code_expires_at: "2099-04-10T00:00:00.000Z",
        room_type_requested: "Deluxe",
        check_in_date: "2026-04-10",
        check_out_date: "2026-04-12",
        total_amount: 2400,
        deposit_paid: 0,
        balance_due: 2400,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseState.supabase);

    const response = await POST(
      createJsonRequest({
        booking_id: "550e8400-e29b-41d4-a716-446655440003",
        email: "guest@example.com",
        code: "123456",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(supabaseState.bookingUpdateEqMock).toHaveBeenCalledWith(
      "id",
      "550e8400-e29b-41d4-a716-446655440003"
    );
    expect(body).toMatchObject({
      booking_id: "550e8400-e29b-41d4-a716-446655440003",
      reference_number: "DM-1004",
      status: "Confirmed",
      room_type_requested: "Deluxe",
      check_in_date: "2026-04-10",
      check_out_date: "2026-04-12",
      total_amount: 2400,
      deposit_paid: 0,
      balance_due: 2400,
    });
  });
});
