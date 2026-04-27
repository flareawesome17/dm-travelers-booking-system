"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarCheck, Plus, Pencil, Trash2, LogIn, LogOut, XCircle, Search, ChevronLeft, ChevronRight, Banknote, MoreHorizontal, CalendarPlus, Package, RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn, getErrorMessage } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { BookingForm } from "@/components/admin/bookings/BookingForm";
import { EditBookingForm } from "@/components/admin/bookings/EditBookingForm";
import { RecordPaymentModal } from "@/components/admin/bookings/RecordPaymentModal";
import { ReceiptModal } from "@/components/admin/bookings/ReceiptModal";
import { CountdownTimer } from "@/components/admin/bookings/CountdownTimer";
import { ExtendStayModal } from "@/components/admin/bookings/ExtendStayModal";
import { ManageExtrasModal } from "@/components/admin/bookings/ManageExtrasModal";
import { AddExtraChargeModal } from "@/components/admin/bookings/AddExtraChargeModal";
import { BookingAnalyticsStrip } from "@/components/admin/bookings/BookingAnalyticsStrip";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import {
  filterAdminBookings,
  getFiltersForBookingAnalyticsCard,
  type BookingAnalyticsCardKey,
  type BookingAnalyticsSummary,
  type BookingDateScope,
} from "@/lib/bookingAnalytics";
import { getBookingChargeBreakdown } from "@/lib/bookingTotals";
import { usePermissions } from "@/context/PermissionsContext";
import {
  AdminConfirmDialog,
  AdminModal,
  AdminModalBody,
  AdminModalHeader,
  AdminModalTitle,
  AdminPanelCard,
  AdminPanelCardContent,
  AdminPanelCardHeader,
  AdminPanelCardTitle,
} from "@/components/admin/ui";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default", "pending payment": "secondary", "pending verification": "secondary",
  "checked-in": "default", "checked-out": "outline", cancelled: "destructive", "no show": "destructive",
};

function getStatusVariant(status?: string) {
  if (!status) return "secondary" as const;
  return statusVariant[String(status).toLowerCase()] ?? ("secondary" as const);
}

