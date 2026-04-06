"use client";

import { useMemo, useState } from "react";
import { format, differenceInMinutes, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { BedDouble, User, Crown, Info } from "lucide-react";

type Booking = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: string;
  num_adults: number;
  is_lgu_booking?: boolean;
  is_special_booking?: boolean;
  guests?: {
    full_name: string;
    contact_number?: string;
  };
};

type Room = {
  id: string;
  room_number: string;
  type: string;
  bookings: Booking[];
};

type TimelineViewProps = {
  rooms: Room[];
  startDate: Date;
  endDate: Date;
  days: Date[];
  onBookingClick?: (booking: Booking) => void;
};

export function TimelineView({ rooms, startDate, endDate, days, onBookingClick }: TimelineViewProps) {
  const totalMinutes = useMemo(() => differenceInMinutes(endDate, startDate), [startDate, endDate]);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  const getBookingStyle = (booking: Booking) => {
    const bookingStart = new Date(booking.actual_check_in || booking.check_in_date);
    const bookingEnd = new Date(booking.actual_check_out || booking.check_out_date || new Date().toISOString());

    // Clamp to viewport
    const effectiveStart = bookingStart < startDate ? startDate : bookingStart;
    const effectiveEnd = bookingEnd > endDate ? endDate : bookingEnd;

    const leftMinutes = differenceInMinutes(effectiveStart, startDate);
    const widthMinutes = differenceInMinutes(effectiveEnd, effectiveStart);

    const leftPercent = Math.max(0, (leftMinutes / totalMinutes) * 100);
    const widthPercent = Math.min(100 - leftPercent, (widthMinutes / totalMinutes) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(0.5, widthPercent)}%`, // At least 0.5% width to be visible
    };
  };

  const getStatusColor = (booking: Booking) => {
    if (booking.status === "Checked Out" || booking.status === "Checked-Out") return "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-900/40 dark:border-rose-700 dark:text-rose-300";
    if (booking.is_lgu_booking) return "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
    if (booking.is_special_booking) return "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]";
    return "bg-[#07008A]/10 border-[#07008A]/30 text-[#07008A] dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300 shadow-[0_0_8px_rgba(7,0,138,0.1)]";
  };

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm relative">
      {/* Header Row (Days) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-20">
        <div className="w-40 shrink-0 border-r border-slate-200 dark:border-slate-800 p-4 font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-center bg-slate-50 dark:bg-slate-900/80 z-30 sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
          Rooms
        </div>
        <div className="flex-1 relative flex text-sm text-slate-600 dark:text-slate-400 font-medium">
          {days.map((day, idx) => (
            <div 
              key={idx} 
              className={cn(
                "flex-1 border-r border-slate-100 dark:border-slate-800/50 p-3 text-center transition-colors min-w-[120px]",
                isSameDay(day, new Date()) && "bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 font-bold"
              )}
            >
              <div className="text-[11px] uppercase tracking-wider opacity-60 mb-0.5">{format(day, "MMM")}</div>
              <div className="text-base">{format(day, "dd")}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{format(day, "EEE")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Room Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {rooms.map((room) => (
          <div key={room.id} className="flex border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group relative">
            {/* Room Axis (Sticky Left) */}
            <div className="w-40 shrink-0 border-r border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 z-10 sticky left-0 flex items-center gap-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-[#07008A]/5 dark:bg-indigo-900/40 text-[#07008A] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BedDouble className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">Rm {room.room_number}</p>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest truncate">{room.type}</p>
              </div>
            </div>

            {/* Timeline Axis */}
            <div className="flex-1 relative flex min-w-[120px]">
              {/* Vertical Grid Lines */}
              {days.map((day, idx) => (
                <div 
                  key={`line-${idx}`} 
                  className={cn(
                    "flex-1 border-r border-slate-100 dark:border-slate-800/50 pb-16 min-w-[120px]",
                    isSameDay(day, new Date()) && "bg-blue-50/20 dark:bg-blue-900/5"
                  )} 
                />
              ))}

              {/* Booking Blocks */}
              {room.bookings.map((booking) => {
                const style = getBookingStyle(booking);
                const isHovered = hoveredBlock === booking.id;
                // Determine if booking is entirely out of current view
                const bookingStart = new Date(booking.actual_check_in || booking.check_in_date);
                const bookingEnd = new Date(booking.actual_check_out || booking.check_out_date || new Date().toISOString());
                if (bookingEnd <= startDate || bookingStart >= endDate) return null;

                const isCheckedOut = booking.status === "Checked Out" || booking.status === "Checked-Out";
                
                return (
                  <div
                    key={booking.id}
                    className="absolute top-2 bottom-2 pt-1 pb-1 z-10"
                    style={style}
                    onMouseEnter={() => setHoveredBlock(booking.id)}
                    onMouseLeave={() => setHoveredBlock(null)}
                  >
                    <button
                      onClick={() => onBookingClick?.(booking)}
                      className={cn(
                        "w-full h-full rounded-md border py-1.5 px-2 flex flex-col justify-center overflow-hidden transition-all text-left group/btn relative",
                        getStatusColor(booking),
                        isHovered ? "ring-2 ring-indigo-400 ring-offset-1 z-20 scale-[1.02]" : "active:scale-95",
                        isCheckedOut && "opacity-80 border-dashed"
                      )}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                         {booking.is_special_booking && <Crown className="h-3 w-3 shrink-0" />}
                         <p className="font-bold text-xs truncate leading-none">
                           {booking.guests?.full_name || "Guest"}
                         </p>
                      </div>
                      
                      {/* Hide details if block is too narrow (e.g., width < 5%) */}
                      {parseFloat(style.width) > 5 && (
                        <div className="mt-1 flex items-center gap-1">
                          <p className="text-[10px] font-semibold uppercase opacity-80 leading-none">
                            {booking.status}
                          </p>
                          <span className="text-[10px] opacity-70 truncate leading-none">
                            • {format(bookingStart, "MMM d, HH:mm")}
                          </span>
                        </div>
                      )}
                    </button>
                    
                    {/* Hover tooltip (inline) */}
                    {isHovered && parseFloat(style.width) <= 5 && (
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-[100] shadow-lg pointer-events-none fade-in flex flex-col gap-0.5">
                        <span className="font-bold">{booking.guests?.full_name}</span>
                        <span className="opacity-80 text-[9px] uppercase">{booking.status}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>No rooms available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
