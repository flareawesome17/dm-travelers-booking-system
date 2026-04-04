"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Landmark, Loader2, RefreshCw, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";

type TreasuryDestination = {
  id: string;
  label: string;
  provider: "instapay" | "pesonet";
  institution_name: string;
  institution_code: string;
  account_name: string;
  account_number_masked: string;
  is_active: boolean;
};

type TreasuryWithdrawal = {
  id: string;
  amount: number;
  status: string;
  destination_label: string;
  destination_provider?: string | null;
  destination_institution_name?: string | null;
  destination_account_masked?: string | null;
  external_reference?: string | null;
  failure_message?: string | null;
  paymongo_wallet_transaction_id?: string | null;
  paymongo_transfer_id?: string | null;
  paymongo_reference_number?: string | null;
  paymongo_status?: string | null;
  paymongo_provider_error?: string | null;
  submitted_at?: string | null;
  last_synced_at?: string | null;
  requested_at: string;
  approved_at?: string | null;
};

type TreasuryEntry = {
  id: string;
  direction: "credit" | "debit";
  entry_type: string;
  amount: number;
  external_payment_id?: string | null;
  payment_intent_id?: string | null;
  created_at: string;
};

type TreasurySummary = {
  hotel_collected_gross: number;
  hotel_collected_net: number;
  paymongo_fees: number;
  completed_withdrawals: number;
  pending_withdrawals: number;
  ledger_balance: number;
  withdrawable_amount: number;
  entries: TreasuryEntry[];
  withdrawals: TreasuryWithdrawal[];
  destinations: TreasuryDestination[];
};

type ReceivingInstitution = {
  code: string;
  name: string;
  provider: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);
}

function providerLabel(value: string | null | undefined) {
  return value === "instapay" ? "InstaPay" : value === "pesonet" ? "PESONet" : "Unknown";
}