type BookingRow = {
  id?: string; reference_number?: string; status?: string; room_id?: string;
  check_in_date?: string; check_out_date?: string; restaurant_orders?: { 
    id: string; 
    total_amount: number; 
    status: string;
    restaurant_order_items?: {
      name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[];
  }[]; booking_extras?: {
    id: string; extra_type: string; custom_label?: string | null; quantity: number; unit_price: number; total_price: number;
  }[]; actual_check_in_at?: string; actual_check_out_at?: string;
  total_amount?: number; deposit_paid?: number; balance_due?: number; restaurant_charges_total?: number;
  extras_total?: number; extensions_total?: number;
  rate_plan_kind?: string; special_requests?: string | null;
  early_checkin_fee_applied?: number; late_checkout_fee_applied?: number;
  is_lgu_booking?: boolean; is_special_booking?: boolean; special_booking_label?: string | null;
  booking_source?: string;
  external_reference?: string | null;
  guests?: { full_name?: string; email?: string; phone_number?: string };
  rooms?: {
    room_number?: string; room_type?: string; status?: string;
    rate_24h_early_checkin_fee?: number | null; rate_24h_late_checkout_fee?: number | null;
    rate_12h_late_checkout_fee?: number | null; rate_5h_late_checkout_fee?: number | null;
    rate_3h_late_checkout_fee?: number | null;
  } | null;
};

export default function AdminBookingsPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("bookings.create");
  const canUpdate = hasPermission("bookings.update");
  const canDelete = hasPermission("bookings.delete");
  const canRecordPayment = hasPermission("payments.create");

  const [list, setList] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingRow | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<BookingRow | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<BookingRow | null>(null);
  const [extendBooking, setExtendBooking] = useState<BookingRow | null>(null);
  const [extrasBooking, setExtrasBooking] = useState<BookingRow | null>(null);
  const [extraChargeBooking, setExtraChargeBooking] = useState<BookingRow | null>(null);
  const [cancelBooking, setCancelBooking] = useState<BookingRow | null>(null);
  const [deleteBooking, setDeleteBooking] = useState<BookingRow | null>(null);
  const [checkInBooking, setCheckInBooking] = useState<BookingRow | null>(null);
  const [checkInAt, setCheckInAt] = useState<string>("");
  const [checkOutBooking, setCheckOutBooking] = useState<BookingRow | null>(null);
  const [checkOutAt, setCheckOutAt] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateScope, setDateScope] = useState<BookingDateScope>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [summary, setSummary] = useState<BookingAnalyticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const pageSize = 10;
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const token = () => localStorage.getItem("admin_token") || "";

  const api = (path: string, options?: RequestInit) =>
    fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...options?.headers },
    });

  const fetchBookings = useCallback(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) return;
    setLoading(true);
    fetch("/api/bookings", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchSummary = useCallback(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) return;
    setSummaryLoading(true);
    setSummaryError(false);
    fetch("/api/bookings/summary", { headers: { Authorization: `Bearer ${t}` } })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load booking analytics.");
        setSummary(data);
      })
      .catch(() => {
        setSummary(null);
        setSummaryError(true);
      })
      .finally(() => setSummaryLoading(false));
  }, []);

  const refreshData = useCallback(() => {
    fetchBookings();
    fetchSummary();
  }, [fetchBookings, fetchSummary]);

  const handleCancelBooking = async () => {
    const booking = cancelBooking;
    if (!booking?.id) return;

    try {
      const res = await api(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Cancelled" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to cancel.");
        return;
      }
      toast.success("Booking cancelled.");
      setCancelBooking(null);
      refreshData();
    } catch {
      toast.error("Something went wrong.");
    }
  };

  const handleDeleteBooking = async () => {
    const booking = deleteBooking;
    if (!booking?.id) return;

    try {
      const res = await api(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed.");
        return;
      }
      toast.success("Deleted.");
      setDeleteBooking(null);
      refreshData();
    } catch {
      toast.error("Something went wrong.");
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) { router.replace("/admin/login"); return; }
    refreshData();
  }, [refreshData, router]);
 
  useEffect(() => {
    if (highlightId && !loading) {
      // Small delay to ensure the row is rendered and the list is stable
      const timer = setTimeout(() => {
        const el = document.getElementById(`booking-row-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("animate-highlight-amber");
          // Remove class after animation finishes (4s)
          setTimeout(() => {
            el.classList.remove("animate-highlight-amber");
          }, 4500);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading]);

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
    const tzOffset = localStorage.getItem("app_timezone_offset") || "+08:00";
    const reserved = checkInDateStr ? new Date(`${checkInDateStr}T14:00:00${tzOffset}`) : new Date("");
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
    let reserved: Date;

    const tzOffset = localStorage.getItem("app_timezone_offset") || "+08:00";
    if (rateKind === "24h") {
      const checkOutDateStr = String(b.check_out_date || "").slice(0, 10);
      if (!checkOutDateStr) return { rate: 0, hoursLate: 0, fee: 0, reason: "Check-out date is not set." as const };
      reserved = new Date(`${checkOutDateStr}T12:00:00${tzOffset}`);
    } else {
      const hoursToAdd = parseInt(rateKind.replace(/\D/g, ""), 10) || 0;
      if (b.actual_check_in_at) {
        reserved = new Date(b.actual_check_in_at);
        reserved.setHours(reserved.getHours() + hoursToAdd);
      } else {
        const fallbackCheckIn = b.check_in_date ? String(b.check_in_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
        reserved = new Date(`${fallbackCheckIn}T14:00:00${tzOffset}`);
        reserved.setHours(reserved.getHours() + hoursToAdd);
      }
    }

    if (Number.isNaN(reserved.getTime())) return { rate: 0, hoursLate: 0, fee: 0, reason: "Reserved check-out time is not set correctly." as const };
    let rate = 0;
    if (rateKind === "24h") rate = Number(b.rooms?.rate_24h_late_checkout_fee || 0);
    else if (rateKind === "12h") rate = Number(b.rooms?.rate_12h_late_checkout_fee || 0);
    else if (rateKind === "5h") rate = Number(b.rooms?.rate_5h_late_checkout_fee || 0);
    else if (rateKind === "3h") rate = Number(b.rooms?.rate_3h_late_checkout_fee || 0);
    if (!Number.isFinite(rate) || rate <= 0) return { rate: 0, hoursLate: 0, fee: 0, reason: "No late check-out fee rate is set for this room." } as const;
    if (actual <= reserved) return { rate, hoursLate: 0, fee: 0, reason: "Not late (on or before reserved time)." as const };
    const diffMs = actual.getTime() - reserved.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    // Add 30-minute grace period per hour. 
    // Example: 1h 30m delay = 1 hour charge, 1h 31m delay = 2 hours charge.
    if (diffMinutes <= 30) {
      return { rate, hoursLate: 0, fee: 0, reason: "Within 30-minute grace period." as const };
    }

    const hoursLate = Math.ceil((diffMinutes - 30) / 60);
    return { rate, hoursLate, fee: rate * hoursLate, reason: "Late check-out detected." as const };
  };

  const filtered = filterAdminBookings({
    bookings: list,
    statusFilter,
    typeFilter,
    search,
    dateScope,
    today: summary?.today || new Date().toISOString().slice(0, 10),
    timezone: summary?.timezone,
  }) as BookingRow[];

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    if (dateScope === "today" && value !== "Checked-In" && value !== "Checked-Out") {
      setDateScope("all");
    }
    setPage(1);
  };

  const handleAnalyticsCardClick = (key: BookingAnalyticsCardKey) => {
    const nextFilters = getFiltersForBookingAnalyticsCard(key);
    if (!nextFilters) return;
    setStatusFilter(nextFilters.statusFilter);
    setTypeFilter(nextFilters.typeFilter);
    setDateScope(nextFilters.dateScope);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filtered.slice(startIndex, endIndex);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage reservations and check-in dates</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
        <BookingAnalyticsStrip
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          onCardClick={handleAnalyticsCardClick}
        />
      </motion.div>
      <AdminPanelCard>
        <AdminPanelCardHeader className="items-center">
          <div className="flex items-center gap-3">
            <AdminPanelCardTitle className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]"><CalendarCheck className="h-5 w-5" /></div>
              <span>All Bookings</span>
            </AdminPanelCardTitle>
            <span className="hidden sm:inline-block ml-1 text-xs font-medium rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{filtered.length} filtered / {list.length} total</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="rounded-full px-4 text-slate-600 border-slate-200" onClick={refreshData} disabled={loading || summaryLoading}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (loading || summaryLoading) && "animate-spin")} />
              Refresh
            </Button>
            {canCreate && (
              <Dialog open={open} onOpenChange={setOpen}>
                <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New booking
                </Button>
                <AdminModal size="xl">
                  <AdminModalHeader><AdminModalTitle>Add new booking</AdminModalTitle></AdminModalHeader>
                  <AdminModalBody>
                  <BookingForm apiUrl="" token={typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : ""} onSuccess={() => { refreshData(); }} onClose={() => setOpen(false)} />
                  </AdminModalBody>
                </AdminModal>
              </Dialog>
            )}
          </div>
        </AdminPanelCardHeader>
        <AdminPanelCardContent className="px-0 py-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b bg-slate-50/60 gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search reference, guest name, email, room..." className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all font-medium" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {dateScope === "today" && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-700 transition-colors hover:bg-emerald-100"
                  onClick={() => { setDateScope("all"); setPage(1); }}
                >
                  Today
                  <span className="text-sm leading-none">×</span>
                </button>
              )}
              <select 
                className="h-9 w-full sm:w-[160px] rounded-md border border-input bg-white px-3 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all cursor-pointer" 
                value={typeFilter} 
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="all">All Types</option>
                <option value="normal">Normal Booking</option>
                <option value="lgu">LGU Booking</option>
                <option value="special">Special Booking</option>
                <option value="booking.com">Booking.com</option>
              </select>
              <select 
                className="h-9 w-full sm:w-[160px] rounded-md border border-input bg-white px-3 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all cursor-pointer" 
                value={statusFilter} 
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
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
          </div>
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              <div className="responsive-table-wrapper overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] w-full custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm ring-1 ring-slate-100">
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Guest & Reference", "Room & Rate", "Stay Dates", "Billing", "Status", "Actions"].map((h) => (
                      <th key={h} className={`${h === "Actions" ? "text-right pr-6 w-16" : "text-left"} py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${h === "Guest & Reference" ? "pl-6" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 bg-white">
                        <EmptyState 
                          icon={CalendarCheck} 
                          title="No bookings found" 
                          description={search || statusFilter !== "all" || typeFilter !== "all" || dateScope !== "all" ? "We couldn't find any bookings matching your current filters." : "You have no bookings yet. Add one to get started."}
                          action={
                            search || statusFilter !== "all" || typeFilter !== "all" || dateScope !== "all" ? (
                              <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setDateScope("all"); setPage(1); }}>Reset Filters</Button>
                            ) : canCreate ? (
                              <Button className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => setOpen(true)}>
                                <Plus className="h-4 w-4 mr-1" /> New booking
                              </Button>
                            ) : null
                          }
                          borderless
                        />
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((b) => (
                      <tr 
                        key={b.id || b.reference_number || Math.random()} 
                        id={b.id ? `booking-row-${b.id}` : undefined}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                      >
                      <td className="py-4 px-6 align-top">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-sm">{b.guests?.full_name ?? "—"}</span>
                          <span className="font-mono text-[11px] text-[#07008A]">{b.reference_number ?? "—"}</span>
                          {b.guests?.email && <span className="text-slate-500 text-[11px] truncate max-w-[140px] mt-0.5">{b.guests.email}</span>}
                          {b.is_lgu_booking && <span className="mt-1.5 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700 w-fit border border-blue-100">LGU Booking</span>}
                          {b.is_special_booking && (
                            <span className="mt-1.5 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700 w-fit border border-amber-100">
                              {b.special_booking_label?.trim() || "Special Booking"}
                            </span>
                          )}
                          {b.booking_source && b.booking_source !== "Walk-in" && (
                            <span className="mt-1.5 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700 w-fit border border-blue-100">
                              {b.booking_source}{b.external_reference ? ` · ${b.external_reference}` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs">
                        <div className="flex flex-col gap-1.5">
                           <span className="font-medium text-slate-700">{b.rooms?.room_number ? `Room ${b.rooms.room_number}` : "—"}{b.rooms?.room_type && <span className="font-normal text-slate-500"> ({b.rooms.room_type})</span>}</span>
                           {b.rate_plan_kind && <span className="inline-flex items-center rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] w-fit font-medium text-slate-700 border border-slate-200">{b.rate_plan_kind}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs text-slate-600 whitespace-nowrap">
                         <div className="flex flex-col gap-1 items-start">
                           <span><span className="text-slate-400 text-[10px] uppercase font-semibold mr-1">In</span> {b.check_in_date ?? "—"}</span>
                           <span><span className="text-slate-400 text-[10px] uppercase font-semibold mr-1">Out</span> {b.check_out_date ?? "—"}</span>
                           {b.status === "Checked-In" && (
                             <CountdownTimer 
                                checkInDateStr={b.check_in_date} 
                                checkOutDateStr={b.check_out_date} 
                                actualCheckInAt={b.actual_check_in_at} 
                                ratePlanKind={b.rate_plan_kind} 
                                tzOffset={localStorage.getItem("app_timezone_offset") || "+08:00"}
                             />
                           )}
                         </div>
                      </td>
                      <td className="py-4 px-4 align-top text-xs">
                         <div className="flex flex-col gap-1.5 w-max">
                           <div className="flex items-center gap-2">
                             {(() => {
                               const total = getBookingChargeBreakdown(b).grandTotal;
                               const deposit = Number(b.deposit_paid ?? 0);
                               const balance = Number(b.balance_due ?? 0);
                               return (
                                 <>
                                   <span className="font-semibold text-[#07008A] text-sm">₱{total.toFixed(2)}</span>
                                   {!total ? null : balance < 0.01 && total > 0 ? (
                                     <span className="inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 border border-emerald-100">Paid full</span>
                                   ) : deposit > 0 && balance >= 0.01 ? (
                                     <span className="inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 border border-amber-100">Partial</span>
                                   ) : (
                                     <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 border border-slate-200">Unpaid</span>
                                   )}
                                 </>
                               );
                             })()}
                           </div>
                           {Number(b.restaurant_charges_total || 0) > 0 && (
                             <span className="text-[10px] text-amber-700 font-medium">+ ₱{Number(b.restaurant_charges_total || 0).toFixed(2)} Restaurant</span>
                           )}
                           {Number(b.extras_total || 0) > 0 && (
                             <span className="text-[10px] text-blue-700 font-medium">+ PHP {Number(b.extras_total || 0).toFixed(2)} Extras</span>
                           )}
                           {Number(b.extensions_total || 0) > 0 && (
                             <span className="text-[10px] text-violet-700 font-medium">+ PHP {Number(b.extensions_total || 0).toFixed(2)} Extension</span>
                           )}
                           {(Number(b.balance_due) > 0 || Number(b.deposit_paid) > 0) && (
                             <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                               {Number(b.deposit_paid) > 0 && <span>Dep: ₱{Number(b.deposit_paid).toFixed(2)}</span>}
                               {Number(b.balance_due) > 0 && <span className="font-medium text-amber-700">Bal: ₱{Number(b.balance_due).toFixed(2)}</span>}
                             </div>
                           )}
                           {((Number(b.early_checkin_fee_applied) || 0) > 0 || (Number(b.late_checkout_fee_applied) || 0) > 0) && (
                             <span className="text-[10px] text-slate-400 mt-0.5">
                               {[(Number(b.early_checkin_fee_applied) || 0) > 0 && `+₱${Number(b.early_checkin_fee_applied).toFixed(2)} Early`, (Number(b.late_checkout_fee_applied) || 0) > 0 && `+₱${Number(b.late_checkout_fee_applied).toFixed(2)} Late`].filter(Boolean).join(", ")}
                             </span>
                           )}
                         </div>
                      </td>
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {b.status === "Checked-In" && <span className="relative inline-flex h-2 w-2 mt-0.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
                          <Badge variant={getStatusVariant(b.status)} className="capitalize shrink-0">{b.status ?? "—"}</Badge>
                        </div>
                      </td>
                      <td className="py-4 px-6 align-top text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 focus-visible:ring-0 rounded-full">
                               <span className="sr-only">Open menu</span>
                               <MoreHorizontal className="h-4 w-4 text-slate-600" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setReceiptBooking(b)} className="text-slate-700 focus:text-slate-900 focus:bg-slate-100 cursor-pointer text-sm font-medium">
                                🧾 View Receipt
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {canRecordPayment && Number(b.balance_due || 0) > 0 && b.status !== "Cancelled" && (
                                <DropdownMenuItem onClick={() => setPaymentBooking(b)} className="text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer text-sm">
                                  <Banknote className="mr-2 h-4 w-4" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              {canUpdate && b.status !== "Checked-Out" && b.status !== "Cancelled" && (
                                <DropdownMenuItem onClick={() => setEditBooking(b)} className="cursor-pointer text-[#07008A] focus:text-[#07008A] focus:bg-[#07008A]/10 text-sm">
                                  <Pencil className="mr-2 h-4 w-4" /> Edit Details
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canUpdate && b.status !== "Checked-In" && b.status !== "Checked-Out" && b.status !== "Cancelled" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    const roomStatus = b.rooms?.status;
                                    if (!roomStatus) {
                                      toast.error("No room assigned. Assign a room before check-in.");
                                      return;
                                    }
                                    if (roomStatus !== "Available") {
                                      toast.error(`Room is not ready for check-in. Current status: ${roomStatus}.`);
                                      return;
                                    }
                                    setCheckInBooking(b);
                                  }}
                                  className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 cursor-pointer text-sm"
                                >
                                  <LogIn className="mr-2 h-4 w-4" /> Check In Guest
                                </DropdownMenuItem>
                              )}
                              {canUpdate && b.status === "Checked-In" && (
                                <DropdownMenuItem onClick={() => setCheckOutBooking(b)} className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 cursor-pointer text-sm">
                                  <LogOut className="mr-2 h-4 w-4" /> Check Out Guest
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />

                              {/* NEW ENTERPRISE FEATURES */}
                              {canUpdate && b.status === "Checked-In" && (
                                <DropdownMenuItem onClick={() => setExtendBooking(b)} className="text-violet-600 focus:text-violet-700 focus:bg-violet-50 cursor-pointer text-sm">
                                  <CalendarPlus className="mr-2 h-4 w-4" /> Extend Stay
                                </DropdownMenuItem>
                              )}
                              {canUpdate && b.status !== "Cancelled" && (
                                <DropdownMenuItem onClick={() => setExtrasBooking(b)} className="text-blue-600 focus:text-blue-700 focus:bg-blue-50 cursor-pointer text-sm">
                                  <Package className="mr-2 h-4 w-4" /> Manage Extras
                                </DropdownMenuItem>
                              )}
                              {canUpdate && b.status !== "Cancelled" && (
                                <DropdownMenuItem onClick={() => setExtraChargeBooking(b)} className="text-pink-600 focus:text-pink-700 focus:bg-pink-50 cursor-pointer text-sm">
                                  <Plus className="mr-2 h-4 w-4" /> Add Extra Charge
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              {canUpdate && b.status !== "Checked-In" && b.status !== "Checked-Out" && b.status !== "Cancelled" && (
                                <DropdownMenuItem onClick={() => setCancelBooking(b)} className="text-red-500 focus:text-red-500 focus:bg-red-50 cursor-pointer text-sm">
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel Booking
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem onClick={() => setDeleteBooking(b)} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer text-sm">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
                                </DropdownMenuItem>
                              )}
                           </DropdownMenuContent>
                         </DropdownMenu>
                      </td>
                      </tr>
                    )
                  ))
                }
              </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500">
                <div>Showing <span className="font-semibold">{filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, filtered.length)}</span> of <span className="font-semibold">{filtered.length}</span> booking{filtered.length !== 1 ? "s" : ""}</div>
                <div className="inline-flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-3 w-3" /></Button>
                  <span className="mx-1 text-[11px]">Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span></span>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
            </>
          )}
        </AdminPanelCardContent>
      </AdminPanelCard>

      {/* Edit dialog */}
      <Dialog open={!!editBooking} onOpenChange={(o) => { if (!o) setEditBooking(null); }}>
        <AdminModal size="md">
          <AdminModalHeader><AdminModalTitle>Edit booking</AdminModalTitle></AdminModalHeader>
          <AdminModalBody>
          {editBooking?.id && <EditBookingForm apiUrl="" token={token()} booking={editBooking as any} onSuccess={() => { refreshData(); }} onClose={() => setEditBooking(null)} />}
          </AdminModalBody>
        </AdminModal>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={!!paymentBooking} onOpenChange={(o) => { if (!o) setPaymentBooking(null); }}>
        <AdminModal size="md">
          <AdminModalHeader>
            <AdminModalTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Record Payment
            </AdminModalTitle>
          </AdminModalHeader>
          <AdminModalBody>
          {paymentBooking && (
            <RecordPaymentModal 
              booking={paymentBooking as any}
              onSuccess={() => { setPaymentBooking(null); refreshData(); }}
              onClose={() => setPaymentBooking(null)}
            />
          )}
          </AdminModalBody>
        </AdminModal>
      </Dialog>

      <ConfirmActionDialog
        open={!!cancelBooking}
        onOpenChange={(open) => { if (!open) setCancelBooking(null); }}
        title="Cancel this booking?"
        description={(
          <>
            This will mark booking{" "}
            <span className="font-semibold text-slate-800">
              {cancelBooking?.reference_number || "this booking"}
            </span>
            {" "}as cancelled. Use this only if the reservation should no longer proceed.
          </>
        )}
        confirmLabel="Cancel Booking"
        onConfirm={handleCancelBooking}
      />

      <AdminConfirmDialog
        open={!!deleteBooking}
        onOpenChange={(open) => { if (!open) setDeleteBooking(null); }}
        title="Delete this booking?"
        description={(
          <>
            This will permanently delete booking{" "}
            <span className="font-semibold text-slate-800">
              {deleteBooking?.reference_number || "this booking"}
            </span>
            . This action cannot be undone.
          </>
        )}
        confirmLabel="Delete booking"
        onConfirm={handleDeleteBooking}
      />

      <AdminConfirmDialog
        open={!!checkInBooking}
        onOpenChange={(open) => { if (!open) setCheckInBooking(null); }}
        title="Confirm check-in?"
        description={<>This will mark the booking as <span className="font-semibold">Checked-In</span>. Early check-in fees apply automatically if before 2:00 PM.</>}
        confirmLabel="Confirm check-in"
        confirmClassName="bg-emerald-600 text-white hover:bg-emerald-700"
        intent="neutral"
        onConfirm={async () => { const b = checkInBooking; if (!b?.id) return; try { const tzOffset = localStorage.getItem("app_timezone_offset") || "+08:00"; const actual = checkInAt ? new Date(`${checkInAt}${tzOffset}`).toISOString() : new Date().toISOString(); const res = await api(`/api/bookings/${b.id}/check-in`, { method: "POST", body: JSON.stringify({ actual_check_in_at: actual }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error(getErrorMessage(data) || "Check-in failed."); return; } const fee = Number((data as { early_checkin_fee_applied?: number }).early_checkin_fee_applied || 0); toast.success(fee > 0 ? `Checked in. Early fee: ₱${fee.toFixed(2)}.` : "Checked in."); setCheckInBooking(null); refreshData(); } catch { toast.error("Something went wrong."); } }}
      >
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Actual check-in time</label>
            <input type="datetime-local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} />
            {checkInBooking?.check_in_date && <p className="text-xs text-slate-500">Reserved: <span className="font-medium">{`${String(checkInBooking.check_in_date).slice(0, 10)} 14:00`}</span></p>}
            {(() => { const p = computeEarlyCheckInPreview(); return <p className={cn("text-xs", p.fee > 0 ? "text-slate-700" : "text-slate-500")}>Breakdown: <span className="font-semibold text-[#07008A]">₱{p.fee.toFixed(2)}</span> (<span className="font-mono">₱{p.rate.toFixed(2)}</span> × <span className="font-mono">{p.hoursEarly}</span> hour{p.hoursEarly !== 1 ? "s" : ""} early) — {p.reason}</p>; })()}
          </div>
        
      </AdminConfirmDialog>

      <AdminConfirmDialog
        open={!!checkOutBooking}
        onOpenChange={(open) => { if (!open) setCheckOutBooking(null); }}
        title="Confirm check-out?"
        description={<>This will mark the booking as <span className="font-semibold">Checked-Out</span>. Late check-out fees apply automatically after the designated checkout time.</>}
        confirmLabel="Confirm check-out"
        confirmClassName="bg-amber-600 text-white hover:bg-amber-700"
        intent="warning"
        onConfirm={async () => { const b = checkOutBooking; if (!b?.id) return; try { const tzOffset = localStorage.getItem("app_timezone_offset") || "+08:00"; const actual = checkOutAt ? new Date(`${checkOutAt}${tzOffset}`).toISOString() : new Date().toISOString(); const res = await api(`/api/bookings/${b.id}/check-out`, { method: "POST", body: JSON.stringify({ actual_check_out_at: actual }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { toast.error(getErrorMessage(data) || "Check-out failed."); return; } const fee = Number((data as { late_checkout_fee_applied?: number }).late_checkout_fee_applied || 0); toast.success(fee > 0 ? `Checked out. Late fee: ₱${fee.toFixed(2)}.` : "Checked out."); setCheckOutBooking(null); refreshData(); } catch { toast.error("Something went wrong."); } }}
      >
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Actual check-out time</label>
            <input type="datetime-local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} />
            {checkOutBooking && (
              <p className="text-xs text-slate-500">
                Expected checkout: <span className="font-medium">
                  {(() => {
                    const rateKind = checkOutBooking.rate_plan_kind || "24h";
                    if (rateKind === "24h") return `${String(checkOutBooking.check_out_date || "").slice(0, 10)} 12:00 PM`;
                    const hoursToAdd = parseInt(rateKind.replace(/\D/g, ""), 10) || 0;
                    let exp = new Date();
                    if (checkOutBooking.actual_check_in_at) {
                      exp = new Date(checkOutBooking.actual_check_in_at);
                    } else {
                      const fallbackCheckInStr = String(checkOutBooking.check_in_date || "").slice(0, 10);
                      const tzOffset = localStorage.getItem("app_timezone_offset") || "+08:00";
                      exp = new Date(`${fallbackCheckInStr}T14:00:00${tzOffset}`);
                    }
                    exp.setHours(exp.getHours() + hoursToAdd);
                    if (isNaN(exp.getTime())) return "Unknown";
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const ampm = exp.getHours() >= 12 ? "PM" : "AM";
                    const h12 = exp.getHours() % 12 || 12;
                    return `${exp.getFullYear()}-${pad(exp.getMonth() + 1)}-${pad(exp.getDate())} ${pad(h12)}:${pad(exp.getMinutes())} ${ampm}`;
                  })()}
                </span>
              </p>
            )}
            {(() => { const p = computeLateCheckOutPreview(); return <p className={cn("text-xs", p.fee > 0 ? "text-slate-700" : "text-slate-500")}>Breakdown: <span className="font-semibold text-[#07008A]">₱{p.fee.toFixed(2)}</span> (<span className="font-mono">₱{p.rate.toFixed(2)}</span> × <span className="font-mono">{p.hoursLate}</span> hour{p.hoursLate !== 1 ? "s" : ""} late) — {p.reason}</p>; })()}
          </div>
        
      </AdminConfirmDialog>

      {/* Receipt Modal */}
      <ReceiptModal 
        booking={receiptBooking} 
        onClose={() => setReceiptBooking(null)} 
      />

      {/* Enterprise Feature: Extend Stay */}
      {extendBooking?.id && (
        <ExtendStayModal
          open={!!extendBooking}
          onClose={() => setExtendBooking(null)}
          booking={extendBooking as any}
          token={token()}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}

      {/* Enterprise Feature: Manage Extras */}
      {extrasBooking?.id && (
        <ManageExtrasModal
          open={!!extrasBooking}
          onClose={() => setExtrasBooking(null)}
          onSuccess={() => {
            refreshData();
          }}
          booking={extrasBooking as any}
          token={token()}
        />
      )}

      {extraChargeBooking?.id && (
        <AddExtraChargeModal
          open={!!extraChargeBooking}
          onClose={() => setExtraChargeBooking(null)}
          onSuccess={() => {
            refreshData();
          }}
          booking={extraChargeBooking as any}
          token={token()}
        />
      )}
    </>
  );
}
