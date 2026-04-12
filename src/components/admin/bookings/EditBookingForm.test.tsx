import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditBookingForm } from "./EditBookingForm";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

const booking = {
  id: "booking-1",
  status: "Confirmed",
  room_id: "room-105",
  rate_plan_kind: "24h",
  check_in_date: "2026-04-12",
  check_out_date: "2026-04-13",
  special_requests: "",
  deposit_paid: 500,
  total_amount: 1800,
  balance_due: 1300,
  restaurant_charges_total: 0,
  extras_total: 0,
  extensions_total: 0,
  early_checkin_fee_applied: 0,
  late_checkout_fee_applied: 0,
  is_lgu_booking: false,
  is_special_booking: false,
  special_booking_label: null,
  num_adults: 2,
  num_children: 0,
  discount_value: 0,
  discount_type: "fixed",
  discount_amount: 0,
  discount_id: null,
  cheque_number: null,
  guests: {
    id: "guest-1",
    full_name: "Lucky Webon",
    email: "lucky@example.com",
    phone_number: "09123456789",
  },
};

const rooms = [
  {
    id: "room-105",
    room_number: "105",
    name: "Deluxe",
    room_type: "Deluxe",
    capacity: 2,
    status: "Occupied",
    is_active: true,
    rate_24h_enabled: true,
    rate_24h_price: 1800,
  },
  {
    id: "room-103",
    room_number: "103",
    name: "Suite",
    room_type: "Suite",
    capacity: 2,
    status: "Available",
    is_active: true,
    rate_24h_enabled: true,
    rate_24h_price: 2100,
  },
];

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function getRoomSelect() {
  const select = screen
    .getAllByRole("combobox")
    .find((element) => Array.from((element as HTMLSelectElement).options).some((option) => option.value === "room-103"));

  if (!select) {
    throw new Error("Room select not found");
  }

  return select as HTMLSelectElement;
}

function setupFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/api/rooms")) {
      return jsonResponse(rooms);
    }

    if (url.includes("/api/rooms/") && url.endsWith("/availability")) {
      return jsonResponse([]);
    }

    if (url.endsWith("/api/bookings/booking-1/transfer-room")) {
      return jsonResponse({
        id: "booking-1",
        room_id: "room-103",
        transfer: {
          ok: true,
          old_room_number: "105",
          new_room_number: "103",
        },
      });
    }

    if (url.endsWith("/api/bookings/booking-1")) {
      return jsonResponse({
        id: "booking-1",
        room_id: "room-105",
      });
    }

    throw new Error(`Unexpected fetch call: ${init?.method ?? "GET"} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock as typeof fetch);
  return fetchMock;
}

describe("EditBookingForm", () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("switches the primary action from Update to Transfer Room when the room changes", async () => {
    setupFetchMock();

    render(
      <EditBookingForm
        apiUrl=""
        token="token"
        booking={booking}
        onSuccess={() => {}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(getRoomSelect(), { target: { value: "room-103" } });
    });

    expect(screen.getByRole("button", { name: "Transfer Room" })).toBeInTheDocument();
    expect(screen.getByText(/room transfer detected/i)).toBeInTheDocument();
  });

  it("submits the normal booking patch when the room is unchanged", async () => {
    const fetchMock = setupFetchMock();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <EditBookingForm
        apiUrl=""
        token="token"
        booking={booking}
        onSuccess={onSuccess}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bookings/booking-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("submits the dedicated transfer endpoint when the room changes", async () => {
    const fetchMock = setupFetchMock();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <EditBookingForm
        apiUrl=""
        token="token"
        booking={booking}
        onSuccess={onSuccess}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(getRoomSelect(), { target: { value: "room-103" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer Room" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bookings/booking-1/transfer-room",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/bookings/booking-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
