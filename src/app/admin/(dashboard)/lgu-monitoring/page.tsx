"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Banknote, Building2, Search, CalendarCheck, FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type BookingRow = {
  id: string;
  reference_number?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  total_amount?: number;
  deposit_paid?: number;
  balance_due?: number;
  is_lgu_booking?: boolean;
  guests?: { full_name?: string; email?: string; phone_number?: string };
  rooms?: { room_number?: string; room_type?: string };
  created_at: string;
};

type SummaryData = {
  totalCollectibles: number;
  lguCollectibles: number;
  regularCollectibles: number;
};

export default function LguMonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData>({ totalCollectibles: 0, lguCollectibles: 0, regularCollectibles: 0 });
  const [lguBookings, setLguBookings] = useState<BookingRow[]>([]);
  const [regularBookings, setRegularBookings] = useState<BookingRow[]>([]);
  
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const router = useRouter();

  const fetchCollectibles = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    
    setLoading(true);
    fetch("/api/admin/collectibles", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) setSummary(data.summary);
        if (data.data) {
          setLguBookings(data.data.lgu || []);
          setRegularBookings(data.data.regular || []);
        }
      })
      .catch((e) => console.error("Failed to load collectibles.", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCollectibles();
  }, [router]);

  // For the table, we'll focus mostly on LGU bookings 
  const filteredLguBookings = lguBookings.filter((b) => {
    const term = search.toLowerCase();
    if (!term) return true;
    const haystack = [
      b.reference_number,
      b.guests?.full_name,
      b.guests?.email,
      b.rooms?.room_number,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredLguBookings.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedLguBookings = filteredLguBookings.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  return (
    <div className="space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Collectibles & LGU Monitoring</h1>
        <p className="text-muted-foreground mt-1 text-sm">Forecast outstanding balances and track LGU bookings with delayed payments.</p>
      </motion.div>

      {/* Collectibles Forecast Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-[#07008A]/10 text-[#07008A]">
                  <Banknote className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-md border-slate-200">Total Collectibles</Badge>
              </div>
              <p className="text-3xl font-bold text-slate-800">₱{summary.totalCollectibles.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">From all active bookings</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-[#07008A] to-[#04005c] text-white hover:shadow-lg transition-all transform hover:-translate-y-0.5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <Badge className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-white border-white/20 hover:bg-white/20" variant="outline">
                  LGU Bookings
                </Badge>
              </div>
              <p className="text-3xl font-extrabold tracking-tight">₱{summary.lguCollectibles.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-white/80 mt-1 font-medium flex items-center gap-1">
                Outstanding LGU receivables
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-md border-emerald-100 text-emerald-700 bg-emerald-50">Regular Bookings</Badge>
              </div>
              <p className="text-3xl font-bold text-emerald-700">₱{summary.regularCollectibles.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">From non-LGU guests</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LGU Tracking Table */}
      <Card className="border-0 shadow-lg bg-white overflow-hidden mt-8">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#07008A]" /> 
              Active LGU Bookings
            </CardTitle>
            <CardDescription className="opacity-80 mt-1">Detailed list of all LGU bookings with outstanding balances.</CardDescription>
          </div>
          <div className="relative w-full sm:max-w-[280px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search reference, guest name..." 
              className="h-10 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all font-medium shadow-sm transition-shadow hover:shadow-md" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      {["Guest & Reference", "Room", "Stay Dates", "Status", "Total", "Balance Due"].map((h) => (
                        <th key={h} className={`py-4 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${h.includes('Total') || h.includes('Balance') ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLguBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center bg-white">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                              <FileText className="h-6 w-6" />
                            </div>
                            <p className="text-base font-semibold text-slate-700">No active LGU bookings</p>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">There are currently no active LGU bookings with outstanding balances to display.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedLguBookings.map((b) => (
                        <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50/70 transition-colors group">
                          <td className="py-4 px-6 align-middle">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-[13px]">{b.guests?.full_name ?? "—"}</span>
                              <span className="font-mono text-xs text-[#07008A] font-medium mt-0.5">{b.reference_number ?? "—"}</span>
                              <span className="mt-1.5 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 w-fit border border-blue-100">LGU</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 align-middle">
                            <span className="font-semibold text-slate-700">{b.rooms?.room_number ? `Rm ${b.rooms.room_number}` : "—"}</span>
                          </td>
                          <td className="py-4 px-6 align-middle text-xs text-slate-600 whitespace-nowrap">
                            <div className="flex flex-col gap-1 inline-flex">
                              <span className="flex items-center justify-between w-[120px]">
                                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">In</span>
                                <span className="font-medium text-slate-700">{b.check_in_date ?? "—"}</span>
                              </span>
                              <span className="flex items-center justify-between w-[120px]">
                                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Out</span> 
                                <span className="font-medium text-slate-700">{b.check_out_date ?? "—"}</span>
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 align-middle whitespace-nowrap">
                            <Badge variant="outline" className={`capitalize shadow-sm ${b.status === 'Checked-In' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                              {b.status ?? "—"}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 align-middle text-right">
                            <span className="font-medium text-slate-600">₱{Number(b.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="py-4 px-6 align-middle text-right">
                            <span className="font-bold text-[#07008A] text-sm bg-[#07008A]/5 px-2.5 py-1 rounded-lg">
                              ₱{Number(b.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {filteredLguBookings.length > 0 && (
                <div className="py-4 px-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                  <span className="text-sm font-medium text-slate-500">
                    Showing {filteredLguBookings.length === 0 ? 0 : (activePage - 1) * itemsPerPage + 1} to {Math.min(activePage * itemsPerPage, filteredLguBookings.length)} of {filteredLguBookings.length} LGU bookings
                  </span>
                  <Pagination className="justify-end w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={activePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink onClick={() => setCurrentPage(i + 1)} isActive={activePage === i + 1} className="cursor-pointer">
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={activePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
