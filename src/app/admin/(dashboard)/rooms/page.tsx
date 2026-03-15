"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BedDouble, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoomForm } from "@/components/admin/rooms/RoomForm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type RoomRow = {
  id: string; room_number?: string; room_type?: string; floor?: number; capacity?: number;
  status?: string; rate_plans?: unknown; amenities?: string[]; image_urls?: string[];
  rate_24h_price?: number | null; rate_24h_early_checkin_fee?: number | null;
  rate_24h_late_checkout_fee?: number | null; rate_12h_price?: number | null;
  rate_12h_late_checkout_fee?: number | null; rate_5h_price?: number | null;
  rate_5h_late_checkout_fee?: number | null; rate_3h_price?: number | null;
  rate_3h_late_checkout_fee?: number | null; updated_at?: string | null; created_at?: string | null;
};

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    setAdminToken(token);
    fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? (data as RoomRow[]) : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Rooms</h1>
        <p className="text-muted-foreground mt-1">Room inventory and pricing</p>
      </motion.div>
      <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]"><BedDouble className="h-5 w-5" /></div>
            <span>All Rooms</span>
            <span className="ml-2 text-xs font-medium rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{rooms.length} total</span>
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={() => { setEditingRoom(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add room
            </Button>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingRoom ? "Edit room" : "Add new room"}</DialogTitle></DialogHeader>
              <RoomForm apiUrl="" token={adminToken || ""} room={editingRoom ?? undefined}
                onSuccess={(room) => { setRooms((prev) => { if (!room || typeof room !== "object") return prev; const u = room as RoomRow; if (!u.id) return prev; const idx = prev.findIndex((r) => r.id === u.id); if (idx === -1) return [...prev, u]; const n = [...prev]; n[idx] = u; return n; }); }}
                onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/80">
                    {["Room #", "Type", "Floor", "Capacity", "Rates", "Status", "Price/night", "24h fees", "Amenities", "Media", "Updated", "Actions"].map((h) => (
                      <th key={h} className={`${h === "Actions" ? "text-right pr-6" : "text-left"} py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider ${h === "Room #" || h === "Type" ? "pl-6" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-mono font-medium text-[#07008A]">{r.room_number ?? "—"}</td>
                      <td className="py-4 px-6"><span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{r.room_type ?? "—"}</span></td>
                      <td className="py-4 px-4 text-xs text-slate-700">{r.floor ?? "—"}</td>
                      <td className="py-4 px-4 text-xs text-slate-700">{r.capacity ?? "—"} guest{(r.capacity ?? 0) === 1 ? "" : "s"}</td>
                      <td className="py-4 px-4 text-xs text-slate-700">
                        {Array.isArray(r.rate_plans) && r.rate_plans.length > 0 ? <div className="flex flex-wrap gap-1">{(r.rate_plans as any[]).filter((p) => p?.enabled).map((p) => <span key={p.kind} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{p.kind}</span>)}</div> : <span className="text-xs text-slate-400">No rates</span>}
                      </td>
                      <td className="py-4 px-4"><Badge variant="secondary" className="capitalize px-3 py-1 text-[11px] font-semibold">{r.status ?? "—"}</Badge></td>
                      <td className="py-4 px-4 font-semibold text-[#07008A]">
                        {(() => { const p = r.rate_24h_price ?? r.rate_12h_price ?? r.rate_5h_price ?? r.rate_3h_price; if (p != null) return `₱${Number(p).toFixed(0)}`; if (Array.isArray(r.rate_plans)) { const plans = r.rate_plans as any[]; const pri = plans.find((x) => x?.kind === "24h") ?? plans.find((x) => x?.kind === "12h") ?? plans.find((x) => x?.kind === "5h") ?? plans.find((x) => x?.kind === "3h"); if (pri?.base_price != null) return `₱${Number(pri.base_price).toFixed(0)}`; } return "—"; })()}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {(() => { const e = r.rate_24h_early_checkin_fee; const l = r.rate_24h_late_checkout_fee; if (e == null && l == null) return "—"; const parts: string[] = []; if (e != null && Number(e) > 0) parts.push(`Early ₱${Number(e).toFixed(0)}`); if (l != null && Number(l) > 0) parts.push(`Late ₱${Number(l).toFixed(0)}`); return parts.length ? parts.join(" · ") : "—"; })()}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600 max-w-[180px] truncate">{Array.isArray(r.amenities) && r.amenities.length ? r.amenities.join(", ") : "—"}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {Array.isArray(r.image_urls) && r.image_urls.length > 0 ? <div className="flex flex-col gap-1"><div className="h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-slate-100"><img src={r.image_urls[0]} className="h-full w-full object-cover" alt="" /></div><span className="text-[10px] text-slate-500">{r.image_urls.length} image{r.image_urls.length !== 1 ? "s" : ""}</span></div> : <span className="text-xs text-slate-400">No images</span>}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500">{r.updated_at ? new Date(r.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-[#07008A] hover:bg-[#07008A]/10" onClick={() => { setEditingRoom(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit room</TooltipContent></Tooltip>
                          <AlertDialog><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete room</TooltipContent></Tooltip>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this room?</AlertDialogTitle><AlertDialogDescription>Room <span className="font-semibold">{r.room_number}</span> will be permanently deleted if it has no bookings.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => { const token = localStorage.getItem("admin_token"); if (!token) { router.replace("/admin/login"); return; } try { const res = await fetch(`/api/rooms/${r.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { toast.error("Failed to delete room."); return; } setRooms((prev) => prev.filter((room) => room.id !== r.id)); toast.success(`Room ${r.room_number ?? ""} was deleted.`); } catch { toast.error("Something went wrong."); } }}>Delete room</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
