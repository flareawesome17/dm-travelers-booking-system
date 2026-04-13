"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/context/PermissionsContext";
import { getErrorMessage } from "@/lib/utils";
import { useRouter } from "next/navigation";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Banknote,
  Building2,
  Eye,
  Filter,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Undo2,
  Wallet,
} from "lucide-react";

type CashSummary = {
  cash_receipts_total: number;
  restaurant_cash_total: number;
  cash_expenses_total: number;
  approved_deposits_total: number;
  opening_adjustments_total: number;
  reversals_total: number;
  available_cash: number;
  pending_request_total: number;
  pending_request_count: number;
};

type CashBankAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  branch_label: string | null;
  is_active: boolean;
};

type CashDepositRequest = {
  id: string;
  amount: number;
  deposit_reference: string;
  deposited_at: string;
  bank_account_label: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  branch_label: string | null;
  note: string | null;
  status: string;
  approval_note: string | null;
  rejection_note: string | null;
  cancellation_note: string | null;
  reversal_reason: string | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function dt(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function compactBankDetails(...parts: Array<string | null | undefined>) {
  return parts.map((value) => String(value || "").trim()).filter(Boolean).join(" - ");
}

function statusClasses(status: string) {
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "cancelled") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "reversed") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

async function fileToPayload(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
  return { data, name: file.name, type: file.type };
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

export default function AdminCashPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("cash.read");
  const canRequest = hasPermission("cash.deposit.request");
  const canReverse = hasPermission("cash.deposit.reverse");
  const canManageAccounts = hasPermission("cash.bank_account.manage");
  const canAdjust = hasPermission("cash.adjust");

  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [deposits, setDeposits] = useState<CashDepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [editingAccount, setEditingAccount] = useState<CashBankAccount | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<CashDepositRequest | null>(null);

  const [bankName, setBankName] = useState("");
  const [accountIsActive, setAccountIsActive] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositAt, setDepositAt] = useState("");
  const [depositBankAccountId, setDepositBankAccountId] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositProofFile, setDepositProofFile] = useState<File | null>(null);

  const [reverseReason, setReverseReason] = useState("");
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
      const [summaryRes, accountsRes, depositsRes] = await Promise.all([
        fetch("/api/cash/summary", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/cash/bank-accounts", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/cash/deposits", { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const [summaryPayload, accountsPayload, depositsPayload] = await Promise.all([
        summaryRes.json().catch(() => ({})),
        accountsRes.json().catch(() => ({})),
        depositsRes.json().catch(() => ({})),
      ]);
      if (!summaryRes.ok) throw new Error(getErrorMessage(summaryPayload) || "Failed to load cash summary.");
      if (!accountsRes.ok) throw new Error(getErrorMessage(accountsPayload) || "Failed to load cash banks.");
      if (!depositsRes.ok) throw new Error(getErrorMessage(depositsPayload) || "Failed to load cash deposits.");
      setSummary(summaryPayload as CashSummary);
      setAccounts(Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts as CashBankAccount[] : []);
      setDeposits(Array.isArray(depositsPayload.deposits) ? depositsPayload.deposits as CashDepositRequest[] : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cash module.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRead, token]);

  useEffect(() => {
    if (!canRead) return;
    load();
  }, [canRead, load, router]);

  useEffect(() => {
    if (!depositDialogOpen) return;
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    setDepositAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setDepositBankAccountId(accounts.find((account) => account.is_active)?.id || "");
  }, [depositDialogOpen, accounts]);

  const recentDeposits = useMemo(
    () => deposits.filter((deposit) => deposit.status !== "rejected" && deposit.status !== "cancelled").slice(0, 3),
    [deposits],
  );
  const filteredDeposits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deposits.filter((deposit) => {
      if (statusFilter !== "all" && deposit.status !== statusFilter) return false;
      if (!q) return true;
      return [
        deposit.deposit_reference,
        deposit.bank_account_label,
        deposit.bank_name,
        deposit.account_name,
        deposit.account_number_masked,
        deposit.requested_by_name,
        deposit.approved_by_name,
        deposit.note,
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [deposits, search, statusFilter]);

  const resetAccountForm = () => {
    setEditingAccount(null);
    setBankName("");
    setAccountIsActive(true);
  };

  const openEditAccount = (account: CashBankAccount) => {
    setEditingAccount(account);
    setBankName(account.bank_name);
    setAccountIsActive(account.is_active);
    setAccountDialogOpen(true);
  };

  const saveBankAccount = async () => {
    const authToken = token();
    setSaving(true);
    try {
      const body = editingAccount
        ? { bank_name: bankName, is_active: accountIsActive }
        : { bank_name: bankName };
      const res = await fetch(editingAccount ? `/api/cash/bank-accounts/${editingAccount.id}` : "/api/cash/bank-accounts", {
        method: editingAccount ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to save bank.");
      toast.success(editingAccount ? "Bank updated." : "Bank created.");
      setAccountDialogOpen(false);
      resetAccountForm();
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save bank.");
    } finally {
      setSaving(false);
    }
  };

  const submitDepositRequest = async () => {
    if (!depositProofFile) {
      toast.error("Deposit proof is required.");
      return;
    }
    const authToken = token();
    setSaving(true);
    try {
      const proofRes = await fetch("/api/cash/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ file: await fileToPayload(depositProofFile) }),
      });
      const proofPayload = await proofRes.json().catch(() => ({}));
      if (!proofRes.ok) throw new Error(getErrorMessage(proofPayload) || "Failed to upload deposit proof.");

      const res = await fetch("/api/cash/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          amount: Number(depositAmount),
          bank_account_id: depositBankAccountId,
          deposit_reference: depositReference,
          deposited_at: new Date(depositAt).toISOString(),
          proof: (proofPayload as { proof: unknown }).proof,
          note: depositNote || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to record cash deposit.");
      toast.success("Cash deposit recorded.");
      setDepositDialogOpen(false);
      setDepositAmount("");
      setDepositReference("");
      setDepositAt("");
      setDepositBankAccountId("");
      setDepositNote("");
      setDepositProofFile(null);
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record cash deposit.");
    } finally {
      setSaving(false);
    }
  };

  const postAction = async (url: string, body: Record<string, unknown> | null, successMessage: string) => {
    const authToken = token();
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body || {}),
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

  const viewProof = async (depositId: string) => {
    const authToken = token();
    try {
      const res = await fetch(`/api/cash/deposits/${depositId}/proof`, { headers: { Authorization: `Bearer ${authToken}` } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to load deposit proof.");
      if (typeof payload.url !== "string") throw new Error("Signed proof URL was not returned.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load deposit proof.");
    }
  };

  if (!canRead) {
    return <div className="py-10"><EmptyState icon={Wallet} title="Cash module is restricted" description="You do not have permission to view hotel cash deposits and balances." /></div>;
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
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#07008A]/70">Cash Control</p>
          <h1 className="text-3xl font-black tracking-tight text-[#07008A]">Hotel Cash</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">Available cash only reflects cash receipts, cash expenses, recorded bank deposits, reversals, and the opening adjustment. Shift reports stay historical.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
          <Button variant="outline" className="sm:hidden" onClick={() => setFiltersOpen(true)}><Filter className="mr-2 h-4 w-4" />Filters</Button>
          {canManageAccounts ? <Button variant="outline" onClick={() => { resetAccountForm(); setAccountDialogOpen(true); }}><Building2 className="mr-2 h-4 w-4" />Add Bank</Button> : null}
          {canAdjust ? <Button variant="outline" onClick={() => setOpeningDialogOpen(true)}><Banknote className="mr-2 h-4 w-4" />Opening Adjustment</Button> : null}
          {canRequest ? <Button className="hidden bg-[#07008A] text-white hover:bg-[#05006a] sm:inline-flex" onClick={() => setDepositDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Bank Deposit</Button> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Available Cash" value={money(summary?.available_cash || 0)} helper="Official live physical cash after recorded bank deposits." emphasized />
        <SummaryCard label="Cash Receipts" value={money((summary?.cash_receipts_total || 0) + (summary?.restaurant_cash_total || 0))} helper={`Booking cash ${money(summary?.cash_receipts_total || 0)} + restaurant cash ${money(summary?.restaurant_cash_total || 0)}.`} />
        <SummaryCard label="Cash Expenses" value={money(summary?.cash_expenses_total || 0)} helper="Only expenses marked as cash reduce the balance." />
        <SummaryCard label="Bank Deposited" value={money(summary?.approved_deposits_total || 0)} helper={`Recorded deposits already removed from cash on hand. Reversals added back ${money(summary?.reversals_total || 0)}.`} />
        <SummaryCard label="Opening Adjustment" value={money(summary?.opening_adjustments_total || 0)} helper="Use this once to align the module with actual counted cash." />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Recent Deposits</CardTitle><CardDescription>Recorded deposits reflect in available cash immediately.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {recentDeposits.length === 0 ? <EmptyState title="No recorded deposits yet" description="Record a bank deposit to start the running history." borderless /> : recentDeposits.map((deposit) => (
              <article key={deposit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{deposit.bank_account_label}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{money(Number(deposit.amount || 0))}</h3>
                    <p className="mt-1 text-sm text-slate-500">{compactBankDetails(deposit.bank_name, deposit.account_number_masked) || deposit.bank_name}</p>
                  </div>
                  <Badge variant="outline" className={statusClasses(deposit.status)}>{deposit.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Deposit Ref</p><p className="mt-1 text-sm font-medium text-slate-800">{deposit.deposit_reference}</p></div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Deposited At</p><p className="mt-1 text-sm font-medium text-slate-800">{dt(deposit.deposited_at)}</p></div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Recorded By</p><p className="mt-1 text-sm font-medium text-slate-800">{deposit.requested_by_name || "Unknown"}</p></div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-[#07008A] hover:bg-transparent" onClick={() => viewProof(deposit.id)}><Eye className="mr-2 h-4 w-4" />View Proof</Button></div>
                </div>
                {deposit.note ? <p className="mt-3 text-sm leading-6 text-slate-600">{deposit.note}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {canReverse && deposit.status === "approved" ? <Button variant="outline" onClick={() => { setSelectedDeposit(deposit); setReverseDialogOpen(true); }} disabled={saving}><Undo2 className="mr-2 h-4 w-4" />Reverse Deposit</Button> : null}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Saved Banks</CardTitle><CardDescription>Pick from these banks when recording a deposit.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {accounts.length === 0 ? <EmptyState title="No banks yet" description="Create a bank before recording a deposit." borderless /> : accounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{account.bank_name}</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{account.bank_name}</h3>
                    {compactBankDetails(account.account_name, account.account_number_masked, account.branch_label) ? <p className="mt-1 text-sm text-slate-500">{compactBankDetails(account.account_name, account.account_number_masked, account.branch_label)}</p> : <p className="mt-1 text-sm text-slate-500">Bank name only</p>}
                  </div>
                  <Badge variant="outline" className={account.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}>{account.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                {canManageAccounts ? <div className="mt-4"><Button variant="outline" size="sm" onClick={() => openEditAccount(account)}><Pencil className="mr-2 h-4 w-4" />Edit Bank</Button></div> : null}
              </article>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><CardTitle>Deposit History</CardTitle><CardDescription>Immutable history of recorded deposits, reversals, and any older workflow records.</CardDescription></div>
            <div className="hidden gap-2 sm:flex">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, bank, recorder..." className="w-[260px]" />
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="reversed">Reversed</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredDeposits.length === 0 ? <EmptyState title="No matching deposit history" description="Try clearing filters or record a new bank deposit." borderless /> : filteredDeposits.map((deposit) => (
            <article key={deposit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{deposit.bank_account_label}</p>
                    {(deposit.status === "approved" || deposit.status === "reversed") ? <span className="rounded-full bg-[#07008A]/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#07008A]">Immutable</span> : null}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{money(Number(deposit.amount || 0))}</h3>
                  <p className="mt-1 text-sm text-slate-500">{compactBankDetails(deposit.bank_name, deposit.account_number_masked) || deposit.bank_name}</p>
                </div>
                <Badge variant="outline" className={statusClasses(deposit.status)}>{deposit.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Deposit Ref</p><p className="mt-1 text-sm font-medium text-slate-800">{deposit.deposit_reference}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Deposited At</p><p className="mt-1 text-sm font-medium text-slate-800">{dt(deposit.deposited_at)}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Recorded By</p><p className="mt-1 text-sm font-medium text-slate-800">{deposit.requested_by_name || "Unknown"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Status Note</p><p className="mt-1 text-sm font-medium text-slate-800">{deposit.status === "reversed" ? "Deposit reversed" : deposit.status === "approved" ? "Recorded directly" : deposit.status.replace(/_/g, " ")}</p></div>
              </div>
              {deposit.note ? <p className="mt-3 text-sm leading-6 text-slate-600">{deposit.note}</p> : null}
              {deposit.approval_note ? <p className="mt-2 text-sm leading-6 text-emerald-700">Approval note: {deposit.approval_note}</p> : null}
              {deposit.rejection_note ? <p className="mt-2 text-sm leading-6 text-rose-700">Rejected: {deposit.rejection_note}</p> : null}
              {deposit.cancellation_note ? <p className="mt-2 text-sm leading-6 text-slate-600">Cancelled: {deposit.cancellation_note}</p> : null}
              {deposit.reversal_reason ? <p className="mt-2 text-sm leading-6 text-violet-700">Reversal: {deposit.reversal_reason}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => viewProof(deposit.id)}><Eye className="mr-2 h-4 w-4" />View Proof</Button>
                {(deposit.status === "approved" && canReverse) ? <Button variant="outline" size="sm" onClick={() => { setSelectedDeposit(deposit); setReverseDialogOpen(true); }}><Undo2 className="mr-2 h-4 w-4" />Reverse Deposit</Button> : null}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      {canRequest ? <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden"><Button className="h-12 w-full bg-[#07008A] text-white hover:bg-[#05006a]" onClick={() => setDepositDialogOpen(true)}><Landmark className="mr-2 h-4 w-4" />Record Bank Deposit</Button></div> : null}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Filter Deposit History</SheetTitle><SheetDescription>Refine the visible deposit history list.</SheetDescription></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="cash-search-mobile">Search</Label><Input id="cash-search-mobile" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, bank, recorder..." /></div>
            <div className="space-y-2"><Label htmlFor="cash-status-mobile">Status</Label><select id="cash-status-mobile" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="reversed">Reversed</option></select></div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Record Bank Deposit</DialogTitle><DialogDescription>This records the deposit immediately and updates available cash at once. Proof stays attached for traceability.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="deposit-amount">Amount</Label><Input id="deposit-amount" type="number" min="0" step="0.01" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="deposit-bank-account">Bank</Label><select id="deposit-bank-account" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={depositBankAccountId} onChange={(event) => setDepositBankAccountId(event.target.value)}><option value="">Select a bank</option>{accounts.filter((account) => account.is_active).map((account) => <option key={account.id} value={account.id}>{compactBankDetails(account.bank_name, account.account_number_masked) || account.bank_name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="deposit-reference">Deposit Reference</Label><Input id="deposit-reference" value={depositReference} onChange={(event) => setDepositReference(event.target.value)} placeholder="Bank slip or deposit number" /></div>
            <div className="space-y-2"><Label htmlFor="deposit-at">Deposited At</Label><Input id="deposit-at" type="datetime-local" value={depositAt} onChange={(event) => setDepositAt(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="deposit-proof">Proof Attachment</Label><Input id="deposit-proof" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf" onChange={(event) => setDepositProofFile(event.target.files?.[0] ?? null)} /><p className="text-xs text-slate-500">Deposit slip or proof file is required.</p></div>
            <div className="space-y-2"><Label htmlFor="deposit-note">Note</Label><Textarea id="deposit-note" value={depositNote} onChange={(event) => setDepositNote(event.target.value)} rows={4} placeholder="Optional internal note for this deposit" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Close</Button><Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={submitDepositRequest} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}Record Deposit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountDialogOpen} onOpenChange={(open) => { setAccountDialogOpen(open); if (!open) resetAccountForm(); }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingAccount ? "Edit Bank" : "Add Bank"}</DialogTitle><DialogDescription>Bank name is enough for now. Extra account details can be added later without changing historical deposits.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="cash-bank-name">Bank Name</Label><Input id="cash-bank-name" value={bankName} onChange={(event) => setBankName(event.target.value)} /></div>
            {editingAccount ? <div className="space-y-2"><Label htmlFor="cash-is-active">Status</Label><select id="cash-is-active" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={accountIsActive ? "active" : "inactive"} onChange={(event) => setAccountIsActive(event.target.value === "active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></div> : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Close</Button><Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={saveBankAccount} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}Save Bank</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Opening Cash Adjustment</DialogTitle><DialogDescription>Use this once at go-live to align the new cash module with the real counted cash balance.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="space-y-2"><Label htmlFor="opening-amount">Opening Amount</Label><Input id="opening-amount" type="number" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="opening-note">Note</Label><Textarea id="opening-note" value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} rows={4} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpeningDialogOpen(false)}>Close</Button><Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={async () => { const ok = await postAction("/api/cash/opening-adjustment", { amount: Number(openingAmount), note: openingNote || null }, "Opening cash adjustment posted."); if (ok) { setOpeningDialogOpen(false); setOpeningAmount(""); setOpeningNote(""); } }} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}Post Adjustment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reverseDialogOpen} onOpenChange={(open) => { setReverseDialogOpen(open); if (!open) { setSelectedDeposit(null); setReverseReason(""); } }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Reverse Approved Deposit</DialogTitle><DialogDescription>This keeps the original approved record immutable and posts a separate reversal entry.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="reverse-reason">Reversal Reason</Label><Textarea id="reverse-reason" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} rows={4} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setReverseDialogOpen(false)}>Close</Button><Button onClick={async () => { if (!selectedDeposit) return; const ok = await postAction(`/api/cash/deposits/${selectedDeposit.id}/reverse`, { reversal_reason: reverseReason }, "Cash deposit reversed."); if (ok) { setReverseDialogOpen(false); setSelectedDeposit(null); setReverseReason(""); } }} disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}Post Reversal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
