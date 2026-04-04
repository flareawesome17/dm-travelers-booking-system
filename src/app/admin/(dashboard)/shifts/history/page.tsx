"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Clock, RefreshCcw, ChevronLeft, ChevronRight, Lock, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { adminFetchOrRedirect, requireAdminSession } from "@/lib/admin-client";

interface ShiftLog {
  id: string;
  date: string;
  status: string;
  closed_at: string | null;
  close_notes: string | null;
  total_income: number;
  total_expense: number;
  net_total: number;
  shifts: { id: string; name: string; start_time: string; end_time: string } | null;
}

interface Transaction {
  id: string;
  source: string;
  reference_id: string | null;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string | null;
  created_at: string;
}

interface DetailData {
  shift_log: ShiftLog;
  transactions: Transaction[];
  income_transactions: Transaction[];
  expense_transactions: Transaction[];
  summary: {
    total_income: number;
    total_expense: number;
    net_total: number;
    stored_net_total: number;
    has_discrepancy: boolean;
    transaction_count: number;
  };
}

export default function ShiftHistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ShiftLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await adminFetchOrRedirect(router, `/api/shifts/history?page=${page}&limit=${pagination.limit}`);
        if (!res.ok) throw new Error("Failed to load shift history");
        const json = await res.json();
        setLogs(json.data ?? []);
        setPagination(json.pagination);
      } catch {
        toast.error("Failed to fetch shift history");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const fetchDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await adminFetchOrRedirect(router, `/api/shifts/${id}/ledger`);
        if (!res.ok) throw new Error("Failed to load shift detail");
        setDetail(await res.json());
      } catch {
        toast.error("Failed to fetch shift detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAdminSession(router))) {
        setLoading(false);
        return;
      }
      fetchHistory(1);
    })();
  }, [fetchHistory]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/admin/shifts")} className="rounded-full shrink-0 mt-1 sm:mt-0 w-9 h-9 sm:w-10 sm:h-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight leading-tight">Shift Ledger History</h1>
            <p className="text-muted-foreground mt-1 text-sm">Review past shifts and their financial transactions</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchHistory(pagination.page)} className="rounded-full shrink-0 self-start sm:self-auto h-9 sm:h-10">
          <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[500px] w-full lg:col-span-1" />
          <Skeleton className="h-[500px] w-full lg:col-span-2 hidden lg:block" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Clock} title="No Shift History" description="No closed shifts found in the system yet." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          <Card className={`lg:col-span-1 shadow-xs border-slate-200 bg-white ${selectedLog ? 'hidden lg:block' : 'block'}`}>
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-5">
              <CardTitle className="text-md text-[#07008A]">Past Shifts</CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  onClick={() => { setSelectedLog(log.id); fetchDetail(log.id); }}
                  className={`p-4 cursor-pointer transition-colors ${selectedLog === log.id ? 'bg-[#07008A]/5 border-l-4 border-l-[#07008A]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{log.date}</span>
                      {log.status === "CLOSED" && log.closed_at && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Closed: {new Date(log.closed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <Badge variant={log.status === "CLOSED" ? "outline" : "default"} className="text-xs shrink-0 ml-2">
                      {log.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{log.shifts?.name || "Unknown Shift"}</div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-600 font-medium">+{log.total_income}</span>
                    <span className="text-amber-600 font-medium">-{log.total_expense}</span>
                    <span className="font-bold text-[#07008A]">Net: ₱{log.net_total}</span>
                  </div>
                </div>
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <div className="p-3 border-t bg-slate-50 flex justify-between items-center">
                <Button variant="ghost" size="sm" disabled={pagination.page <= 1} onClick={() => fetchHistory(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-500 font-medium">Page {pagination.page} of {pagination.totalPages}</span>
                <Button variant="ghost" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchHistory(pagination.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>

          <div className={`lg:col-span-2 ${!selectedLog ? 'hidden lg:block' : 'block'}`}>
            {!selectedLog ? (
              <Card className="h-full flex flex-col items-center justify-center text-slate-400 py-12 min-h-[400px] border-slate-200 shadow-xs">
                <Clock className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a shift to view ledger details</p>
              </Card>
            ) : detailLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : detail ? (
              <Card className="shadow-xs border-slate-200 bg-white h-full flex flex-col">
                <CardHeader className="bg-[#07008A] text-white p-6 relative overflow-hidden">
                  <div className="flex items-start gap-4 mb-4 relative z-10">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)} className="text-white hover:bg-white/20 lg:hidden shrink-0 -ml-2 -mt-1 h-8 w-8">
                       <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold tracking-wide">{detail.shift_log.date}</h2>
                        <p className="opacity-80 text-sm mt-1">{detail.shift_log.shifts?.name} Shift</p>
                        {detail.shift_log.status === "CLOSED" && detail.shift_log.closed_at && (
                          <p className="opacity-90 text-xs mt-1 text-emerald-200 font-mono tracking-tight">
                            Closed: {new Date(detail.shift_log.closed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {detail.shift_log.status === "CLOSED" ? (
                        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-100 border-emerald-500/30 ml-2">
                          <Lock className="h-3 w-3 mr-1" /> CLOSED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-100 border-amber-500/30 ml-2">
                          OPEN
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20 relative z-10">
                    <div>
                      <p className="text-xs text-white/60 mb-1">Total Inflows</p>
                      <p className="font-semibold text-emerald-300">₱{detail.summary.total_income.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 mb-1">Total Outflows</p>
                      <p className="font-semibold text-amber-300">₱{detail.summary.total_expense.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1 line-clamp-1">Net Expected</p>
                      <p className="font-bold text-lg">₱{detail.summary.net_total.toFixed(2)}</p>
                    </div>
                  </div>
                  {detail.summary.has_discrepancy && (
                    <div className="mt-4 bg-red-500/20 border border-red-500/30 p-2.5 rounded text-red-100 text-xs flex items-start gap-2">
                       <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> 
                       <div>
                         <span className="font-semibold block mb-0.5">Discrepancy detected</span>
                         The stored net total (₱{detail.summary.stored_net_total.toFixed(2)}) does not match the computed sum of transactions.
                       </div>
                    </div>
                  )}
                  {detail.shift_log.close_notes && (
                     <div className="mt-3 bg-white/10 p-2.5 rounded text-white text-xs">
                        <span className="font-semibold block mb-0.5">Closing Note:</span>
                        {detail.shift_log.close_notes}
                     </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                  <Tabs defaultValue="all" className="w-full">
                    <div className="p-3 border-b flex justify-between items-center bg-slate-50/50">
                      <TabsList>
                        <TabsTrigger value="all">All ({detail.transactions.length})</TabsTrigger>
                        <TabsTrigger value="income" className="text-emerald-600 data-[state=active]:text-emerald-700">Inflows ({detail.income_transactions.length})</TabsTrigger>
                        <TabsTrigger value="expense" className="text-amber-600 data-[state=active]:text-amber-700">Outflows ({detail.expense_transactions.length})</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    {['all', 'income', 'expense'].map((tab) => {
                      const txs = tab === 'all' ? detail.transactions : tab === 'income' ? detail.income_transactions : detail.expense_transactions;
                      
                      return (
                        <TabsContent key={tab} value={tab} className="m-0 p-0 outline-none">
                          {txs.length === 0 ? (
                            <div className="py-12">
                              {/* Removed borderless prop since it might throw error if EmptyState doesn't accept it. We'll rely on default EmptyState appearance */}
                              <EmptyState icon={Clock} title="No transactions" description="No transactions found for this shift." />
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {txs.map((t: any) => (
                                <div key={t.id} className="p-4 hover:bg-slate-50/50 flex justify-between items-start transition-colors">
                                  <div className="space-y-1 pr-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-white shrink-0">
                                        {t.source}
                                      </Badge>
                                      <span className="font-medium text-sm text-slate-800 line-clamp-2 leading-tight">{t.description}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono">
                                      Ref: {t.reference_id?.substring(0,8) || 'N/A'} • {new Date(t.created_at).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                  </div>
                                  <div className={`font-semibold text-right shrink-0 ${t.type==='INCOME' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {t.type==='INCOME'?'+':'-'} ₱{t.amount?.toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      )
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
