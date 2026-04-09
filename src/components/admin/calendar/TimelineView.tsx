"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { BedDouble, ChevronLeft, ChevronRight, Crown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { packTimelineBookings } from "@/lib/calendarLayout";

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

const ROOM_COLUMN_WIDTH = 224;
const DAY_COLUMN_MIN_WIDTH = 140;
const LANE_HEIGHT = 38;
const ROW_PADDING = 14;

function getStatusTone(booking: Booking) {
  const isCheckedOut = booking.status === "Checked Out" || booking.status === "Checked-Out";
  if (isCheckedOut) {
    return {
      chip: "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_8px_20px_rgba(244,63,94,0.08)]",
      accent: "bg-rose-500/70",
      meta: "text-rose-600",
    };
  }

  if (booking.is_lgu_booking) {
    return {
      chip: "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
      accent: "bg-emerald-500/80",
      meta: "text-emerald-700",
    };
  }

  if (booking.is_special_booking) {
    return {
      chip: "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_8px_24px_rgba(245,158,11,0.12)]",
      accent: "bg-amber-500/80",
      meta: "text-amber-700",
    };
  }

  return {
    chip: "border-[#07008A]/25 bg-[#07008A]/[0.07] text-[#07008A] shadow-[0_10px_28px_rgba(7,0,138,0.12)]",
    accent: "bg-[#07008A]/80",
    meta: "text-[#07008A]/75",
  };
}

