import { describe, expect, it } from "vitest";
import { packTimelineBookings } from "./calendarLayout";

describe("packTimelineBookings", () => {
  const viewStart = new Date("2026-04-09T00:00:00.000Z");
  const viewEnd = new Date("2026-04-10T00:00:00.000Z");

  it("assigns overlapping bookings to separate lanes and reuses lanes when possible", () => {
    const packed = packTimelineBookings(
      [
        {
          id: "a",
          check_in_date: "2026-04-09T01:00:00.000Z",
          check_out_date: "2026-04-09T06:00:00.000Z",
        },
        {
          id: "b",
          check_in_date: "2026-04-09T03:00:00.000Z",
          check_out_date: "2026-04-09T07:00:00.000Z",
        },
        {
          id: "c",
          check_in_date: "2026-04-09T07:00:00.000Z",
          check_out_date: "2026-04-09T09:00:00.000Z",
        },
      ],
      viewStart,
      viewEnd,
    );

    expect(packed.map((item) => ({ id: item.booking.id, lane: item.lane }))).toEqual([
      { id: "a", lane: 0 },
      { id: "b", lane: 1 },
      { id: "c", lane: 0 },
    ]);
    expect(packed.every((item) => item.laneCount === 2)).toBe(true);
  });

  it("clips bookings to the visible range and keeps valid positions", () => {
    const packed = packTimelineBookings(
      [
        {
          id: "clipped",
          check_in_date: "2026-04-08T20:00:00.000Z",
          check_out_date: "2026-04-10T04:00:00.000Z",
        },
      ],
      viewStart,
      viewEnd,
    );

    expect(packed).toHaveLength(1);
    expect(packed[0]?.clippedStart).toBe(true);
    expect(packed[0]?.clippedEnd).toBe(true);
    expect(packed[0]?.leftPercent).toBe(0);
    expect(packed[0]?.widthPercent).toBeLessThanOrEqual(100);
    expect(packed[0]?.widthPercent).toBeGreaterThan(0);
  });
});
