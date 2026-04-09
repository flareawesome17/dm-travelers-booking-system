import { differenceInMinutes } from "date-fns";

export type CalendarBookingLike = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  actual_check_in?: string | null;
  actual_check_out?: string | null;
};

export type PackedTimelineBooking<T extends CalendarBookingLike = CalendarBookingLike> = {
  booking: T;
  bookingStart: Date;
  bookingEnd: Date;
  effectiveStart: Date;
  effectiveEnd: Date;
  lane: number;
  laneCount: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  leftPercent: number;
  widthPercent: number;
};

function resolveBookingStart<T extends CalendarBookingLike>(booking: T) {
  return new Date(booking.actual_check_in || booking.check_in_date);
}

function resolveBookingEnd<T extends CalendarBookingLike>(booking: T) {
  const rawEnd = booking.actual_check_out || booking.check_out_date || booking.check_in_date;
  const end = new Date(rawEnd);
  return Number.isNaN(end.getTime()) ? new Date(booking.check_in_date) : end;
}

export function packTimelineBookings<T extends CalendarBookingLike>(
  bookings: T[],
  viewStart: Date,
  viewEnd: Date,
): PackedTimelineBooking<T>[] {
  const totalMinutes = Math.max(1, differenceInMinutes(viewEnd, viewStart));

  const visibleBookings = bookings
    .map((booking) => {
      const bookingStart = resolveBookingStart(booking);
      let bookingEnd = resolveBookingEnd(booking);

      if (!Number.isFinite(bookingStart.getTime())) return null;
      if (!Number.isFinite(bookingEnd.getTime()) || bookingEnd <= bookingStart) {
        bookingEnd = new Date(bookingStart.getTime() + 30 * 60 * 1000);
      }

      if (bookingEnd <= viewStart || bookingStart >= viewEnd) return null;

      const effectiveStart = bookingStart < viewStart ? viewStart : bookingStart;
      const effectiveEnd = bookingEnd > viewEnd ? viewEnd : bookingEnd;
      const leftMinutes = Math.max(0, differenceInMinutes(effectiveStart, viewStart));
      const widthMinutes = Math.max(30, differenceInMinutes(effectiveEnd, effectiveStart));
      const leftPercent = (leftMinutes / totalMinutes) * 100;
      const widthPercent = Math.min(100 - leftPercent, (widthMinutes / totalMinutes) * 100);

      return {
        booking,
        bookingStart,
        bookingEnd,
        effectiveStart,
        effectiveEnd,
        clippedStart: bookingStart < viewStart,
        clippedEnd: bookingEnd > viewEnd,
        leftPercent: Math.max(0, leftPercent),
        widthPercent: Math.max(1.5, widthPercent),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      const startDelta = a.effectiveStart.getTime() - b.effectiveStart.getTime();
      if (startDelta !== 0) return startDelta;
      return a.bookingEnd.getTime() - b.bookingEnd.getTime();
    }) as Array<
    Omit<PackedTimelineBooking<T>, "lane" | "laneCount">
  >;

  const laneEnds: Date[] = [];
  const packed = visibleBookings.map((item) => {
    let lane = 0;
    while (lane < laneEnds.length && item.effectiveStart < laneEnds[lane]) {
      lane += 1;
    }

    laneEnds[lane] = item.effectiveEnd;

    return {
      ...item,
      lane,
      laneCount: 1,
    };
  });

  const laneCount = Math.max(1, laneEnds.length);
  return packed.map((item) => ({ ...item, laneCount }));
}
