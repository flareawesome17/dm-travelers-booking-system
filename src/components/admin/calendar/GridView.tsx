"use client";

import { useMemo, useState } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth, parseISO, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Crown, MoreHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export function GridView({ rooms, currentMonth, onBookingClick }: GridViewProps) {
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

  // Generate a flat list of all bookings with their room context
  const allBookings = useMemo(() => {
    return rooms.flatMap(room => 
      room.bookings.map(booking => ({ ...booking, room }))
    );
  }, [rooms]);

  // Generate the days to show for the 6-week month grid
  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfDay(monthStart); // Normally would pad to Sunday, keeping it simple
    // Find the first Sunday
    const startOffset = startDate.getDay();
    const gridStart = new Date(startDate);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41); // 6 weeks * 7 days - 1
    
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const getStatusColor = (booking: Booking) => {
    const isCheckedOut = booking.status === "Checked Out" || booking.status === "Checked-Out";
    if (isCheckedOut) return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-dashed border-rose-300 dark:border-rose-700 opacity-80";
    if (booking.is_lgu_booking) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (booking.is_special_booking) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
  };

  const getDayBookings = (day: Date) => {
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);
    return allBookings.filter(b => {
      const bStart = new Date(b.actual_check_in || b.check_in_date);
      const bEnd = new Date(b.actual_check_out || b.check_out_date || b.check_in_date);
      return bStart <= dEnd && bEnd >= dStart;
    });
  };

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm relative h-full">
      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-20">
        {WEEKDAYS.map((day) => (
          <div key={day} className="p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 min-h-[600px] bg-slate-100 dark:bg-slate-800/50 gap-[1px]">
        {daysInGrid.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const dayBookings = getDayBookings(day);
          const displayLimit = 4;

          return (
            <div 
              key={i} 
              className={cn(
                "bg-white dark:bg-slate-900 p-2 flex flex-col gap-1 overflow-hidden",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                 <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday ? "bg-[#07008A] text-white" : "text-slate-700 dark:text-slate-300"
                 )}>
                   {format(day, "d")}
                 </span>
                 {dayBookings.length > 0 && (
                   <span className="text-[10px] text-slate-400 font-medium">{dayBookings.length} bkg</span>
                 )}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                {dayBookings.slice(0, displayLimit).map(booking => (
                   <button
                     key={booking.id}
                     onClick={() => onBookingClick?.(booking, booking.room)}
                     onMouseEnter={() => setHoveredBooking(booking.id)}
                     onMouseLeave={() => setHoveredBooking(null)}
                     className={cn(
                       "w-full text-left text-[10px] sm:text-xs truncate px-1.5 py-1 rounded transition-colors group flex flex-col gap-0.5",
                       getStatusColor(booking),
                       hoveredBooking === booking.id && "ring-1 ring-black/10 dark:ring-white/20",
                       booking.status === "Checked Out" && "opacity-75 border border-dashed border-rose-300"
                     )}
                   >
                     <div className="flex items-center gap-1 w-full overflow-hidden">
                       <span className="font-bold opacity-70 shrink-0">Rm {booking.room.room_number}:</span>
                       <span className="truncate">{booking.guests?.full_name || "Guest"}</span>
                       {booking.is_special_booking && <Crown className="h-3 w-3 shrink-0 opacity-70 ml-auto" />}
                     </div>
                     <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 truncate">
                        {booking.status}
                     </span>
                   </button>
                ))}
                {dayBookings.length > displayLimit && (
                   <div className="text-[10px] text-center text-slate-500 font-medium py-0.5 flex items-center justify-center gap-1">
                     <MoreHorizontal className="h-3 w-3" />
                     {dayBookings.length - displayLimit} more
                   </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