function dt(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminTreasuryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<TreasuryWithdrawal | null>(null);
  const [destinationLabel, setDestinationLabel] = useState("");
  const [provider, setProvider] = useState<"instapay" | "pesonet">("instapay");
  const [institutions, setInstitutions] = useState<ReceivingInstitution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionCode, setInstitutionCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [completionNote, setCompletionNote] = useState("");

  const load = useCallback(async (spin = false) => {
    const token = localStorage.getItem("admin_token");
    
    if (spin) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/treasury/summary", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to load treasury summary.");
      setSummary(payload as TreasurySummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load treasury summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!destinationOpen) return;

    const token = localStorage.getItem("admin_token");
    

    let cancelled = false;
    setInstitutionsLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/treasury/receiving-institutions?provider=${provider}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to load institutions.");
        if (!cancelled) {
          const nextRows = Array.isArray(payload.institutions) ? payload.institutions as ReceivingInstitution[] : [];
          setInstitutions(nextRows);
          setInstitutionCode((current) => (nextRows.some((item) => item.code === current) ? current : ""));
        }
      } catch (error) {
        if (!cancelled) {
          setInstitutions([]);
          setInstitutionCode("");
          toast.error(error instanceof Error ? error.message : "Failed to load institutions.");
        }
      } finally {
        if (!cancelled) setInstitutionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destinationOpen, provider, router]);

  const activeDestinations = useMemo(() => (summary?.destinations || []).filter((item) => item.is_active), [summary]);
  const selectedInstitution = useMemo(
    () => institutions.find((item) => item.code === institutionCode) || null,
    [institutionCode, institutions]
  );
  const filteredInstitutions = useMemo(() => {
    const q = institutionQuery.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter((item) => item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q));
  }, [institutionQuery, institutions]);

  async function saveDestination() {
    const token = localStorage.getItem("admin_token");
    
    if (!selectedInstitution) {
      toast.error("Select an institution from the PayMongo list first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/treasury/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: destinationLabel,
          provider,
          institution_name: selectedInstitution?.name || "",
          institution_code: institutionCode,
          account_name: accountName,
          account_number: accountNumber,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to save destination.");
      setDestinationOpen(false);
      setDestinationLabel("");
      setProvider("instapay");
      setInstitutionQuery("");
      setInstitutionCode("");
      setAccountName("");
      setAccountNumber("");
      toast.success("Destination saved.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save destination.");
    } finally {
      setSaving(false);
    }
  }

  async function requestWithdrawal() {
    const token = localStorage.getItem("admin_token");
    
    setSaving(true);
    try {
      const res = await fetch("/api/treasury/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: Number(amount),
          destination_id: destinationId,
          request_note: requestNote || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to request withdrawal.");
      setRequestOpen(false);
      setAmount("");
      setDestinationId("");
      setRequestNote("");
      toast.success("Withdrawal request created.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request withdrawal.");
    } finally {
      setSaving(false);
    }
  }

  async function approveWithdrawal(withdrawalId: string) {
    const token = localStorage.getItem("admin_token");
    
    setSaving(true);
    try {
      const res = await fetch(`/api/treasury/withdrawals/${withdrawalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approval_note: null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to approve withdrawal.");
      toast.success("Withdrawal approved.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve withdrawal.");
    } finally {
      setSaving(false);
    }
  }

  async function submitWithdrawal(withdrawalId: string) {
    const token = localStorage.getItem("admin_token");
    
    setSaving(true);
    try {
      const res = await fetch(`/api/treasury/withdrawals/${withdrawalId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to submit withdrawal to PayMongo.");
      toast.success("Withdrawal submitted to PayMongo.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit withdrawal to PayMongo.");
    } finally {
      setSaving(false);
    }
  }

  async function syncWithdrawal(withdrawalId: string) {
    const token = localStorage.getItem("admin_token");
    
    setSaving(true);
    try {
      const res = await fetch(`/api/treasury/withdrawals/${withdrawalId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to sync PayMongo withdrawal status.");
      toast.success("PayMongo withdrawal status synced.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync PayMongo withdrawal status.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelWithdrawal(withdrawalId: string) {
    const token = localStorage.getItem("admin_token");
    
    setSaving(true);
    try {
      const res = await fetch(`/api/treasury/withdrawals/${withdrawalId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to cancel withdrawal.");
      toast.success("Withdrawal cancelled.");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel withdrawal.");
    } finally {
      setSaving(false);
    }
  }

  async function completeWithdrawal() {
    const token = localStorage.getItem("admin_token");
    
    if (!selectedWithdrawal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/treasury/withdrawals/${selectedWithdrawal.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          external_reference: externalReference,
          completion_note: completionNote || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to complete withdrawal.");
      toast.success("Withdrawal marked as completed.");
      setCompleteOpen(false);
      setSelectedWithdrawal(null);
      setExternalReference("");
      setCompletionNote("");
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete withdrawal.");
    } finally {
      setSaving(false);
    }
  }

  function openCompleteDialog(withdrawal: TreasuryWithdrawal) {
    setSelectedWithdrawal(withdrawal);
    setExternalReference(withdrawal.external_reference || "");
    setCompletionNote("");
    setCompleteOpen(true);
  }

  function statusMeta(status: string) {
    if (status === "pending_review") {
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        label: "Pending internal review",
        helper: "Next step: approve inside Treasury. This is not yet a PayMongo transfer.",
      };
    }
    if (status === "approved") {
      return {
        badge: "border-blue-200 bg-blue-50 text-blue-700",
        label: "Approved",
        helper: "Next step: submit this approved withdrawal to PayMongo.",
      };
    }
    if (status === "processing") {
      return {
        badge: "border-violet-200 bg-violet-50 text-violet-700",
        label: "Processing",
        helper: "Submitted to PayMongo. Wait for callback or use Sync Status to pull the latest transfer state.",
      };
    }
    if (status === "failed") {
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        label: "Failed",
        helper: "PayMongo returned a failed transfer or submission error. Review the message below, then retry or cancel.",
      };
    }
    if (status === "succeeded") {
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        label: "Completed",
        helper: "Treasury debit has been posted to the hotel ledger.",
      };
    }
    if (status === "cancelled") {
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        label: "Cancelled",
        helper: "Request was cancelled before completion.",
      };
    }
    return {
      badge: "border-slate-200 bg-slate-50 text-slate-700",
      label: status.replace(/_/g, " "),
      helper: "Review this withdrawal state.",
    };
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Treasury</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Treasury records hotel PayMongo funds only. Saved destinations now require provider and institution code before a withdrawal can be requested.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="h-11 min-w-[148px] justify-center">
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setDestinationOpen(true)} className="h-11 min-w-[148px] justify-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Destination
          </Button>
          <Button className="h-11 min-w-[176px] justify-center bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => setRequestOpen(true)} disabled={activeDestinations.length === 0}>
            <Landmark className="mr-2 h-4 w-4" />
            Request Withdrawal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">PayMongo Net Ledgered</p>
            <p className="mt-3 text-3xl font-bold text-[#07008A]">{money(summary?.hotel_collected_net || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Pending Withdrawals</p>
            <p className="mt-3 text-3xl font-bold text-[#07008A]">{money(summary?.pending_withdrawals || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Withdrawable Now</p>
            <p className="mt-3 text-3xl font-bold text-[#07008A]">{money(summary?.withdrawable_amount || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-amber-100 bg-amber-50/60 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">What happens next</p>
              <p className="text-sm text-amber-800">
                Treasury now submits approved withdrawals to PayMongo as wallet transactions. This queue remains your hotel-only control layer for shared-wallet segregation, while PayMongo handles the actual EFT processing.
              </p>
              <p className="text-sm text-amber-800">
                Current flow: request withdrawal {"->"} approve in Treasury {"->"} send to PayMongo {"->"} wait for callback or sync {"->"} completed automatically when PayMongo returns `succeeded`.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle>Saved Destinations</CardTitle>
            <CardDescription>Account numbers are stored encrypted. Only the masked value is shown.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {summary?.destinations?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.destinations.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">{providerLabel(item.provider)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-800">{item.institution_name}</div>
                          <div className="text-xs text-slate-500">Code: {item.institution_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-800">{item.account_name}</div>
                          <div className="text-xs text-slate-500">{item.account_number_masked}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <EmptyState title="No destinations yet" description="Add a destination first, then request a withdrawal from the saved list." borderless />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle>Withdrawal Queue</CardTitle>
            <CardDescription>Only hotel PayMongo funds are eligible for treasury withdrawal.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {summary?.withdrawals?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Next Step</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.withdrawals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{item.destination_label}</div>
                          <div className="text-xs text-slate-500">{providerLabel(item.destination_provider)} • {item.destination_institution_name || "-"} • {item.destination_account_masked || "-"}</div>
                          {item.paymongo_wallet_transaction_id ? (
                            <div className="text-[11px] text-slate-500">Wallet Tx: {item.paymongo_wallet_transaction_id}</div>
                          ) : null}
                          {item.paymongo_transfer_id ? (
                            <div className="text-[11px] text-slate-500">Transfer ID: {item.paymongo_transfer_id}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta(item.status).badge}>
                          {statusMeta(item.status).label}
                        </Badge>
                        <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-slate-500">{statusMeta(item.status).helper}</p>
                        {item.paymongo_status ? (
                          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">PayMongo: {item.paymongo_status}</p>
                        ) : null}
                        {item.paymongo_reference_number ? (
                          <p className="mt-1 text-[11px] text-slate-500">Reference: {item.paymongo_reference_number}</p>
                        ) : null}
                        {item.failure_message || item.paymongo_provider_error ? (
                          <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-rose-600">{item.failure_message || item.paymongo_provider_error}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">{money(item.amount)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        <div>{dt(item.requested_at)}</div>
                        {item.submitted_at ? <div className="mt-1 text-[11px] text-slate-400">Sent: {dt(item.submitted_at)}</div> : null}
                        {item.last_synced_at ? <div className="mt-1 text-[11px] text-slate-400">Synced: {dt(item.last_synced_at)}</div> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.status === "pending_review" ? (
                            <>
                              <Button size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => approveWithdrawal(item.id)} disabled={saving}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => cancelWithdrawal(item.id)} disabled={saving}>
                                Cancel
                              </Button>
                            </>
                          ) : null}
                          {item.status === "approved" ? (
                            <>
                              <Button size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => submitWithdrawal(item.id)} disabled={saving}>
                                Send to PayMongo
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openCompleteDialog(item)} disabled={saving}>
                                Complete Manually
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => cancelWithdrawal(item.id)} disabled={saving}>
                                Cancel
                              </Button>
                            </>
                          ) : null}
                          {item.status === "processing" ? (
                            <>
                              <Button size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => syncWithdrawal(item.id)} disabled={saving}>
                                Sync Status
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openCompleteDialog(item)} disabled={saving}>
                                Complete Manually
                              </Button>
                            </>
                          ) : null}
                          {item.status === "failed" ? (
                            <>
                              <Button size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={() => submitWithdrawal(item.id)} disabled={saving}>
                                Retry Submit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => cancelWithdrawal(item.id)} disabled={saving}>
                                Cancel
                              </Button>
                            </>
                          ) : null}
                          {item.status === "succeeded" && item.external_reference ? (
                            <div className="text-xs text-slate-500">Ref: {item.external_reference}</div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <EmptyState title="No withdrawal requests" description="Create a request after selecting one of your saved destinations." borderless />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle>Ledger Activity</CardTitle>
          <CardDescription>Withdrawable balance is based on hotel PayMongo inflows minus completed treasury withdrawals.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {summary?.entries?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Booked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.entries.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.entry_type.replace(/_/g, " ")}</TableCell>
                    <TableCell>{item.external_payment_id || item.payment_intent_id || "-"}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{money(item.amount)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{dt(item.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6">
              <EmptyState title="No treasury activity yet" description="Hotel PayMongo payments will appear here after settlement." borderless />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={destinationOpen} onOpenChange={setDestinationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Destination</DialogTitle>
            <DialogDescription>Provide the payout rail and institution code first. This matches PayMongo's transfer destination requirements more closely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destination_label">Label</Label>
              <Input id="destination_label" value={destinationLabel} onChange={(e) => setDestinationLabel(e.target.value)} placeholder="Primary Hotel Bank" />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(value: "instapay" | "pesonet") => setProvider(value)}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instapay">InstaPay</SelectItem>
                  <SelectItem value="pesonet">PESONet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input
                value={institutionQuery}
                onChange={(e) => setInstitutionQuery(e.target.value)}
                placeholder="Search institution name or code"
                disabled={institutionsLoading || institutions.length === 0}
              />
              <Select value={institutionCode} onValueChange={setInstitutionCode} disabled={institutionsLoading || institutions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={institutionsLoading ? "Loading institutions..." : "Select institution"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredInstitutions.length ? (
                    filteredInstitutions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name} ({item.code})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_match__" disabled>
                      No institutions match your search
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {selectedInstitution ? `Code: ${selectedInstitution.code}` : "Institution code will be filled automatically from PayMongo."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_name">Account Name</Label>
              <Input id="account_name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="D&M Travellers Inn" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number</Label>
              <Input id="account_number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Stored encrypted at rest" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDestinationOpen(false)} disabled={saving}>Close</Button>
            <Button className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={saveDestination} disabled={saving || !selectedInstitution}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Destination
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Treasury Withdrawal</DialogTitle>
            <DialogDescription>This uses the hotel-only PayMongo withdrawable amount of {money(summary?.withdrawable_amount || 0)}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Saved Destination</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger><SelectValue placeholder="Select saved destination" /></SelectTrigger>
                <SelectContent>
                  {activeDestinations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label} • {providerLabel(item.provider)} • {item.account_number_masked}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request_note">Request Note</Label>
              <Textarea id="request_note" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Reason for this withdrawal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={saving}>Close</Button>
            <Button className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={requestWithdrawal} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completeOpen}
        onOpenChange={(open) => {
          setCompleteOpen(open);
          if (!open) {
            setSelectedWithdrawal(null);
            setExternalReference("");
            setCompletionNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Withdrawal</DialogTitle>
            <DialogDescription>
              Manual fallback only. Use this if the real payout already happened outside the automated PayMongo sync. This step updates the hotel treasury ledger and stores the transfer reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {selectedWithdrawal ? `${selectedWithdrawal.destination_label} • ${money(selectedWithdrawal.amount)}` : ""}
            </div>
            <div className="space-y-2">
              <Label htmlFor="external_reference">Transfer Reference</Label>
              <Input
                id="external_reference"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder="PayMongo transfer ID or bank reference number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completion_note">Completion Note</Label>
              <Textarea
                id="completion_note"
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Optional internal note about the completed payout"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={saving}>Close</Button>
            <Button className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={completeWithdrawal} disabled={saving || !externalReference.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

