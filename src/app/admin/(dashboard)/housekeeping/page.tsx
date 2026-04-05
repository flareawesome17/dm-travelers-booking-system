"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Droplets, Wrench, CheckCircle2, Play, Check, AlertTriangle, BedDouble } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getErrorMessage } from "@/lib/utils";
import { usePermissions } from "@/context/PermissionsContext";

const statusConfig = [
  { key: "Dirty", icon: Droplets, color: "text-rose-600", bgIcon: "bg-rose-50", border: "border-rose-200/60", headerBg: "bg-rose-50", headerBorder: "border-l-rose-500", countBg: "bg-rose-100 text-rose-700" },
  { key: "In Cleaning", icon: Sparkles, color: "text-amber-600", bgIcon: "bg-amber-50", border: "border-amber-200/60", headerBg: "bg-amber-50", headerBorder: "border-l-amber-500", countBg: "bg-amber-100 text-amber-700" },
  { key: "Clean", icon: CheckCircle2, color: "text-emerald-600", bgIcon: "bg-emerald-50", border: "border-emerald-200/60", headerBg: "bg-emerald-50", headerBorder: "border-l-emerald-500", countBg: "bg-emerald-100 text-emerald-700" },
  { key: "Maintenance", icon: Wrench, color: "text-orange-600", bgIcon: "bg-orange-50", border: "border-orange-200/60", headerBg: "bg-orange-50", headerBorder: "border-l-orange-500", countBg: "bg-orange-100 text-orange-700" },
];

export default function AdminHousekeepingPage() {
  const [rooms, setRooms] = useState<Array<{ id?: string; room_number?: string; room_type?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    
    fetch("/api/housekeeping/rooms", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [router]);

  const updateRoomStatus = async (roomId: string | undefined, nextStatus: string) => {
    if (!roomId) return;
    const token = localStorage.getItem("admin_token");
    
    
    // Optistic UI update
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: nextStatus } : r));

    try {
      const res = await fetch(`/api/rooms/${roomId}`, { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ status: nextStatus }) 
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { 
        toast.error(getErrorMessage(data) || "Failed to update."); 
        // Revert optimisic update
        fetchRooms();
        return; 
      }
      toast.success(`Room status updated to ${nextStatus}.`);
    } catch { 
      toast.error("Something went wrong."); 
      fetchRooms();
    }
  };

  const fetchRooms = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    fetch("/api/housekeeping/rooms", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setRooms(Array.isArray(payload) ? payload : []))
      .catch(() => setRooms([]))
  }

  const renderActionButtons = (room: any, key: string) => {
    if (!hasPermission("housekeeping.update")) return null;

    switch (key) {
      case "Dirty":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "In Cleaning")} className="w-full bg-[#07008A] hover:bg-[#05006a] text-white shadow-sm h-9 text-xs">
            <Play className="h-3 w-3 mr-1.5" /> Start Cleaning
          </Button>
        );
      case "In Cleaning":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "Available")} className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-9 text-xs">
            <Check className="h-3 w-3 mr-1.5" /> Mark Clean
          </Button>
        );
      case "Clean":
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="w-full text-slate-500 border-slate-200 h-9 text-xs hover:border-slate-300">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => updateRoomStatus(room.id, "Dirty")} className="text-rose-600 focus:text-rose-700 text-xs">
                <Droplets className="h-3.5 w-3.5 mr-2" /> Mark Dirty
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateRoomStatus(room.id, "Maintenance")} className="text-orange-600 focus:text-orange-700 text-xs">
                <Wrench className="h-3.5 w-3.5 mr-2" /> Maintenance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "Maintenance":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "Available")} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1.5" /> Mark Fixed & Clean
          </Button>
        );
      default:
        return null;
    }
  };

  // Summary counts
  const dirtyCount = rooms.filter(r => r.status === "Dirty").length;
  const cleaningCount = rooms.filter(r => r.status === "In Cleaning").length;
  const totalCount = rooms.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 shrink-0">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Housekeeping</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage room cleaning status and priorities</p>
        
        {/* Quick Stats Bar */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <BedDouble className="h-3.5 w-3.5" />
              <span className="font-medium">{totalCount} rooms total</span>
            </div>
            {dirtyCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600">
                <span className="status-dot status-dot-error" />
                <span className="font-semibold">{dirtyCount} need cleaning</span>
              </div>
            )}
            {cleaningCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <span className="status-dot status-dot-warning animate-pulse-soft" />
                <span className="font-semibold">{cleaningCount} in progress</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
      
      {/* Kanban Board */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 xl:grid-cols-4 gap-4 tablet:gap-5 items-start pb-10">
        {statusConfig.map(({ key, icon: Icon, color, bgIcon, border, headerBg, headerBorder, countBg }, colIdx) => {
          const columnRooms = rooms.filter((r) => key === "Clean" ? r.status === "Available" : r.status === key);
          
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: colIdx * 0.05 }}
            >
              <div className={cn(
                "rounded-xl border shadow-xs overflow-hidden flex flex-col min-h-[380px]",
                "bg-white border-slate-200/80",
                `border-l-[3px] ${headerBorder}`
              )}>
                {/* Column Header */}
                <div className={cn("px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0", headerBg)}>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", bgIcon)}>
                      <Icon className={cn("h-3.5 w-3.5", color)} />
                    </div>
                    <span className={cn("text-sm font-bold tracking-tight", color)}>{key}</span>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold min-w-[24px] text-center", countBg)}>
                    {columnRooms.length}
                  </span>
                </div>
                
                {/* Column Body */}
                <div className="p-3 flex-1 flex flex-col gap-2.5 bg-slate-50/30">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-lg" />
                    ))
                  ) : columnRooms.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center pb-8 p-4">
                      <EmptyState 
                        icon={Icon} 
                        title="Clear!" 
                        description={`No rooms ${key.toLowerCase()}`}
                        borderless
                        className="p-6"
                        iconClassName={cn("mb-3 ring-0 shadow-none", bgIcon)}
                      />
                    </div>
                  ) : (
                    <AnimatePresence>
                      {columnRooms.map((r) => (
                        <motion.div 
                          key={r.id ?? r.room_number} 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 hover:shadow-elevation-1 transition-all duration-200 group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-base font-bold text-[#07008A] leading-none">
                                {r.room_number}
                              </h3>
                            </div>
                            {r.room_type && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {r.room_type}
                              </span>
                            )}
                          </div>
                          
                          <div className="mt-3">
                            {renderActionButtons(r, key)}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
