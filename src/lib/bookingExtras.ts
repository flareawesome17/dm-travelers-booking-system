export const PREDEFINED_BOOKING_EXTRA_TYPES = [
  "Extra Bed",
  "Extra Pillow",
  "Extra Blanket",
  "Extra Towel - Bath",
  "Extra Towel - Hand",
  "Extra Person",
] as const;

export const CUSTOM_BOOKING_EXTRA_TYPE = "Custom Charge" as const;

export const BOOKING_EXTRA_TYPES = [
  ...PREDEFINED_BOOKING_EXTRA_TYPES,
  CUSTOM_BOOKING_EXTRA_TYPE,
] as const;

export type PredefinedBookingExtraType = (typeof PREDEFINED_BOOKING_EXTRA_TYPES)[number];
export type BookingExtraType = (typeof BOOKING_EXTRA_TYPES)[number];

export type BookingExtraLike = {
  extra_type?: string | null;
  custom_label?: string | null;
};

const LINENS_EXTRA_TYPES = new Set([
  "extra pillow",
  "extra blanket",
  "extra towel",
  "extra towel - bath",
  "extra towel - hand",
]);

function normalizeExtraType(extraType: string | null | undefined) {
  return String(extraType || "").trim().toLowerCase();
}

export function isCustomBookingExtraType(extraType: string | null | undefined) {
  return normalizeExtraType(extraType) === "custom charge";
}

export function getBookingExtraBucket(extraType: string | null | undefined) {
  const normalizedType = normalizeExtraType(extraType);

  if (normalizedType === "extra bed") return "bed";
  if (normalizedType === "extra person") return "person";
  if (LINENS_EXTRA_TYPES.has(normalizedType)) return "linens";
  return "charge";
}

export function getBookingExtraDisplayName(extra: BookingExtraLike) {
  if (isCustomBookingExtraType(extra.extra_type)) {
    const customLabel = String(extra.custom_label || "").trim();
    if (customLabel) return customLabel;
  }

  return String(extra.extra_type || "").trim() || "Extra Charge";
}
