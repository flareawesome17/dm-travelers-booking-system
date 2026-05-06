import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsProvider } from "@/context/PermissionsContext";
import OtherServicesPage from "./page";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("OtherServicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/other-services") {
        return {
          ok: true,
          json: async () => ({
            service_types: [
              {
                id: "type-1",
                code: "parking",
                name: "Parking Fee",
                rate_amount: 10,
                unit_label: "day",
                unit_description: "PHP 10 per day",
                is_active: true,
              },
              {
                id: "type-2",
                code: "laundry",
                name: "Laundry Charge",
                rate_amount: 250,
                unit_label: "load",
                unit_description: "PHP 250 per load up to 5 kilos",
                is_active: true,
              },
            ],
            records: [{
              id: "record-1",
              service_name: "Laundry Charge",
              unit_label: "load",
              unit_rate: 250,
              quantity: 1,
              total_amount: 250,
              payment_method: "GCash",
              payment_reference: "GC-123",
              customer_name: "Guest A",
              room_number: "101",
              note: "One load",
              accounting_date: "2026-05-06",
              created_at: "2026-05-06T02:00:00.000Z",
              recorded_by_name: "Front Desk A",
            }],
            summary: {
              total_revenue: 250,
              transaction_count: 1,
              by_service: { "Laundry Charge": 250 },
              by_method: { GCash: 250 },
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));
  });

  it("loads service rates, summary, and recent records", async () => {
    render(
      <PermissionsProvider permissions={["other_services.read", "other_services.create", "other_services.manage"]}>
        <OtherServicesPage />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Other Services")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Service Revenue").length).toBeGreaterThan(0);
    expect(screen.getByText("Parking Fee")).toBeInTheDocument();
    expect(screen.getAllByText("Laundry Charge").length).toBeGreaterThan(0);
    expect(screen.getByText("Guest A - Room 101")).toBeInTheDocument();
    expect(screen.getByText("Record Service")).toBeInTheDocument();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });
});
