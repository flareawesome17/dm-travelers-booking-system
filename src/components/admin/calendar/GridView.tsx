"use client";

import { useMemo, useState } from "react";
import { format, eachDayOfInterval, endOfDay, endOfMonth, isSameDay, isSameMonth, startOfDay, startOfMonth } from "date-fns";
import { Crown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Booking = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: string;
  room_id: string;
  is_lgu_booking?: boolean;
  is_special_booking?: boolean;
  guests?: {
    full_name: string;
  };
};

type Room = {
  id: string;
  room_number: string;
  type: string;
  bookings: Booking[];
};

type GridViewProps = {
  rooms: Room[];
  currentMonth: Date;
  onBookingClick?: (booking: Booking, room: Room) => void;
};

const DISPLAY_LIMIT = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getBookingTone(booking: Booking) {
  const isCheckedOut = booking.status === "Checked Out" || booking.status === "Checked-Out";
  if (isCheckedOut) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (booking.is_lgu_booking) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (booking.is_special_booking) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-[#07008A]/10 bg-[#07008A]/[0.06] text-[#07008A]";
}

export function GridView({ rooms, currentMonth, onBookingClick }: GridViewProps) {
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

  const allBookings = useMemo(() => {
    return rooms.flatMap((room) => room.bookings.map((booking) => ({ ...booking, room })));
  }, [rooms]);

  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfDay(monthStart);
    const startOffset = startDate.getDay();
    const gridStart = new Date(startDate);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41);

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const getDayBookings = (day: Date) => {
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);

    return allBookings
      .filter((booking) => {
        const bookingStart = new Date(booking.actual_check_in || booking.check_in_date);
        const bookingEnd = new Date(booking.actual_check_out || booking.check_out_date || booking.check_in_date);
        return bookingStart <= dEnd && bookingEnd >= dStart;
      })
      .sort((a, b) => {
        const first = new Date(a.actual_check_in || a.check_in_date).getTime();
        const second = new Date(b.actual_check_in || b.check_in_date).getTime();
        return first - second;
      });
  };

  return (
    <div className="overflow-visible rounded-[26px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/88">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-3 py-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <span className="md:hidden">{day[0]}</span>
            <span className="hidden md:block">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200/80">
        {daysInGrid.map((day) => {
          const dayBookings = getDayBookings(day);
          const visibleBookings = dayBookings.slice(0, DISPLAY_LIMIT);
          const hiddenBookings = dayBookings.slice(DISPLAY_LIMIT);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-[180px] flex-col bg-white p-3 align-top",
                !isCurrentMonth && "bg-slate-50/60",
                isToday && "bg-[#07008A]/[0.035]",
              )}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400", isToday && "text-[#07008A]/60")}>
                    {format(day, "MMM")}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        isToday ? "bg-[#07008A] text-white shadow-lg shadow-[#07008A]/20" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">{format(day, "EEE")}</span>
                  </div>
                </div>

                {dayBookings.length > 0 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {dayBookings.length} booking{dayBookings.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {visibleBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onBookingClick?.(booking, booking.room)}
                    onMouseEnter={() => setHoveredBooking(booking.id)}
                    onMouseLeave={() => setHoveredBooking(null)}
                    className={cn(
                      "rounded-2xl border px-2.5 py-2 text-left transition-all duration-150",
                      getBookingTone(booking),
                      hoveredBooking === booking.id && "ring-2 ring-[#07008A]/10",
                    )}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-current">
                        Rm {booking.room.room_number}
                      </span>
                      {booking.is_special_booking ? <Crown className="h-3 w-3 shrink-0 opacity-70" /> : null}
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold">{booking.guests?.full_name || "Guest"}</p>
                    <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wider opacity-70">{booking.status}</p>
                  </button>
                ))}

                {hiddenBookings.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        +{hiddenBookings.length} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 rounded-2xl border-slate-200 p-3 shadow-xl" align="start">
                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{format(day, "MMMM d")}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">More bookings for this day</p>
                      </div>
                      <div className="space-y-2">
                        {hiddenBookings.map((booking) => (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => onBookingClick?.(booking, booking.room)}
                            className={cn(
                              "w-full rounded-2xl border px-3 py-2 text-left transition-colors hover:bg-slate-50",
                              getBookingTone(booking),
                            )}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Rm {booking.room.room_number}</p>
                            <p className="mt-1 text-sm font-semibold">{booking.guests?.full_name || "Guest"}</p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider opacity-70">{booking.status}</p>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="mt-auto" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