export function TimelineView({ rooms, startDate, endDate, days, onBookingClick }: TimelineViewProps) {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  const packedRooms = useMemo(() => {
    return rooms.map((room) => {
      const packedBookings = packTimelineBookings(room.bookings, startDate, endDate);
      const laneCount = Math.max(1, packedBookings[0]?.laneCount || 1);
      const rowHeight = Math.max(78, laneCount * LANE_HEIGHT + ROW_PADDING * 2);

      return {
        ...room,
        packedBookings,
        laneCount,
        rowHeight,
      };
    });
  }, [rooms, startDate, endDate]);

  const timelineWidth = days.length * DAY_COLUMN_MIN_WIDTH;
  const boardMinWidth = ROOM_COLUMN_WIDTH + timelineWidth;

  return (
    <div
      data-testid="timeline-board"
      className="relative isolate min-w-max rounded-[26px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
      style={{ minWidth: boardMinWidth }}
    >
      <div
        data-testid="timeline-day-header"
        className="sticky top-0 z-50 flex rounded-t-[26px] border-b border-slate-200/80 bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]"
      >
        <div
          className="sticky left-0 z-[60] shrink-0 border-r border-slate-200/80 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-4 shadow-[8px_0_24px_-18px_rgba(15,23,42,0.2)]"
          style={{ width: ROOM_COLUMN_WIDTH }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Rooms</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">Occupancy Board</p>
        </div>

        <div className="flex" style={{ minWidth: timelineWidth }}>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-slate-100 bg-white px-4 py-4 text-center",
                isSameDay(day, new Date()) && "bg-[#07008A]/[0.045]",
              )}
              style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{format(day, "MMM")}</p>
              <p className={cn("mt-1 text-[28px] font-semibold leading-none text-slate-700", isSameDay(day, new Date()) && "text-[#07008A]")}>
                {format(day, "dd")}
              </p>
              <p className={cn("mt-2 text-[11px] font-medium text-slate-400", isSameDay(day, new Date()) && "text-[#07008A]/70")}>
                {format(day, "EEE")}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        {packedRooms.map((room) => (
          <div
            key={room.id}
            data-testid={`timeline-room-row-${room.id}`}
            className="flex border-b border-slate-100 last:border-b-0"
            style={{ minHeight: room.rowHeight }}
          >
            <div
              data-testid={`timeline-room-rail-${room.id}`}
              className="sticky left-0 z-20 shrink-0 border-r border-slate-200/80 bg-white px-5 py-4 shadow-[8px_0_24px_-18px_rgba(15,23,42,0.18)]"
              style={{ width: ROOM_COLUMN_WIDTH }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#07008A]/[0.06] text-[#07008A] ring-1 ring-[#07008A]/10">
                  <BedDouble className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-800">Rm {room.room_number}</p>
                  <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{room.type}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {room.packedBookings.length === 0 ? "No bookings in view" : `${room.packedBookings.length} booking${room.packedBookings.length !== 1 ? "s" : ""} in range`}
                  </p>
                </div>
              </div>
            </div>

            <div
              data-testid={`timeline-row-body-${room.id}`}
              className="relative overflow-hidden"
              style={{ minWidth: timelineWidth, height: room.rowHeight }}
            >
              <div className="absolute inset-0 flex">
                {days.map((day) => (
                  <div
                    key={`${room.id}-${day.toISOString()}`}
                    className={cn(
                      "border-r border-slate-100",
                      isSameDay(day, new Date()) ? "bg-[#07008A]/[0.03]" : "bg-[linear-gradient(180deg,rgba(248,250,252,0.75)_0%,rgba(255,255,255,1)_28%)]",
                    )}
                    style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
                  />
                ))}
              </div>

              {room.packedBookings.map((packed) => {
                const isHovered = hoveredBlock === packed.booking.id;
                const widthPercent = packed.widthPercent;
                const isCompact = widthPercent < 9;
                const tone = getStatusTone(packed.booking);
                const bookingStartLabel = format(packed.bookingStart, "MMM d, HH:mm");

                return (
                  <div
                    key={packed.booking.id}
                    data-testid={`timeline-booking-${packed.booking.id}`}
                    className="absolute z-10"
                    style={{
                      left: `${packed.leftPercent}%`,
                      width: `${packed.widthPercent}%`,
                      top: ROW_PADDING + packed.lane * LANE_HEIGHT,
                      height: 30,
                    }}
                    onMouseEnter={() => setHoveredBlock(packed.booking.id)}
                    onMouseLeave={() => setHoveredBlock(null)}
                  >
                    <button
                      type="button"
                      onClick={() => onBookingClick?.(packed.booking)}
                      className={cn(
                        "relative flex h-full w-full items-center overflow-hidden rounded-2xl border px-3 text-left transition-all duration-150",
                        tone.chip,
                        isHovered ? "z-20 scale-[1.01] ring-2 ring-[#07008A]/20" : "active:scale-[0.99]",
                      )}
                      aria-label={`${packed.booking.guests?.full_name || "Guest"} ${packed.booking.status}`}
                    >
                      <span className={cn("absolute inset-y-1 left-1 w-1 rounded-full", tone.accent)} />
                      {packed.clippedStart ? (
                        <ChevronLeft className="mr-1 h-3.5 w-3.5 shrink-0 opacity-55" />
                      ) : null}
                      {packed.booking.is_special_booking ? (
                        <Crown className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold leading-none">
                            {isCompact
                              ? (packed.booking.guests?.full_name || "Guest").slice(0, 1)
                              : packed.booking.guests?.full_name || "Guest"}
                          </p>
                          {!isCompact ? (
                            <span className={cn("truncate text-[10px] font-semibold uppercase tracking-wider", tone.meta)}>
                              {packed.booking.status}
                            </span>
                          ) : null}
                        </div>
                        {!isCompact ? (
                          <p className={cn("mt-1 truncate text-[10px] font-medium", tone.meta)}>
                            {bookingStartLabel}
                          </p>
                        ) : null}
                      </div>

                      {packed.clippedEnd ? (
                        <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0 opacity-55" />
                      ) : null}
                    </button>

                    {isHovered && isCompact ? (
                      <div className="pointer-events-none absolute left-1/2 top-full z-[60] mt-2 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-[10px] text-white shadow-xl">
                        <p className="font-bold">{packed.booking.guests?.full_name || "Guest"}</p>
                        <p className="mt-1 uppercase tracking-wider text-slate-300">{packed.booking.status}</p>
                        <p className="mt-1 text-slate-400">{bookingStartLabel}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {rooms.length === 0 ? (
          <div className="px-8 py-16 text-center text-slate-500">
            <Info className="mx-auto h-8 w-8 opacity-20" />
            <p className="mt-3 text-sm font-medium">No rooms available.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
