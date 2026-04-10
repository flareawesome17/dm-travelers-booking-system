import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermissionMock,
  getOrCreateActiveShiftLogMock,
  minutesUntilShiftEndMock,
  minutesPastShiftEndMock,
  manilaTimeStringMock,
  getSupabaseAdminMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getOrCreateActiveShiftLogMock: vi.fn(),
  minutesUntilShiftEndMock: vi.fn(),
  minutesPastShiftEndMock: vi.fn(),
  manilaTimeStringMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/shiftUtils", () => ({
  getOrCreateActiveShiftLog: getOrCreateActiveShiftLogMock,
  minutesUntilShiftEnd: minutesUntilShiftEndMock,
  minutesPastShiftEnd: minutesPastShiftEndMock,
  manilaTimeString: manilaTimeStringMock,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}));

import { GET } from "./route";

describe("GET /api/shifts/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requirePermissionMock.mockResolvedValue({
      payload: { sub: "admin-1" },
    });

    getOrCreateActiveShiftLogMock.mockResolvedValue({
      shift: {
        id: "shift-afternoon",
        name: "Afternoon",
        start_time: "15:00:00",
        end_time: "22:00:00",
        sort_order: 1,
        is_active: true,
      },
      shiftLog: {
        id: "shift-log-1",
        date: "2026-04-10",
        status: "OPEN",
      },
      shifts: [
        {
          id: "shift-afternoon",
          name: "Afternoon",
          start_time: "15:00:00",
          end_time: "22:00:00",
          sort_order: 1,
          is_active: true,
        },
        {
          id: "shift-night",
          name: "Night",
          start_time: "22:00:00",
          end_time: "06:00:00",
          sort_order: 2,
          is_active: true,
        },
      ],
      is_overtime: true,
    });

    minutesUntilShiftEndMock.mockReturnValue(0);
    minutesPastShiftEndMock.mockReturnValue(75);
    manilaTimeStringMock.mockResolvedValue("23:15:00");

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "shift_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "shift_logs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: "prev-open-log", status: "OPEN" },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  it("returns an overtime warning without forcing an automatic close in manual mode", async () => {
    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.time).toMatchObject({
      minutes_remaining: 75,
      overtime_minutes: 75,
      is_ending_soon: false,
    });
    expect(body.warnings).toMatchObject({
      is_overtime: true,
      previous_shift_open: false,
    });
    expect(body.warnings.overtime).toContain("75 minutes past schedule");
    expect(body.warnings.overtime).toContain("Manual mode is on");
    expect(body.warnings.ending_soon).toBeNull();
  });
});
