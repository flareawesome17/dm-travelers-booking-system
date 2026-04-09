import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingAnalyticsStrip } from "./BookingAnalyticsStrip";

const summary = {
  today: "2026-04-09",
  timezone: "Asia/Manila",
  checkedInToday: 4,
  checkedOutToday: 2,
  totalBookings: 36,
  lguBookings: 6,
  specialBookings: 3,
  pendingPayment: 5,
  occupancyPercent: 75,
  availableRoomsToday: 7,
  occupiedRooms: 9,
  activeRooms: 13,
  roomsExcludedFromOccupancy: 1,
};

describe("BookingAnalyticsStrip", () => {
  it("renders the fallback state without affecting the bookings table", () => {
    render(
      <BookingAnalyticsStrip
        summary={null}
        loading={false}
        error
        onCardClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/booking analytics are temporarily unavailable/i)).toBeInTheDocument();
  });

  it("emits quick-filter card clicks and leaves informational cards non-clickable", () => {
    const onCardClick = vi.fn();

    render(
      <BookingAnalyticsStrip
        summary={summary}
        loading={false}
        error={false}
        onCardClick={onCardClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /filter by checked-in today/i }));

    expect(onCardClick).toHaveBeenCalledWith("checkedInToday");
    expect(screen.queryByRole("button", { name: /filter by occupancy/i })).not.toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("keeps the card layout visible while loading", () => {
    render(
      <BookingAnalyticsStrip
        summary={null}
        loading
        error={false}
        onCardClick={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(6);
  });
});
