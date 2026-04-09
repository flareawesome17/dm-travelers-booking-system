"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, endOfMonth, eachDayOfInterval, format, startOfDay, startOfMonth, subDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExtendStayModal } from "@/components/admin/bookings/ExtendStayModal";
import { GridView } from "@/components/admin/calendar/GridView";
import { TimelineView } from "@/components/admin/calendar/TimelineView";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/context/PermissionsContext";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

const LEGEND_ITEMS = [
  { label: "Core Booking", className: "bg-[#07008A]/[0.07] text-[#07008A] border-[#07008A]/15" },
  { label: "LGU", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { label: "Special", className: "bg-amber-50 text-amber-700 border-amber-200" },
  { label: "Checked-Out", className: "bg-rose-50 text-rose-700 border-rose-200" },
];

export default function CalendarPage() {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("bookings.update");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");
  const [viewWindowDays] = useState(14);
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 2)));
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [token, setToken] = useState("");

  const endDate = useMemo(() => {
    if (viewMode === "grid") return endOfMonth(startDate);
    return addDays(startDate, viewWindowDays);
  }, [startDate, viewMode, viewWindowDays]);

  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  const rangeLabel = useMemo(() => `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`, [endDate, startDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const adminToken = localStorage.getItem("admin_token") || "";
      if (adminToken) setToken(adminToken);

      const res = await fetch(
        `/api/admin/calendar?start_date=${encodeURIComponent(startDate.toISOString())}&end_date=${encodeURIComponent(endDate.toISOString())}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );

      if (!res.ok) throw new Error("Failed to fetch calendar data");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
  };

  const jumpToToday = () => {
    const now = new Date();
    setStartDate(viewMode === "grid" ? startOfMonth(now) : startOfDay(subDays(now, 2)));
  };

  return (
    <div className="flex h-[calc(100vh-72px)] flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(254,213,1,0.09),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div
        data-testid="calendar-toolbar"
        className="sticky top-0 z-40 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/88"
      >
        <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#FED501]/50 bg-[#FED501]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a6b00]">
                <Sparkles className="h-3.5 w-3.5" />
                Front Desk Board
              </div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#07008A] md:text-3xl">
                <CalendarIcon className="h-5 w-5 text-[#FED501] md:h-6 md:w-6" />
                Booking Calendar
              </h1>
              <p className="mt-1 text-sm text-slate-500">Visualize and manage room occupancy with a clearer operational timeline.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900"
                  onClick={() => setStartDate(subDays(startDate, viewMode === "grid" ? 30 : 7))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm">
                      {rangeLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-2xl border-slate-200 p-0 shadow-xl" align="center">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setStartDate(viewMode === "grid" ? startOfMonth(date) : startOfDay(date));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900"
                  onClick={() => setStartDate(addDays(startDate, viewMode === "grid" ? 30 : 7))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" className="h-10 rounded-2xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm" onClick={jumpToToday}>
                Today
              </Button>

              <div className="flex rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm">
                <Button
                  variant={viewMode === "timeline" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 rounded-xl px-4",
                    viewMode === "timeline"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                  onClick={() => setViewMode("timeline")}
                >
                  <List className="mr-1.5 h-4 w-4" />
                  Timeline
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 rounded-xl px-4",
                    viewMode === "grid"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                  onClick={() => {
                    setViewMode("grid");
                    setStartDate(startOfMonth(startDate));
                  }}
                >
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  Grid
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {LEGEND_ITEMS.map((item) => (
              <span
                key={item.label}
                className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", item.className)}
              >
                {item.label}
              </span>
            ))}
            <span className="ml-auto hidden text-[11px] font-medium text-slate-400 md:inline">
              {viewMode === "timeline" ? `${days.length} visible days` : format(startDate, "MMMM yyyy")}
            </span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto">
        {loading && rooms.length === 0 ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/55 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#07008A]" />
          </div>
        ) : null}

        <div className="p-4 md:p-6">
          {viewMode === "timeline" ? (
            <TimelineView rooms={rooms} startDate={startDate} endDate={endDate} days={days} onBookingClick={handleBookingClick} />
          ) : (
            <GridView rooms={rooms} currentMonth={startDate} onBookingClick={handleBookingClick} />
          )}
        </div>
      </div>

      {selectedBooking ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:bottom-6">
          <div className="w-full max-w-[420px] rounded-[28px] border border-slate-200/80 bg-white/97 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)] backdrop-blur">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {selectedBooking.is_lgu_booking ? "LGU Booking" : selectedBooking.is_special_booking ? "Special Booking" : "Booking"}
                </p>
                <h3 className="mt-2 truncate text-lg font-bold text-slate-900">{selectedBooking.guests?.full_name || "Guest"}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Room {selectedBooking.room_number || selectedBooking.rooms?.room_number || "Unassigned"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {selectedBooking.actual_check_in ? "Checked In" : "Scheduled In"}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {format(new Date(selectedBooking.actual_check_in || selectedBooking.check_in_date), "MMM d, h:mm a")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {selectedBooking.actual_check_out ? "Checked Out" : "Scheduled Out"}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {format(new Date(selectedBooking.actual_check_out || selectedBooking.check_out_date || new Date()), "MMM d, h:mm a")}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <span
                className={cn(
                  "inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                  selectedBooking.status === "Checked-Out" || selectedBooking.status === "Checked Out"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : selectedBooking.status === "Checked-In" || selectedBooking.status === "Checked In"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-[#07008A]/15 bg-[#07008A]/[0.06] text-[#07008A]",
                )}
              >
                {selectedBooking.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-2xl border-slate-200"
                onClick={() => {
                  window.open(`/admin/bookings?id=${selectedBooking.id}`, "_blank");
                  setSelectedBooking(null);
                }}
              >
                View Details
              </Button>
              {canUpdate ? (
                <Button className="h-10 rounded-2xl bg-[#07008A] text-white hover:bg-[#05006a]" onClick={() => setShowExtendModal(true)}>
                  Extend Stay
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedBooking && showExtendModal ? (
        <ExtendStayModal
          open={showExtendModal}
          onClose={() => setShowExtendModal(false)}
          booking={selectedBooking}
          token={token}
          onSuccess={() => {
            fetchData();
            setSelectedBooking(null);
          }}
        />
      ) : null}
    </div>
  );
}
