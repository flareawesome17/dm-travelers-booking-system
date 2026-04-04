"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, KeyRound, ArrowUpRight, ArrowDownRight, RefreshCcw, ShieldAlert, CheckCircle2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloseShiftModal } from "@/components/admin/shifts/CloseShiftModal";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/ui/empty-state";

export default function ShiftsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    
    try {
      const res = await fetch("/api/shifts/current", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load shift");
      setData(await res.json());
    } catch {
      toast.error("Failed to fetch shift data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Shift Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor current active shift ledger and closeouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/shifts/history")} className="rounded-full text-[#07008A] border-[#07008A]/20 hover:bg-[#07008A]/5 hidden sm:flex">
            <History className="mr-2 h-4 w-4" /> View History
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/shifts/history")} className="rounded-full text-[#07008A] border-[#07008A]/20 hover:bg-[#07008A]/5 sm:hidden" size="icon">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={fetchData} className="rounded-full hidden sm:flex">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={fetchData} className="rounded-full sm:hidden" size="icon">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full max-w-2xl" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : data?.shift ? (
        <div className="space-y-6">
          
          <AnimatePresence>
            {data.warnings?.previous_shift_open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 mt-0.5 text-amber-600" />
                <div className="text-sm">
                  <span className="font-semibold block">Previous Shift Left Open!</span>
                  The ledger from the previous shift was not closed properly. Please investigate and close it manually in the backend to ensure accurate tracking.
                </div>
              </motion.div>
            )}

            {data.warnings?.is_overtime && data.shift_log.status !== "CLOSED" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-md flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 mt-0.5 text-rose-600 animate-pulse" />
                <div className="text-sm">
                  <span className="font-semibold block">Shift Overtime!</span>
                  This shift ledger has exceeded its scheduled time window. Please close the ledger immediately so the next shift can begin.
                </div>
              </motion.div>
            )}
            
            {data.warnings?.ending_soon && data.shift_log.status !== "CLOSED" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-start gap-3">
                <Clock className="h-5 w-5 mt-0.5 text-red-600 animate-pulse" />
                <div className="text-sm font-medium">
                  {data.warnings.ending_soon}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
              <div className="bg-[#07008A] p-6 text-white text-center">
                <h2 className="text-2xl font-bold tracking-wide">{data.shift.name} Shift</h2>
                <div className="opacity-80 text-sm mt-1">{data.shift.start_time.substring(0, 5)} - {data.shift.end_time.substring(0, 5)}</div>
                <div className="mt-4 flex justify-center">
                  <Badge variant="outline" className={`px-3 py-1 font-semibold border-white/30 ${data.shift_log.status === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/20 text-white'}`}>
                    {data.shift_log.status === "CLOSED" ? "LOCKED & CLOSED" : "OPEN & ACTIVE"}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Date</span>
                    <span className="font-semibold">{data.shift_log.date}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Time Remaining</span>
                    <span className="font-mono text-[#07008A]">{data.time.minutes_remaining} mins</span>
                  </div>
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4"/> Inflows</span>
                      <span className="font-semibold">₱{(data.totals.total_income || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-amber-600 flex items-center gap-1.5"><ArrowDownRight className="h-4 w-4"/> Outflows</span>
                      <span className="font-semibold">₱{(data.totals.total_expense || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <span className="text-sm font-bold text-slate-700">Net Expected</span>
                    <span className="font-bold text-lg text-[#07008A]">₱{(data.totals.net_total || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-8">
                  {data.shift_log.status !== "CLOSED" ? (
                    <Button onClick={() => setShowCloseModal(true)} className="w-full bg-red-600 hover:bg-red-700 h-12 text-md font-semibold" disabled={data.warnings?.previous_shift_open}>
                      <KeyRound className="mr-2 h-5 w-5"/> Close Ledger
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-3 rounded-md font-medium text-sm border border-emerald-100">
                      <CheckCircle2 className="h-5 w-5" /> Shift securely closed
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-200/80 shadow-xs bg-white h-full flex flex-col">
              <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
                <CardTitle className="text-lg font-semibold text-[#07008A]">Shift Transactions</CardTitle>
                <CardDescription>Live feed of financial movements bound to this shift.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                <Tabs defaultValue="all" className="w-full">
                  <div className="p-3 border-b flex justify-between items-center">
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="income" className="text-emerald-600 data-[state=active]:text-emerald-700">Inflows</TabsTrigger>
                      <TabsTrigger value="expense" className="text-amber-600 data-[state=active]:text-amber-700">Outflows</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  {['all', 'income', 'expense'].map((tab) => {
                    const txs = [...data.income_transactions, ...data.expense_transactions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const filtered = tab === 'all' ? txs : txs.filter(t => t.type.toLowerCase() === tab);

                    return (
                      <TabsContent key={tab} value={tab} className="m-0 p-0 outline-none">
                        {filtered.length === 0 ? (
                          <div className="py-12">
                            <EmptyState icon={Clock} title="No transactions yet" description="Transactions made during this shift will appear here." borderless />
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {filtered.map((t: any) => (
                              <div key={t.id} className="p-4 hover:bg-slate-50/50 flex justify-between items-start group transition-colors">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-white">
                                      {t.source}
                                    </Badge>
                                    <span className="font-medium text-sm text-slate-800">{t.description}</span>
                                  </div>
                                  <div className="text-xs text-slate-400 font-mono">
                                    Ref: {t.reference_id || 'N/A'} • {new Date(t.created_at).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}
                                  </div>
                                </div>
                                <div className={`font-semibold text-right ${t.type==='INCOME' ? 'text-emerald-600' : 'text-amber-600'}`}>
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
          </div>
        </div>
      ) : (
        <EmptyState icon={Clock} title="No Active Shift" description="Configure the shift schedule in Settings > Operations, or verify that the current time overlaps an active shift window." />
      )}

      {showCloseModal && (
        <CloseShiftModal 
          shiftLog={data?.shift_log} 
          onClose={() => setShowCloseModal(false)}
          onSuccess={fetchData}
        />
      )}
    </>
  );
}
