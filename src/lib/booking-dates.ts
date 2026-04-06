import { addHours } from "date-fns";

/**
 * Computes the reserved check-in and check-out datetimes based on the simplified date strings.
 * Defaults are 14:00 for check-in and 12:00 for check-out (Manila time).
 * 
 * @param checkIn YYYY-MM-DD
 * @param checkOut YYYY-MM-DD
 * @param ratePlan e.g. "24h", "12h", "5h", "3h"
 * @param actualCheckIn Optional ISO string of actual check-in for hourly plans
 * @param tzOffset Optional suffix e.g. "+08:00"
 */
export function computeReservedDatetimes(
  checkIn: string,
  checkOut: string,
  ratePlan = "24h",
  actualCheckIn?: string | null,
  tzOffset = "+08:00"
) {
  // Base check-in at 2:00 PM (14:00)
  const cinDate = checkIn.slice(0, 10);
  const reservedCheckin = `${cinDate}T14:00:00${tzOffset}`;

  // Base check-out at 12:00 PM (12:00)
  const coutDate = checkOut.slice(0, 10);
  let reservedCheckout = `${coutDate}T12:00:00${tzOffset}`;

  // For hourly rate plans, checkout might be relative to check-in
  if (ratePlan !== "24h") {
    const hours = parseInt(ratePlan.replace(/\D/g, ""), 10) || 0;
    if (hours > 0) {
      const reference = actualCheckIn ? new Date(actualCheckIn) : new Date(reservedCheckin);
      if (!isNaN(reference.getTime())) {
        reservedCheckout = addHours(reference, hours).toISOString();
      }
    }
  }

  return { reservedCheckin, reservedCheckout };
}
