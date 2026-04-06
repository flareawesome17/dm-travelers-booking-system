"use client";

import { useEffect, useState, useMemo } from "react";
import { format, addDays, subDays, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { TimelineView } from "@/components/admin/calendar/TimelineView";
import { GridView } from "@/components/admin/calendar/GridView";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, List, Loader2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ExtendStayModal } from "@/components/admin/bookings/ExtendStayModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/context/PermissionsContext";

export default function CalendarPage() {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("bookings.update");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");
  
  // Controls
  const [viewWindowDays, setViewWindowDays] = useState(14); // e.g. 14 days viewed at once
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 2))); // start 2 days ago for context
  
  const endDate = useMemo(() => {
    if (viewMode === "grid") return endOfMonth(startDate);
    return addDays(startDate, viewWindowDays);
  }, [startDate, viewWindowDays, viewMode]);

  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

  // Selected booking for action
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [token, setToken] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const t = localStorage.getItem("admin_token");
      if (t) setToken(t);

      // Fetch overlapping bookings
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();
      const res = await fetch(`/api/admin/calendar?start_date=${encodeURIComponent(startStr)}&end_date=${encodeURIComponent(endStr)}`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking);
  };

  // Auto-close booking preview dialog when clicking outside (done via extending state logic if mapped)
  // For simplicity, we just trigger ExtendStayModal explicitly or a Custom Popover on click.
  // We'll use a basic handler for now: we intercept the booking and show a simple floating card or open a standard modal.
  
  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-72px)] overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* Header controls */}
      <div className="flex flex-col gap-4 p-4 md:p-6 md:flex-row md:items-center justify-between shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#07008A] dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-[#FED501]" />
            Booking Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">Visualize and manage room occupancy</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                onClick={() => setStartDate(subDays(startDate, 7))}
             >
                <ChevronLeft className="h-4 w-4" />
             </Button>
             
             <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 px-3 mx-1 font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
                  {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                 <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                 />
              </PopoverContent>
             </Popover>

             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
                onClick={() => setStartDate(addDays(startDate, 7))}
             >
                <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
           
           <Button variant="outline" className="h-10 border-slate-200 dark:border-slate-700" onClick={() => {
             const now = new Date();
             setStartDate(viewMode === "grid" ? startOfMonth(now) : startOfDay(subDays(now, 2)));
           }}>
             Today
           </Button>

           {/* View Switcher */}
           <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             <Button
                variant={viewMode === "timeline" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 transition-all",
                  viewMode === "timeline" 
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white" 
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
                onClick={() => setViewMode("timeline")}
             >
                <List className="h-4 w-4 mr-1.5" /> Timeline
             </Button>
             <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 transition-all",
                  viewMode === "grid" 
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white" 
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
                onClick={() => {
                   setViewMode("grid");
                   setStartDate(startOfMonth(startDate));
                }}
             >
                <LayoutGrid className="h-4 w-4 mr-1.5" /> Grid
             </Button>
           </div>
        </div>
      </div>

      {/* Main Timeline View */}
      <div className="flex-1 overflow-auto p-4 md:p-6 relative">
        {loading && rooms.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50">
            <Loader2 className="h-8 w-8 animate-spin text-[#07008A]" />
          </div>
        ) : null}
        
        {viewMode === "timeline" ? (
          <TimelineView 
             rooms={rooms}
             startDate={startDate}
             endDate={endDate}
             days={days}
             onBookingClick={handleBookingClick}
          />
        ) : (
          <GridView 
             rooms={rooms}
             currentMonth={startDate}
             onBookingClick={handleBookingClick}
          />
        )}
      </div>

      {/* Booking Quick Action Sidebar or Modal */}
      {selectedBooking && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 z-50 animate-in slide-in-from-bottom-5">
           <div className="flex justify-between items-start mb-3">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                 {selectedBooking.is_lgu_booking ? "LGU Booking" : selectedBooking.is_special_booking ? "Special Event" : "Booking"}
               </p>
               <h3 className="font-bold text-slate-800 dark:text-slate-100">{selectedBooking.guests?.full_name}</h3>
             </div>
             <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 -mr-1">
               <Layers className="h-4 w-4" />
             </button>
           </div>
           
           <div className="space-y-4 mb-5">
               <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                     "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                     (selectedBooking.status === "Checked Out" || selectedBooking.status === "Checked-Out")
                        ? "bg-rose-100 border-rose-200 text-rose-700" 
                        : (selectedBooking.status === "Checked In" || selectedBooking.status === "Checked-In")
                           ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                           : "bg-blue-100 border-blue-200 text-blue-700"
                  )}>
                     {selectedBooking.status}
                  </span>
               </div>
               <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Left Block: Check In */}
                  {(selectedBooking.status !== "Checked-Out" && selectedBooking.status !== "Checked Out") ? (
                     <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-400">{selectedBooking.actual_check_in ? "Checked In" : "Sched In"}</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                           {format(new Date(selectedBooking.actual_check_in || selectedBooking.check_in_date), "MMM d, h:mm a")}
                        </p>
                     </div>
                  ) : null}

                  {/* Right Block: Check Out */}
                  <div className={cn(
                     "bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800",
                     (selectedBooking.status === "Checked-Out" || selectedBooking.status === "Checked Out") ? "col-span-2 text-center" : ""
                  )}>
                     <p className="text-slate-400">
                        {(selectedBooking.status === "Checked-Out" || selectedBooking.status === "Checked Out") 
                           ? "Checked Out" 
                           : (selectedBooking.actual_check_out ? "Checked Out" : "Sched Out")}
                     </p>
                     <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {format(new Date(selectedBooking.actual_check_out || selectedBooking.check_out_date || new Date()), "MMM d, h:mm a")}
                     </p>
                  </div>
               </div>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="w-full text-xs h-8"
                onClick={() => {
                  window.open(`/admin/bookings?id=${selectedBooking.id}`, "_blank");
                  setSelectedBooking(null);
                }}
              >
                View Details
              </Button>
              {canUpdate && (
                <Button 
                  className="w-full text-xs h-8 bg-[#07008A] hover:bg-[#05006a] text-white"
                  onClick={() => setShowExtendModal(true)}
                >
                  Extend Stay
                </Button>
              )}
           </div>
         </div>
      )}

      {selectedBooking && showExtendModal && (
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
      )}
    </div>
  );
}
