type NullableNumber = number | string | null | undefined;

export type ExtensionPricingRoom = {
  rate_24h_price?: NullableNumber;
  rate_12h_price?: NullableNumber;
  rate_5h_price?: NullableNumber;
  rate_3h_price?: NullableNumber;
  rate_24h_late_checkout_fee?: NullableNumber;
  rate_12h_late_checkout_fee?: NullableNumber;
  rate_5h_late_checkout_fee?: NullableNumber;
  rate_3h_late_checkout_fee?: NullableNumber;
  lgu_rate_enabled?: boolean | null;
  lgu_rate_24h_price?: NullableNumber;
  lgu_rate_12h_price?: NullableNumber;
  lgu_rate_5h_price?: NullableNumber;
  lgu_rate_3h_price?: NullableNumber;
};

function toPositiveNumber(value: NullableNumber) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getBaseHourlyRate(room: ExtensionPricingRoom, ratePlanKind?: string, isLguBooking?: boolean) {
  const useLgu = Boolean(isLguBooking && room.lgu_rate_enabled);
  const r24 = toPositiveNumber(useLgu ? room.lgu_rate_24h_price ?? room.rate_24h_price : room.rate_24h_price);
  const r12 = toPositiveNumber(useLgu ? room.lgu_rate_12h_price ?? room.rate_12h_price : room.rate_12h_price);
  const r5 = toPositiveNumber(useLgu ? room.lgu_rate_5h_price ?? room.rate_5h_price : room.rate_5h_price);
  const r3 = toPositiveNumber(useLgu ? room.lgu_rate_3h_price ?? room.rate_3h_price : room.rate_3h_price);

  if (ratePlanKind === "3h" && r3 > 0) return r3 / 3;
  if (ratePlanKind === "5h" && r5 > 0) return r5 / 5;
  if (ratePlanKind === "12h" && r12 > 0) return r12 / 12;
  if (r24 > 0) return r24 / 24;
  if (r12 > 0) return r12 / 12;
  if (r5 > 0) return r5 / 5;
  if (r3 > 0) return r3 / 3;
  return 0;
}

export function getHourlyExtensionRate(room: ExtensionPricingRoom, ratePlanKind?: string) {
  const late24 = toPositiveNumber(room.rate_24h_late_checkout_fee);
  const late12 = toPositiveNumber(room.rate_12h_late_checkout_fee);
  const late5 = toPositiveNumber(room.rate_5h_late_checkout_fee);
  const late3 = toPositiveNumber(room.rate_3h_late_checkout_fee);

  if (ratePlanKind === "24h") return late24;
  if (ratePlanKind === "12h") return late12;
  if (ratePlanKind === "5h") return late5;
  if (ratePlanKind === "3h") return late3;

  if (late24 > 0) return late24;
  if (late12 > 0) return late12;
  if (late5 > 0) return late5;
  if (late3 > 0) return late3;
  return 0;
}

export function getDailyExtensionRate(room: ExtensionPricingRoom, ratePlanKind?: string, isLguBooking?: boolean) {
  const useLgu = Boolean(isLguBooking && room.lgu_rate_enabled);
  const daily24 = toPositiveNumber(useLgu ? room.lgu_rate_24h_price ?? room.rate_24h_price : room.rate_24h_price);

  if (daily24 > 0) return daily24;

  const baseHourlyRate = getBaseHourlyRate(room, ratePlanKind, isLguBooking);
  return baseHourlyRate > 0 ? baseHourlyRate * 24 : 0;
}

export function getExtensionCost(args: {
  room: ExtensionPricingRoom | null | undefined;
  ratePlanKind?: string;
  isLguBooking?: boolean;
  durationType: "hours" | "days";
  durationValue: number;
}) {
  const room = args.room;
  if (!room) {
    return { hourlyRate: 0, dailyRate: 0, additionalCost: 0 };
  }

  const hourlyRate = getHourlyExtensionRate(room, args.ratePlanKind);
  const dailyRate = getDailyExtensionRate(room, args.ratePlanKind, args.isLguBooking);
  const durationValue = Number.isFinite(args.durationValue) ? Math.max(0, args.durationValue) : 0;
  const additionalCost = args.durationType === "hours" ? hourlyRate * durationValue : dailyRate * durationValue;

  return { hourlyRate, dailyRate, additionalCost };
}
