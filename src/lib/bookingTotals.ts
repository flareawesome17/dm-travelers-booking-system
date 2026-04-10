export type BookingFinancialFields = Partial<{
  total_amount: number | string | null;
  restaurant_charges_total: number | string | null;
  extras_total: number | string | null;
  extensions_total: number | string | null;
  early_checkin_fee_applied: number | string | null;
  late_checkout_fee_applied: number | string | null;
  discount_amount: number | string | null;
  deposit_paid: number | string | null;
  balance_due: number | string | null;
}>;

export type BookingRateRoomFields = Partial<{
  rate_24h_enabled: boolean | null;
  rate_24h_price: number | string | null;
  rate_12h_enabled: boolean | null;
  rate_12h_price: number | string | null;
  rate_5h_enabled: boolean | null;
  rate_5h_price: number | string | null;
  rate_3h_enabled: boolean | null;
  rate_3h_price: number | string | null;
  lgu_rate_enabled: boolean | null;
  lgu_rate_24h_price: number | string | null;
  lgu_rate_12h_price: number | string | null;
  lgu_rate_5h_price: number | string | null;
  lgu_rate_3h_price: number | string | null;
}>;

export function toMoneyNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDateOnly(value: string | null | undefined) {
  const source = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(source);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(source);
}

function getRateValue(
  enabled: boolean | null | undefined,
  price: number | string | null | undefined,
) {
  if (enabled === false) return null;
  if (price == null) return null;

  const numeric = Number(price);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getBookingRateForRoom(
  room: BookingRateRoomFields | null | undefined,
  ratePlanKind: string | null | undefined,
  isLguBooking: boolean,
) {
  if (!room) return null;

  const normalizedKind = String(ratePlanKind || "24h").trim().toLowerCase();
  const useLguRates = isLguBooking && room.lgu_rate_enabled === true;

  if (normalizedKind === "12h") {
    return useLguRates
      ? getRateValue(room.rate_12h_enabled, room.lgu_rate_12h_price ?? room.rate_12h_price)
      : getRateValue(room.rate_12h_enabled, room.rate_12h_price);
  }

  if (normalizedKind === "5h") {
    return useLguRates
      ? getRateValue(room.rate_5h_enabled, room.lgu_rate_5h_price ?? room.rate_5h_price)
      : getRateValue(room.rate_5h_enabled, room.rate_5h_price);
  }

  if (normalizedKind === "3h") {
    return useLguRates
      ? getRateValue(room.rate_3h_enabled, room.lgu_rate_3h_price ?? room.rate_3h_price)
      : getRateValue(room.rate_3h_enabled, room.rate_3h_price);
  }

  return useLguRates
    ? getRateValue(room.rate_24h_enabled, room.lgu_rate_24h_price ?? room.rate_24h_price)
    : getRateValue(room.rate_24h_enabled, room.rate_24h_price);
}

export function calculateBookingRoomSubtotal(params: {
  room: BookingRateRoomFields | null | undefined;
  ratePlanKind: string | null | undefined;
  checkInDate: string | null | undefined;
  checkOutDate: string | null | undefined;
  isLguBooking: boolean;
}) {
  const rate = getBookingRateForRoom(params.room, params.ratePlanKind, params.isLguBooking);
  if (rate == null) return null;

  const normalizedKind = String(params.ratePlanKind || "24h").trim().toLowerCase();
  const start = parseDateOnly(params.checkInDate);
  const end = parseDateOnly(params.checkOutDate || params.checkInDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return rate;
  }

  const diffHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

  if (normalizedKind === "12h") {
    return rate * Math.max(1, Math.ceil((diffHours || 12) / 12));
  }

  if (normalizedKind === "5h") {
    return rate * Math.max(1, Math.ceil((diffHours || 5) / 5));
  }

  if (normalizedKind === "3h") {
    return rate * Math.max(1, Math.ceil((diffHours || 3) / 3));
  }

  const diffDays = Math.max(0, diffHours / 24);
  return rate * Math.max(1, Math.ceil(diffDays || 1));
}

export function getBookingChargeBreakdown(booking: BookingFinancialFields) {
  const roomTotal = toMoneyNumber(booking.total_amount);
  const restaurantTotal = toMoneyNumber(booking.restaurant_charges_total);
  const extrasTotal = toMoneyNumber(booking.extras_total);
  const extensionsTotal = toMoneyNumber(booking.extensions_total);
  const earlyCheckInFee = toMoneyNumber(booking.early_checkin_fee_applied);
  const lateCheckOutFee = toMoneyNumber(booking.late_checkout_fee_applied);
  const discountAmount = toMoneyNumber(booking.discount_amount);

  return {
    roomTotal,
    restaurantTotal,
    extrasTotal,
    extensionsTotal,
    earlyCheckInFee,
    lateCheckOutFee,
    discountAmount,
    grandTotal:
      Math.round(
        (roomTotal +
          restaurantTotal +
          extrasTotal +
          extensionsTotal +
          earlyCheckInFee +
          lateCheckOutFee) *
          100,
      ) / 100,
  };
}

export function getBookingTotalPaid(booking: BookingFinancialFields) {
  const { grandTotal } = getBookingChargeBreakdown(booking);
  const balanceDue = toMoneyNumber(booking.balance_due);
  return Math.max(0, grandTotal - balanceDue);
}
