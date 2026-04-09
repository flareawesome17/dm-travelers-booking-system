import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GridView } from "./GridView";

describe("GridView", () => {
  it("shows a +N more trigger and reveals hidden bookings in the overflow dialog", () => {
    render(
      <GridView
        currentMonth={new Date("2026-04-01T00:00:00.000Z")}
        rooms={[
          {
            id: "room-1",
            room_number: "101",
            type: "Deluxe",
            bookings: [
              {
                id: "b1",
                room_id: "room-1",
                check_in_date: "2026-04-09T01:00:00.000Z",
                check_out_date: "2026-04-09T02:00:00.000Z",
                status: "Confirmed",
                guests: { full_name: "Visible One" },
              },
              {
                id: "b2",
                room_id: "room-1",
                check_in_date: "2026-04-09T03:00:00.000Z",
                check_out_date: "2026-04-09T04:00:00.000Z",
                status: "Confirmed",
                guests: { full_name: "Visible Two" },
              },
              {
                id: "b3",
                room_id: "room-1",
                check_in_date: "2026-04-09T05:00:00.000Z",
                check_out_date: "2026-04-09T06:00:00.000Z",
                status: "Confirmed",
                guests: { full_name: "Visible Three" },
              },
              {
                id: "b4",
                room_id: "room-1",
                check_in_date: "2026-04-09T07:00:00.000Z",
                check_out_date: "2026-04-09T08:00:00.000Z",
                status: "Confirmed",
                guests: { full_name: "Hidden Booking" },
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /\+1 more/i }));

    expect(screen.getByText("Hidden Booking")).toBeInTheDocument();
    expect(screen.getByText(/april 9, 2026/i)).toBeInTheDocument();
  });
});
