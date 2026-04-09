import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineView } from "./TimelineView";

describe("TimelineView", () => {
  it("keeps the day header and room rail sticky and expands rows for overlaps", () => {
    render(
      <TimelineView
        startDate={new Date("2026-04-09T00:00:00.000Z")}
        endDate={new Date("2026-04-10T00:00:00.000Z")}
        days={[new Date("2026-04-09T00:00:00.000Z")]}
        rooms={[
          {
            id: "room-1",
            room_number: "101",
            type: "Deluxe",
            bookings: [
              {
                id: "booking-1",
                check_in_date: "2026-04-09T01:00:00.000Z",
                check_out_date: "2026-04-09T06:00:00.000Z",
                status: "Confirmed",
                num_adults: 2,
                guests: { full_name: "Guest One" },
              },
              {
                id: "booking-2",
                check_in_date: "2026-04-09T03:00:00.000Z",
                check_out_date: "2026-04-09T07:00:00.000Z",
                status: "Confirmed",
                num_adults: 2,
                guests: { full_name: "Guest Two" },
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByTestId("timeline-board")).toHaveStyle({ minWidth: "364px" });
    expect(screen.getByTestId("timeline-day-header").className).toContain("sticky");
    expect(screen.getByTestId("timeline-day-header").className).toContain("bg-white");
    expect(screen.getByTestId("timeline-room-rail-room-1").className).toContain("sticky");
    expect(screen.getByTestId("timeline-room-row-room-1").className).not.toContain("overflow-hidden");
    expect(screen.getByTestId("timeline-room-row-room-1")).toHaveStyle({ minHeight: "104px" });
    expect(screen.getByTestId("timeline-row-body-room-1").className).toContain("overflow-hidden");
    expect(screen.getByTestId("timeline-booking-booking-1")).toHaveStyle({ top: "14px" });
    expect(screen.getByTestId("timeline-booking-booking-2")).toHaveStyle({ top: "52px" });
  });
});
