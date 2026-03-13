"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Droplets, Wrench, CheckCircle2, Play, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = [
  { key: "Dirty", icon: Droplets, bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", columnBg: "bg-rose-50/30" },
  { key: "In Cleaning", icon: Sparkles, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", columnBg: "bg-amber-50/30" },
  { key: "Clean", icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", columnBg: "bg-emerald-50/30" },
  { key: "Maintenance", icon: Wrench, bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", columnBg: "bg-orange-50/30" },
];

export default function AdminHousekeepingPage() {
  const [rooms, setRooms] = useState<Array<{ id?: string; room_number?: string; room_type?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    fetch("/api/housekeeping/rooms", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [router]);

  const updateRoomStatus = async (roomId: string | undefined, nextStatus: string) => {
    if (!roomId) return;
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    
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
        toast.error((data as { error?: string }).error || "Failed to update."); 
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
    switch (key) {
      case "Dirty":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "In Cleaning")} className="w-full bg-[#07008A] hover:bg-[#05006a] text-white">
            <Play className="h-3 w-3 mr-1" /> Start Cleaning
          </Button>
        );
      case "In Cleaning":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "Available")} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            <Check className="h-3 w-3 mr-1" /> Mark Clean
          </Button>
        );
      case "Clean":
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="w-full text-slate-600 border-slate-300">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => updateRoomStatus(room.id, "Dirty")} className="text-rose-600 focus:text-rose-700">
                <Droplets className="h-4 w-4 mr-2" /> Mark Dirty
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateRoomStatus(room.id, "Maintenance")} className="text-orange-600 focus:text-orange-700">
                <Wrench className="h-4 w-4 mr-2" /> Maintenance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case "Maintenance":
        return (
          <Button size="sm" onClick={() => updateRoomStatus(room.id, "Available")} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Fixed & Clean
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full pl-1">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 shrink-0">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Housekeeping</h1>
        <p className="text-muted-foreground mt-1">Manage room cleaning status and priorities</p>
      </motion.div>
      
      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start pb-10">
        {statusConfig.map(({ key, icon: Icon, bg, border, text, columnBg }) => {
          const columnRooms = rooms.filter((r) => key === "Clean" ? r.status === "Available" : r.status === key);
          
          return (
            <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              {/* Column Header */}
              <div className={`rounded-xl border shadow-sm ${columnBg} border-slate-200 overflow-hidden flex flex-col h-full min-h-[400px]`}>
                <div className={`${bg} px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${text}`} />
                    <span className={`font-semibold ${text} tracking-tight`}>{key}</span>
                  </div>
                  <span className="bg-white rounded-full px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
                    {columnRooms.length}
                  </span>
                </div>
                
                {/* Column Body */}
                <div className="p-3 flex-1 flex flex-col gap-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-lg bg-white/50" />
                    ))
                  ) : columnRooms.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 opacity-60">
                      <Icon className="h-8 w-8 mb-2 stroke-1" />
                      <p className="text-sm">No rooms</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {columnRooms.map((r) => (
                        <motion.div 
                          key={r.id ?? r.room_number} 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-base font-bold text-[#07008A] leading-none">
                              {r.room_number}
                            </h3>
                            {r.room_type && (
                              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {r.room_type}
                              </span>
                            )}
                          </div>
                          
                          <div className="mt-4">
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
