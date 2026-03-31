import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

const { requirePermissionMock, getSupabaseAdminMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { GET } from "./route";

function makeRequest(searchParams: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/shifts/history");
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  return { url: url.toString() } as unknown as NextRequest;
}

function createSupabaseMock(options?: {
  logs?: Array<Record<string, unknown>>;
  count?: number;
  error?: { message: string } | null;
}) {
  const rangeMock = vi.fn(async () => ({
    data: options?.logs ?? [
      {
        id: "log-1",
        date: "2026-03-30",
        status: "CLOSED",
        closed_at: "2026-03-30T22:00:00Z",
        close_notes: "All good",
        total_income: 5000,
        total_expense: 1000,
        net_total: 4000,
        shifts: { id: "shift-1", name: "Morning", start_time: "06:00", end_time: "14:00" },
      },
    ],
    error: options?.error ?? null,
    count: options?.count ?? 1,
  }));

  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              range: rangeMock,
            })),
          })),
        })),
      })),
    })),
  };

  return { supabase, rangeMock };
}

describe("GET /api/shifts/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the permission error when the caller lacks shifts.read", async () => {
    requirePermissionMock.mockResolvedValue({
      error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }),
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: { code: "forbidden" } });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("returns a paginated list of closed shift logs with default pagination", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("log-1");
    expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("returns an empty data array when there are no closed shifts", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({ logs: [], count: 0 });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination).toMatchObject({ total: 0, totalPages: 0 });
  });

  it("respects custom page and limit query parameters", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase, rangeMock } = createSupabaseMock({ logs: [], count: 0 });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest({ page: "2", limit: "5" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rangeMock).toHaveBeenCalledWith(5, 9);
    expect(body.pagination).toMatchObject({ page: 2, limit: 5 });
  });

  it("clamps limit to a maximum of 50", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase, rangeMock } = createSupabaseMock({ logs: [], count: 0 });
    getSupabaseAdminMock.mockReturnValue(supabase);

    await GET(makeRequest({ limit: "200" }));

    expect(rangeMock).toHaveBeenCalledWith(0, 49);
  });

  it("returns 500 when the database query fails", async () => {
    requirePermissionMock.mockResolvedValue({ payload: { sub: "admin-1" } });
    const { supabase } = createSupabaseMock({ error: { message: "db error" } });
    getSupabaseAdminMock.mockReturnValue(supabase);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db error");
  });
});
