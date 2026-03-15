"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Calendar, Lock, Unlock, Plus, Wallet, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Ledger = {
  id: string;
  date: string;
  status: "open" | "closed";
  total_income?: number;
  total_expense?: number;
  net_total?: number;
  closed_at?: string | null;
};

type Tx = {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  occurred_at?: string | null;
  source_table?: string | null;
};

function manilaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function AdminLedgerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(manilaDateString());
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [incomeTx, setIncomeTx] = useState<Tx[]>([]);
  const [expenseTx, setExpenseTx] = useState<Tx[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [openAdd, setOpenAdd] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [savingTx, setSavingTx] = useState(false);

  const [openClose, setOpenClose] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMaskedTo, setOtpMaskedTo] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const isToday = date === manilaDateString();
  const confirmPhrase = `CLOSE ${date}`;

  const totals = useMemo(() => {
    const totalIncome = Number(ledger?.total_income || 0);
    const totalExpense = Number(ledger?.total_expense || 0);
    const netTotal = Number(ledger?.net_total || 0);
    return { totalIncome, totalExpense, netTotal };
  }, [ledger]);

  const fetchLedger = useCallback(async (targetDate: string) => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    setRefreshing(true);
    try {
      const today = manilaDateString();
      const url = targetDate === today ? "/api/ledger/current" : `/api/ledger/${targetDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load ledger.");

      const l = payload.ledger;
      setLedger(l);
      setIncomeTx(Array.isArray(payload.income_transactions) ? payload.income_transactions : []);
      setExpenseTx(Array.isArray(payload.expense_transactions) ? payload.expense_transactions : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load ledger.");
      setLedger(null);
      setIncomeTx([]);
      setExpenseTx([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchLedger(date);
  }, [date, fetchLedger]);

  const requestOtp = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    setOtpSending(true);
    try {
      const res = await fetch("/api/ledger/close/request-otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to send OTP.");
      setOtpMaskedTo(payload?.to || null);
      setOtpExpiresAt(payload?.expires_at || null);
      toast.success("OTP sent.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const confirmCloseDay = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    if (confirmText.trim() !== confirmPhrase) {
      toast.error(`Type "${confirmPhrase}" to confirm.`);
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/ledger/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to close the day.");
      toast.success("Day closed successfully.");
      setOpenClose(false);
      setOtp("");
      setConfirmText("");
      setOtpMaskedTo(null);
      setOtpExpiresAt(null);
      setDate(manilaDateString());
      await fetchLedger(manilaDateString());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to close the day.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txCategory.trim() || !txDescription.trim()) {
      toast.error("Category and description are required.");
      return;
    }
    const amount = Number(txAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    setSavingTx(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/ledger/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: txType,
          category: txCategory.trim(),
          description: txDescription.trim(),
          amount,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to add transaction.");
      toast.success("Transaction added.");
      setOpenAdd(false);
      setTxCategory("");
      setTxDescription("");
      setTxAmount("");
      await fetchLedger(date);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add transaction.");
    } finally {
      setSavingTx(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Daily Closing</h1>
          <p className="text-muted-foreground mt-1 text-sm">Close the day to lock all transactions and finalize totals.</p>
        </motion.div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              className="h-7 border-0 p-0 text-sm focus-visible:ring-0"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <Button variant="outline" size="sm" className="h-9" onClick={() => fetchLedger(date)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 bg-[#07008A] hover:bg-[#05006a] text-white" disabled={!isToday || ledger?.status === "closed"}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20 focus:border-[#07008A]"
                    value={txType}
                    onChange={(e) => setTxType(e.target.value === "expense" ? "expense" : "income")}
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-category">Category</Label>
                  <Input id="tx-category" value={txCategory} onChange={(e) => setTxCategory(e.target.value)} placeholder="e.g. Other Income" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-desc">Description</Label>
                  <Input id="tx-desc" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="Write a clear description..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-amount">Amount (₱)</Label>
                  <Input id="tx-amount" type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a] text-white" disabled={savingTx}>
                    {savingTx ? "Saving..." : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openClose} onOpenChange={(o) => {
            setOpenClose(o);
            if (!o) {
              setOtp("");
              setConfirmText("");
              setOtpMaskedTo(null);
              setOtpExpiresAt(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!isToday || ledger?.status === "closed"}
              >
                <Lock className="h-4 w-4 mr-2" />
                Close Day
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>End of Day Closing</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Date</span>
                    <span className="font-semibold">{date}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mt-1">
                    <span>Total income</span>
                    <span className="font-bold text-emerald-700">₱{totals.totalIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mt-1">
                    <span>Total expenses</span>
                    <span className="font-bold text-red-600">₱{totals.totalExpense.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mt-1 pt-2 border-t">
                    <span>Net total</span>
                    <span className="font-extrabold text-[#07008A]">₱{totals.netTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  This action is not reversible. Once closed, today’s transactions will be locked.
                </div>

                <div className="space-y-2">
                  <Label>Step 1: Send OTP</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={requestOtp} disabled={otpSending}>
                      {otpSending ? "Sending..." : "Send OTP to Email"}
                    </Button>
                  </div>
                  {(otpMaskedTo || otpExpiresAt) && (
                    <p className="text-xs text-slate-500">
                      Sent to {otpMaskedTo ?? "your email"}{otpExpiresAt ? ` · Expires at ${new Date(otpExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Step 2: Enter OTP</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-text">Step 3: Type confirmation</Label>
                  <Input
                    id="confirm-text"
                    placeholder={confirmPhrase}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500">Type exactly: {confirmPhrase}</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpenClose(false)}>Cancel</Button>
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={confirmCloseDay}
                    disabled={otpVerifying}
                  >
                    {otpVerifying ? "Closing..." : "Confirm Close Day"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">Income</Badge>
                </div>
                <p className="text-2xl font-bold text-emerald-600">₱{totals.totalIncome.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total income for {date}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-red-50 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">Expense</Badge>
                </div>
                <p className="text-2xl font-bold text-red-600">₱{totals.totalExpense.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total expenses for {date}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-[#07008A] text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-white/20 text-white">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <Badge className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-white border-white/20" variant="outline">
                    Net
                  </Badge>
                </div>
                <p className="text-2xl font-bold">₱{totals.netTotal.toLocaleString()}</p>
                <p className="text-xs text-white/70 mt-1">Net total</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#07008A]" />
                  Daily Ledger
                </CardTitle>
                <CardDescription className="text-xs">
                  Status:{" "}
                  {ledger?.status === "closed" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <Lock className="h-3 w-3" /> Closed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                      <Unlock className="h-3 w-3" /> Open
                    </span>
                  )}
                  {ledger?.closed_at ? ` · Closed at ${new Date(ledger.closed_at).toLocaleString()}` : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="income">
                <TabsList className="bg-slate-100 border p-1 mb-4">
                  <TabsTrigger value="income" className="text-xs">Income ({incomeTx.length})</TabsTrigger>
                  <TabsTrigger value="expense" className="text-xs">Expenses ({expenseTx.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="income">
                  {incomeTx.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No income transactions for this date.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-slate-50/60">
                          <tr>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="py-3 px-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {incomeTx.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-xs text-slate-500">
                                {t.occurred_at ? new Date(t.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-slate-700">{t.category}</td>
                              <td className="py-3 px-4 text-xs text-slate-600">{t.description}</td>
                              <td className="py-3 px-4 text-right text-xs font-bold text-emerald-700">₱{Number(t.amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="expense">
                  {expenseTx.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No expense transactions for this date.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-slate-50/60">
                          <tr>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="py-3 px-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {expenseTx.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-xs text-slate-500">
                                {t.occurred_at ? new Date(t.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-slate-700">{t.category}</td>
                              <td className="py-3 px-4 text-xs text-slate-600">{t.description}</td>
                              <td className="py-3 px-4 text-right text-xs font-bold text-red-600">₱{Number(t.amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

