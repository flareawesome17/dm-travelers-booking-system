"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/context/PermissionsContext";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, Loader2, Plus, RefreshCw, Smartphone, WalletCards } from "lucide-react";

type GcashSummary = {
  booking_gcash_total: number;
  restaurant_gcash_total: number;
  receivable_gcash_total: number;
  gcash_expenses_total: number;
  manual_cash_in_total: number;
  manual_load_total: number;
  service_charges_total: number;
  opening_adjustments_total: number;
  available_gcash: number;
};

type GcashTransaction = {
  id: string;
  direction: string;
  entry_type: string;
  amount: number;
  service_charge: number;
  effective_at: string;
  transaction_reference: string | null;
  customer_name: string | null;
  recipient_number: string | null;
  description: string | null;
  note: string | null;
  performed_by_name: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dt(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateCharge(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount / 1000) * 20;
}

function entryLabel(type: string) {
  if (type === "cash_in") return "Cash-In";
  if (type === "load") return "Load";
  if (type === "opening_adjustment") return "Opening Adjustment";
  return type.replace(/_/g, " ");
}

function SummaryCard({ label, value, helper, emphasized = false }: { label: string; value: string; helper: string; emphasized?: boolean }) {
  return (
    <Card className={emphasized ? "border-[#07008A]/20 bg-[#07008A] text-white shadow-lg" : "border-slate-200 shadow-sm"}>
      <CardContent className="p-5">
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${emphasized ? "text-white/70" : "text-slate-400"}`}>{label}</p>
        <p className={`mt-3 text-3xl font-black tracking-tight ${emphasized ? "text-white" : "text-[#07008A]"}`}>{value}</p>
        <p className={`mt-2 text-sm leading-5 ${emphasized ? "text-white/80" : "text-slate-500"}`}>{helper}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminGcashPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("gcash.read");
  const canTransact = hasPermission("gcash.transact");
  const canAdjust = hasPermission("gcash.adjust");

  const [summary, setSummary] = useState<GcashSummary | null>(null);
  const [transactions, setTransactions] = useState<GcashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);

  const [transactionType, setTransactionType] = useState<"cash_in" | "load">("cash_in");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [note, setNote] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNote, setOpeningNote] = useState("");

  const token = useCallback(() => localStorage.getItem("admin_token") || "", []);

  const load = useCallback(async (spin = false) => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    if (spin) setRefreshing(true);
    else setLoading(true);

    try {
      const authToken = token();
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch("/api/gcash/summary", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/gcash/transactions", { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const [summaryPayload, transactionsPayload] = await Promise.all([
        summaryRes.json().catch(() => ({})),
        transactionsRes.json().catch(() => ({})),
      ]);
      if (!summaryRes.ok) throw new Error(getErrorMessage(summaryPayload) || "Failed to load GCash summary.");
      if (!transactionsRes.ok) throw new Error(getErrorMessage(transactionsPayload) || "Failed to load GCash transactions.");
      setSummary(summaryPayload as GcashSummary);
      setTransactions(Array.isArray(transactionsPayload.transactions) ? transactionsPayload.transactions as GcashTransaction[] : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load GCash module.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRead, token]);

  useEffect(() => {
    if (!canRead) return;
    load();
  }, [canRead, load]);

  const parsedAmount = Number(amount || 0);
  const charge = calculateCharge(parsedAmount);
  const recentTransactions = useMemo(() => transactions.slice(0, 8), [transactions]);

  const resetTransactionForm = () => {
    setTransactionType("cash_in");
    setAmount("");
    setReference("");
    setCustomerName("");
    setRecipientNumber("");
    setNote("");
  };

  const postAction = async (url: string, body: Record<string, unknown>, successMessage: string) => {
    const authToken = token();
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Request failed.");
      toast.success(successMessage);
      await load(true);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitTransaction = async () => {
    const ok = await postAction(
      "/api/gcash/transactions",
      {
        transaction_type: transactionType,
        amount: Number(amount),
        transaction_reference: reference || null,
        customer_name: customerName || null,
        recipient_number: recipientNumber || null,
        note: note || null,
      },
      "GCash transaction posted.",
    );
    if (ok) {
      setTransactionDialogOpen(false);
      resetTransactionForm();
    }
  };

  if (!canRead) {
    return <div className="py-10"><EmptyState icon={Smartphone} title="GCash module is restricted" description="You do not have permission to view GCash balances and transactions." /></div>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 lg:pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#07008A]/70">Wallet Control</p>
          <h1 className="text-3xl font-black tracking-tight text-[#07008A]">GCash</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">Balance includes tagged GCash collections, direct receivable GCash payments, GCash expenses, opening adjustment, and manual cash-in/load outflows.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
          {canAdjust ? <Button variant="outline" onClick={() => setOpeningDialogOpen(true)}><Banknote className="mr-2 h-4 w-4" />Opening Adjustment</Button> : null}
          {canTransact ? <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={() => setTransactionDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Transaction</Button> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Available GCash" value={money(summary?.available_gcash || 0)} helper="Live wallet balance after tagged inflows and posted outflows." emphasized />
        <SummaryCard label="Tagged Payments" value={money((summary?.booking_gcash_total || 0) + (summary?.restaurant_gcash_total || 0) + (summary?.receivable_gcash_total || 0))} helper={`Bookings ${money(summary?.booking_gcash_total || 0)} + restaurant ${money(summary?.restaurant_gcash_total || 0)} + AR ${money(summary?.receivable_gcash_total || 0)}.`} />
        <SummaryCard label="Cash-In Outflow" value={money(summary?.manual_cash_in_total || 0)} helper="Customer cash-in principal deducted from GCash." />
        <SummaryCard label="Load Outflow" value={money(summary?.manual_load_total || 0)} helper="Customer load principal deducted from GCash." />
        <SummaryCard label="Service Fees" value={money(summary?.service_charges_total || 0)} helper={`PHP 20 per 1-1000 tier. GCash expenses ${money(summary?.gcash_expenses_total || 0)}.`} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>GCash Ledger</CardTitle>
          <CardDescription>Manual wallet adjustments and customer cash-in/load transactions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentTransactions.length === 0 ? <EmptyState title="No GCash ledger entries yet" description="Post an opening adjustment or record a customer transaction to start the ledger." borderless /> : recentTransactions.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={entry.direction === "credit" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>{entry.direction}</Badge>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{entryLabel(entry.entry_type)}</p>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{money(Number(entry.amount || 0))}</h3>
                  <p className="mt-1 text-sm text-slate-500">{entry.customer_name || entry.recipient_number || entry.transaction_reference || entry.description || "GCash entry"}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium text-slate-900">{dt(entry.effective_at)}</p>
                  <p className="mt-1 text-xs text-slate-500">By {entry.performed_by_name || "Unknown"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reference</p><p className="mt-1 text-sm font-medium text-slate-800">{entry.transaction_reference || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Recipient</p><p className="mt-1 text-sm font-medium text-slate-800">{entry.recipient_number || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Service Fee</p><p className="mt-1 text-sm font-medium text-slate-800">{money(Number(entry.service_charge || 0))}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Customer Pays</p><p className="mt-1 text-sm font-medium text-slate-800">{money(Number(entry.amount || 0) + Number(entry.service_charge || 0))}</p></div>
              </div>
              {entry.note ? <p className="mt-3 text-sm leading-6 text-slate-600">{entry.note}</p> : null}
            </article>
          ))}
        </CardContent>
      </Card>

      <Dialog open={transactionDialogOpen} onOpenChange={(open) => { setTransactionDialogOpen(open); if (!open) resetTransactionForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record GCash Transaction</DialogTitle>
            <DialogDescription>Cash-in and load both deduct the principal from the hotel GCash wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gcash-type">Transaction Type</Label>
              <select id="gcash-type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={transactionType} onChange={(event) => setTransactionType(event.target.value as "cash_in" | "load")}>
                <option value="cash_in">Cash-In</option>
                <option value="load">Load</option>
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="gcash-amount">Amount</Label><Input id="gcash-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Charge</p><p className="mt-1 text-sm font-semibold text-slate-900">{money(charge)}</p></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Customer Pays</p><p className="mt-1 text-sm font-semibold text-slate-900">{money((Number.isFinite(parsedAmount) ? parsedAmount : 0) + charge)}</p></div>
            </div>
            <div className="space-y-2"><Label htmlFor="gcash-recipient">Recipient GCash Number</Label><Input id="gcash-recipient" value={recipientNumber} onChange={(event) => setRecipientNumber(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="gcash-customer">Customer Name</Label><Input id="gcash-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="gcash-reference">Reference Number</Label><Input id="gcash-reference" value={reference} onChange={(event) => setReference(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="gcash-note">Note</Label><Textarea id="gcash-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>Close</Button>
            <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={submitTransaction} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletCards className="mr-2 h-4 w-4" />}Post Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Opening GCash Adjustment</DialogTitle>
            <DialogDescription>Use this once to align the module with the actual GCash wallet balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="gcash-opening-amount">Opening Amount</Label><Input id="gcash-opening-amount" type="number" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="gcash-opening-note">Note</Label><Textarea id="gcash-opening-note" value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningDialogOpen(false)}>Close</Button>
            <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={async () => { const ok = await postAction("/api/gcash/opening-adjustment", { amount: Number(openingAmount), note: openingNote || null }, "Opening GCash adjustment posted."); if (ok) { setOpeningDialogOpen(false); setOpeningAmount(""); setOpeningNote(""); } }} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}Post Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
