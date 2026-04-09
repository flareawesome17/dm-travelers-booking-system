import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsProvider } from "@/context/PermissionsContext";
import CalendarPage from "./page";

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.setItem("admin_token", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [],
      })) as any,
    );
  });

  it("renders a sticky calendar toolbar", async () => {
    render(
      <PermissionsProvider permissions={["bookings.calendar", "bookings.update"]}>
        <CalendarPage />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.getByTestId("calendar-toolbar").className).toContain("sticky");
    expect(screen.getByText("Front Desk Board")).toBeInTheDocument();
  });
});
