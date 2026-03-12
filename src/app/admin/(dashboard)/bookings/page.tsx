"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarCheck, Plus, Pencil, Trash2, LogIn, LogOut, XCircle, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookingForm } from "@/components/admin/bookings/BookingForm";
import { EditBookingForm } from "@/components/admin/bookings/EditBookingForm";
import { toast } from "@/components/ui/sonner";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default", "pending payment": "secondary", "pending verification": "secondary",
  "checked-in": "default", "checked-out": "outline", cancelled: "destructive", "no show": "destructive",
};

function getStatusVariant(status?: string) {
  if (!status) return "secondary" as const;
  return statusVariant[String(status).toLowerCase()] ?? ("secondary" as const);
}

type BookingRow = {
  id?: string; reference_number?: string; status?: string;
  check_in_date?: string; check_out_date?: string;
  total_amount?: number; deposit_paid?: number; balance_due?: number;
  rate_plan_kind?: string; special_requests?: string | null;
  early_checkin_fee_applied?: number; late_checkout_fee_applied?: number; is_lgu_booking?: boolean;
  guests?: { full_name?: string; email?: string; phone_number?: string };
  rooms?: {
    room_number?: string; room_type?: string;
    rate_24h_early_checkin_fee?: number | null; rate_24h_late_checkout_fee?: number | null;
    rate_12h_late_checkout_fee?: number | null; rate_5h_late_checkout_fee?: number | null;
    rate_3h_late_checkout_fee?: number | null;
  } | null;
};

