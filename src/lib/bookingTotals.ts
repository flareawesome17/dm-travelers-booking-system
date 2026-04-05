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

export function toMoneyNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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
      roomTotal +
      restaurantTotal +
      extrasTotal +
      extensionsTotal +
      earlyCheckInFee +
      lateCheckOutFee,
  };
}

export function getBookingTotalPaid(booking: BookingFinancialFields) {
  const { grandTotal } = getBookingChargeBreakdown(booking);
  const balanceDue = toMoneyNumber(booking.balance_due);
  return Math.max(0, grandTotal - balanceDue);
}
