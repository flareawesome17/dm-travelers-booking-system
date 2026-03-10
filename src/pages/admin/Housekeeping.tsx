import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Droplets, Wrench, CheckCircle2 } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const API_URL = import.meta.env.VITE_API_URL || "";

const statusConfig = [
  { key: "Dirty", icon: Droplets, bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  { key: "In Cleaning", icon: Sparkles, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  { key: "Maintenance", icon: Wrench, bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  // UI label "Clean" maps to DB status "Available"
  { key: "Clean", icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
];

export default function AdminHousekeeping() {
  const [rooms, setRooms] = useState<Array<{ id?: string; room_number?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/housekeeping/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [navigate]);

  const updateRoomStatus = async (roomId: string | undefined, nextStatus: string) => {
    if (!roomId) return;
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to update room status.");
        return;
      }
      toast.success(`Room status updated to ${nextStatus}.`);
      // Refresh list
      setLoading(true);
      fetch(`${API_URL}/api/housekeeping/rooms`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((payload) => setRooms(Array.isArray(payload) ? payload : []))
        .catch(() => setRooms([]))
        .finally(() => setLoading(false));
    } catch {
      toast.error("Something went wrong while updating room status.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Housekeeping</h1>
            <p className="text-muted-foreground mt-1">Room status by category</p>
          </motion.div>
          <div className="grid gap-6">
            {statusConfig.map(({ key, icon: Icon, bg, border, text }) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className={`border-0 shadow-lg overflow-hidden border-l-4 ${border}`}>
                  <CardHeader className={`${bg} px-6 py-4`}>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${text}`} />
                      <span className={text}>{key}</span>
                      <span className="text-slate-500 font-normal text-sm">
                        (
                          {rooms.filter((r) =>
                            key === "Clean" ? r.status === "Available" : r.status === key,
                          ).length}
                        )
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {loading ? (
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-8 w-16 rounded-full" />
                        <Skeleton className="h-8 w-16 rounded-full" />
                        <Skeleton className="h-8 w-20 rounded-full" />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {rooms
                          .filter((r) => (key === "Clean" ? r.status === "Available" : r.status === key))
                          .map((r) => (
                            <div
                              key={r.id ?? r.room_number}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border shadow-sm text-sm text-slate-700"
                            >
                              <span className="font-medium">{r.room_number}</span>
                              <select
                                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs"
                                value={key === "Clean" ? (r.status === "Available" ? "Available" : r.status) : r.status}
                                onChange={(e) => updateRoomStatus(r.id, e.target.value)}
                              >
                                <option value="Dirty">Dirty</option>
                                <option value="In Cleaning">In Cleaning</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Available">Clean</option>
                              </select>
                            </div>
                          ))}
                        {rooms.filter((r) => (key === "Clean" ? r.status === "Available" : r.status === key)).length ===
                          0 && (
                          <span className="text-sm text-muted-foreground">No rooms</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