export default function AdminBookingsPage() {
  const [list, setList] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingRow | null>(null);
  const [checkInBooking, setCheckInBooking] = useState<BookingRow | null>(null);
  const [checkInAt, setCheckInAt] = useState<string>("");
  const [checkOutBooking, setCheckOutBooking] = useState<BookingRow | null>(null);
  const [checkOutAt, setCheckOutAt] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const router = useRouter();
  const token = () => localStorage.getItem("admin_token") || "";

  const api = (path: string, options?: RequestInit) =>
    fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...options?.headers },
    });

  const fetchBookings = () => {
    const t = localStorage.getItem("admin_token");
    if (!t) return;
    fetch("/api/bookings", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) { router.replace("/admin/login"); return; }
    fetch("/api/bookings", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!checkInBooking) return;
    const base = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
    setCheckInAt(local);
  }, [checkInBooking]);

  useEffect(() => {
    if (!checkOutBooking) return;
    const base = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
    setCheckOutAt(local);
  }, [checkOutBooking]);

  const computeEarlyCheckInPreview = () => {
    const b = checkInBooking;
    if (!b) return { rate: 0, hoursEarly: 0, fee: 0, reason: "No booking selected." as const };
    if (b.rate_plan_kind !== "24h") return { rate: 0, hoursEarly: 0, fee: 0, reason: "Early check-in fee applies only to 24-hour bookings." as const };
    if (!checkInAt) return { rate: 0, hoursEarly: 0, fee: 0, reason: "Select an actual check-in time." as const };
    const actual = new Date(checkInAt);
    if (Number.isNaN(actual.getTime())) return { rate: 0, hoursEarly: 0, fee: 0, reason: "Invalid actual check-in time." as const };
    const checkInDateStr = String(b.check_in_date || "").slice(0, 10);
    const reserved = checkInDateStr ? new Date(`${checkInDateStr}T14:00:00`) : new Date("");
    if (Number.isNaN(reserved.getTime())) return { rate: 0, hoursEarly: 0, fee: 0, reason: "Reserved check-in time is not set correctly." as const };
    const rate = Number(b.rooms?.rate_24h_early_checkin_fee || 0);
    if (!Number.isFinite(rate) || rate <= 0) return { rate: 0, hoursEarly: 0, fee: 0, reason: "No early check-in fee rate is set for this room." as const };
    if (actual >= reserved) return { rate, hoursEarly: 0, fee: 0, reason: "Not early (on or after reserved time)." as const };
    const diffMs = reserved.getTime() - actual.getTime();
    const hoursEarly = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    return { rate, hoursEarly, fee: rate * hoursEarly, reason: "Early check-in detected." as const };
  };

  const computeLateCheckOutPreview = () => {
    const b = checkOutBooking;
    if (!b) return { rate: 0, hoursLate: 0, fee: 0, reason: "No booking selected." as const };
    if (!checkOutAt) return { rate: 0, hoursLate: 0, fee: 0, reason: "Select an actual check-out time." as const };
    const actual = new Date(checkOutAt);
    if (Number.isNaN(actual.getTime())) return { rate: 0, hoursLate: 0, fee: 0, reason: "Invalid actual check-out time." as const };
    const rateKind = b.rate_plan_kind || "24h";
    const checkOutDateStr = String(b.check_out_date || "").slice(0, 10);
    if (!checkOutDateStr) return { rate: 0, hoursLate: 0, fee: 0, reason: "Check-out date is not set." as const };
    const reserved = new Date(`${checkOutDateStr}T12:00:00`);
    if (Number.isNaN(reserved.getTime())) return { rate: 0, hoursLate: 0, fee: 0, reason: "Reserved check-out time is not set correctly." as const };
    let rate = 0;
    if (rateKind === "24h") rate = Number(b.rooms?.rate_24h_late_checkout_fee || 0);
    else if (rateKind === "12h") rate = Number(b.rooms?.rate_12h_late_checkout_fee || 0);
    else if (rateKind === "5h") rate = Number(b.rooms?.rate_5h_late_checkout_fee || 0);
    else if (rateKind === "3h") rate = Number(b.rooms?.rate_3h_late_checkout_fee || 0);
    if (!Number.isFinite(rate) || rate <= 0) return { rate: 0, hoursLate: 0, fee: 0, reason: "No late check-out fee rate is set for this room." } as const;
    if (actual <= reserved) return { rate, hoursLate: 0, fee: 0, reason: "Not late (on or before reserved time)." as const };
    const diffMs = actual.getTime() - reserved.getTime();
    const hoursLate = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    return { rate, hoursLate, fee: rate * hoursLate, reason: "Late check-out detected." as const };
  };

  const filtered = list.filter((b) => {
    const matchesStatus = statusFilter === "all" ? true : String(b.status || "").toLowerCase() === statusFilter.toLowerCase();
    const term = search.trim().toLowerCase();
    if (!term) return matchesStatus;
    const haystack = [b.reference_number, b.guests?.full_name, b.guests?.email, b.rooms?.room_number, b.rooms?.room_type, b.rate_plan_kind, b.is_lgu_booking ? "lgu booking" : ""].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && haystack.includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filtered.slice(startIndex, endIndex);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-1">Manage reservations and check-in dates</p>
      </motion.div>
      <Card className="border-0 shadow-lg bg-white overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]"><CalendarCheck className="h-5 w-5" /></div>
              <span>All Bookings</span>
            </CardTitle>
            <span className="ml-1 text-xs font-medium rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{filtered.length} filtered / {list.length} total</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input type="text" placeholder="Search ref, guest, room..." className="h-8 w-44 md:w-56 rounded-full border border-slate-200 bg-white pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#07008A]/60" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <select className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#07008A]/60" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="all">All statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Checked-In">Checked-In</option>
                <option value="Checked-Out">Checked-Out</option>
                <option value="Pending Payment">Pending Payment</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No Show">No Show</option>
              </select>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add booking
              </Button>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add new booking</DialogTitle></DialogHeader>
                <BookingForm apiUrl="" token={localStorage.getItem("admin_token") || ""} onSuccess={() => { setLoading(true); fetchBookings(); }} onClose={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/80">
                    {["Reference", "Guest", "Room", "Rate", "Check-in", "Check-out", "Total", "Payment", "Fees", "Status", "Actions"].map((h) => (
                      <th key={h} className={`${h === "Actions" ? "text-right pr-6" : "text-left"} py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider ${h === "Reference" ? "pl-6" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((b) => (
                    <tr key={b.reference_number ?? b.id ?? Math.random()} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-sm font-medium text-[#07008A]">{b.reference_number ?? "—"}</td>
                      <td className="py-4 px-4 text-xs text-slate-700">
                        <div><span className="font-medium">{b.guests?.full_name ?? "—"}</span>{b.guests?.email && <div className="text-slate-500 truncate max-w-[140px]">{b.guests.email}</div>}{b.is_lgu_booking && <div className="mt-0.5 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">LGU booking</div>}</div>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-700">{b.rooms?.room_number ? <span>{b.rooms.room_number}{b.rooms.room_type && <span className="text-slate-500"> ({b.rooms.room_type})</span>}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{b.rate_plan_kind ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-medium">{b.rate_plan_kind}</span> : "—"}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{b.check_in_date ?? "—"}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{b.check_out_date ?? "—"}</td>
                      <td className="py-4 px-4 font-semibold text-[#07008A]">₱{Number(b.total_amount ?? 0).toFixed(0)}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {(() => { const total = Number(b.total_amount ?? 0); const deposit = Number(b.deposit_paid ?? 0); const balance = Number(b.balance_due ?? 0); if (!total) return "—"; if (balance <= 0 && total > 0) return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">Paid in full</span>; if (deposit > 0 && balance > 0) return <span className="inline-flex flex-col gap-0.5"><span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-100">Partial payment</span><span className="text-[11px] text-slate-500">Deposit ₱{deposit.toFixed(0)} · Balance ₱{balance.toFixed(0)}</span></span>; return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">Unpaid</span>; })()}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500">
                        {[(Number(b.early_checkin_fee_applied) || 0) > 0 && `Early ₱${Number(b.early_checkin_fee_applied).toFixed(0)}`, (Number(b.late_checkout_fee_applied) || 0) > 0 && `Late ₱${Number(b.late_checkout_fee_applied).toFixed(0)}`].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-2">
                          {b.status === "Checked-In" && <span className="relative inline-flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                          <Badge variant={getStatusVariant(b.status)} className="capitalize">{b.status ?? "—"}</Badge>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-[#07008A] hover:bg-[#07008A]/10" onClick={() => setEditBooking(b)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit booking</TooltipContent></Tooltip>
                          {b.status !== "Checked-In" && b.status !== "Checked-Out" && b.status !== "Cancelled" && (
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => setCheckInBooking(b)}><LogIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Check in</TooltipContent></Tooltip>
                          )}
                          {b.status === "Checked-In" && (
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-amber-600 hover:bg-amber-50" onClick={() => setCheckOutBooking(b)}><LogOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Check out</TooltipContent></Tooltip>
                          )}
                          {b.status !== "Cancelled" && (
                            <>
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-500 hover:bg-red-50" onClick={async () => { if (!b.id) return; try { const res = await api(`/api/bookings/${b.id}`, { method: "PATCH", body: JSON.stringify({ status: "Cancelled" }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error((data as { error?: string }).error || "Failed to cancel."); return; } toast.success("Cancelled."); setLoading(true); fetchBookings(); } catch { toast.error("Something went wrong."); } }}><XCircle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Cancel booking</TooltipContent></Tooltip>
                              <AlertDialog><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete booking</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this booking?</AlertDialogTitle><AlertDialogDescription>This will permanently delete booking <span className="font-semibold">{b.reference_number}</span>.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => { if (!b.id) return; try { const res = await api(`/api/bookings/${b.id}`, { method: "DELETE" }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error((data as { error?: string }).error || "Failed."); return; } toast.success("Deleted."); setLoading(true); fetchBookings(); } catch { toast.error("Something went wrong."); } }}>Delete booking</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/60 text-xs text-slate-600">
                  <div>Showing <span className="font-semibold">{filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, filtered.length)}</span> of <span className="font-semibold">{filtered.length}</span> booking{filtered.length !== 1 ? "s" : ""}</div>
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="mx-1 text-[11px]">Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span></span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editBooking} onOpenChange={(o) => !o && setEditBooking(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit booking</DialogTitle></DialogHeader>
          {editBooking?.id && <EditBookingForm apiUrl="" token={token()} booking={{ id: editBooking.id, status: editBooking.status, check_in_date: editBooking.check_in_date, check_out_date: editBooking.check_out_date, special_requests: editBooking.special_requests, deposit_paid: editBooking.deposit_paid, total_amount: editBooking.total_amount, balance_due: editBooking.balance_due }} onSuccess={() => { setLoading(true); fetchBookings(); }} onClose={() => setEditBooking(null)} />}
        </DialogContent>
      </Dialog>

      {/* Check-in dialog */}
      <AlertDialog open={!!checkInBooking} onOpenChange={(o) => !o && setCheckInBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm check-in?</AlertDialogTitle><AlertDialogDescription>This will mark the booking as <span className="font-semibold">Checked-In</span>. Early check-in fees apply automatically if before 2:00 PM.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Actual check-in time</label>
            <input type="datetime-local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} />
            {checkInBooking?.check_in_date && <p className="text-xs text-slate-500">Reserved: <span className="font-medium">{`${String(checkInBooking.check_in_date).slice(0, 10)} 14:00`}</span></p>}
            {(() => { const p = computeEarlyCheckInPreview(); return <p className={cn("text-xs", p.fee > 0 ? "text-slate-700" : "text-slate-500")}>Breakdown: <span className="font-semibold text-[#07008A]">₱{p.fee.toFixed(0)}</span> (<span className="font-mono">₱{p.rate.toFixed(0)}</span> × <span className="font-mono">{p.hoursEarly}</span> hour{p.hoursEarly !== 1 ? "s" : ""} early) — {p.reason}</p>; })()}
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { const b = checkInBooking; if (!b?.id) return; try { const actual = checkInAt ? new Date(checkInAt).toISOString() : new Date().toISOString(); const res = await api(`/api/bookings/${b.id}/check-in`, { method: "POST", body: JSON.stringify({ actual_check_in_at: actual }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error((data as { error?: string }).error || "Check-in failed."); return; } const fee = Number((data as { early_checkin_fee_applied?: number }).early_checkin_fee_applied || 0); toast.success(fee > 0 ? `Checked in. Early fee: ₱${fee.toFixed(0)}.` : "Checked in."); setCheckInBooking(null); setLoading(true); fetchBookings(); } catch { toast.error("Something went wrong."); } }}>Confirm check-in</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Check-out dialog */}
      <AlertDialog open={!!checkOutBooking} onOpenChange={(o) => !o && setCheckOutBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm check-out?</AlertDialogTitle><AlertDialogDescription>This will mark the booking as <span className="font-semibold">Checked-Out</span>. Late check-out fees apply automatically after 12:00 NN.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Actual check-out time</label>
            <input type="datetime-local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} />
            {checkOutBooking?.check_out_date && <p className="text-xs text-slate-500">Reserved: <span className="font-medium">{`${String(checkOutBooking.check_out_date).slice(0, 10)} 12:00`}</span></p>}
            {(() => { const p = computeLateCheckOutPreview(); return <p className={cn("text-xs", p.fee > 0 ? "text-slate-700" : "text-slate-500")}>Breakdown: <span className="font-semibold text-[#07008A]">₱{p.fee.toFixed(0)}</span> (<span className="font-mono">₱{p.rate.toFixed(0)}</span> × <span className="font-mono">{p.hoursLate}</span> hour{p.hoursLate !== 1 ? "s" : ""} late) — {p.reason}</p>; })()}
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white" onClick={async () => { const b = checkOutBooking; if (!b?.id) return; try { const actual = checkOutAt ? new Date(checkOutAt).toISOString() : new Date().toISOString(); const res = await api(`/api/bookings/${b.id}/check-out`, { method: "POST", body: JSON.stringify({ actual_check_out_at: actual }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error((data as { error?: string }).error || "Check-out failed."); return; } const fee = Number((data as { late_checkout_fee_applied?: number }).late_checkout_fee_applied || 0); toast.success(fee > 0 ? `Checked out. Late fee: ₱${fee.toFixed(0)}.` : "Checked out."); setCheckOutBooking(null); setLoading(true); fetchBookings(); } catch { toast.error("Something went wrong."); } }}>Confirm check-out</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
