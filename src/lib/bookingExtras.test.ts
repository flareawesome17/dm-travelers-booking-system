import { describe, expect, it } from "vitest";
import {
  getBookingExtraBucket,
  getBookingExtraDisplayName,
  isCustomBookingExtraType,
} from "./bookingExtras";

describe("bookingExtras helpers", () => {
  it("maps the live towel and linen extras into the linens bucket", () => {
    expect(getBookingExtraBucket("Extra Pillow")).toBe("linens");
    expect(getBookingExtraBucket("Extra Blanket")).toBe("linens");
    expect(getBookingExtraBucket("Extra Towel")).toBe("linens");
    expect(getBookingExtraBucket("Extra Towel - Bath")).toBe("linens");
    expect(getBookingExtraBucket("Extra Towel - Hand")).toBe("linens");
  });

  it("keeps extra person and custom charges in their own buckets", () => {
    expect(getBookingExtraBucket("Extra Person")).toBe("person");
    expect(getBookingExtraBucket("Custom Charge")).toBe("charge");
    expect(isCustomBookingExtraType("Custom Charge")).toBe(true);
  });

  it("prefers the custom label when displaying custom booking charges", () => {
    expect(getBookingExtraDisplayName({
      extra_type: "Custom Charge",
      custom_label: "Broken glass",
    })).toBe("Broken glass");

    expect(getBookingExtraDisplayName({
      extra_type: "Extra Bed",
      custom_label: "Should not be used",
    })).toBe("Extra Bed");
  });
});
