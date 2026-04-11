import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtendStayModal } from "./ExtendStayModal";

describe("ExtendStayModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const props = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    token: "token",
    booking: {
      id: "booking-1",
      room_id: "room-207",
      check_out_date: "2026-04-09T12:00:00.000Z",
      reserved_checkout_datetime: "2026-04-09T12:00:00.000Z",
      rate_plan_kind: "24h",
      rooms: {
        rate_24h_price: 2380,
        rate_24h_late_checkout_fee: 120,
      },
    },
  };

  async function flushAvailability() {
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
  }

  it("shows checking state while the availability request is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})) as any,
    );

    render(<ExtendStayModal {...props} />);

    expect(screen.getByText(/checking room availability/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm extension/i })).toBeDisabled();
  });

  it("shows conflict details and disables the CTA when the room is blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          available: false,
          conflict_count: 1,
          first_conflict_start: "2026-04-11T06:00:00.000Z",
          conflict_reference: "REF-207",
        }),
      })) as any,
    );

    render(<ExtendStayModal {...props} />);
    await flushAvailability();

    expect(screen.getByText(/first conflict starts/i)).toBeInTheDocument();
    expect(screen.getByText(/conflict detected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cannot extend/i })).toBeDisabled();
  });

  it("uses the room late check-out fee as the hourly extension rate", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})) as any,
    );

    render(<ExtendStayModal {...props} />);

    expect(screen.getByText("₱120")).toBeInTheDocument();
    expect(screen.getByText("₱360")).toBeInTheDocument();
  });

  it("refreshes stale conflict state when the duration changes and enables submit on availability", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: false,
          conflict_count: 1,
          first_conflict_start: "2026-04-11T06:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          conflict_count: 0,
          first_conflict_start: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock as any);

    render(<ExtendStayModal {...props} />);
    await flushAvailability();

    fireEvent.change(screen.getByLabelText(/duration \(hours\)/i), { target: { value: "1" } });

    expect(screen.getByText(/checking room availability/i)).toBeInTheDocument();

    await flushAvailability();

    expect(screen.getByText(/room is available for this extension/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm extension/i })).toBeEnabled();
  });
});
