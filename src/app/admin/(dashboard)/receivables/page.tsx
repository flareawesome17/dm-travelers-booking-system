"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CircleDollarSign,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectPaymentModal } from "@/components/admin/bookings/CollectPaymentModal";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/utils";

type ReceivableRow = {
  id: string;
  type: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  notes?: string | null;
  created_at: string;
  bookings?: {
    reference_number?: string;
    check_out_date?: string;
    special_booking_label?: string | null;
    guests?: { full_name?: string };
    rooms?: { room_number?: string };
  };
};

type SummaryData = {
  outstandingBalance: number;
  totalCollected: number;
  activeCases: number;
  pastDueCases: number;
  recoveryRate: number;
};

type ForecastPoint = {
  date: string;
  label: string;
  amount: number;
  count: number;
};

type AgingPoint = {
  label: string;
  amount: number;
  count: number;
  color: string;
};

type ContributionPoint = {
  label: string;
  amount: number;
  count: number;
  color: string;
};

type ReceivablesPayload = {
  summary: SummaryData;
  analytics: {
    forecast: ForecastPoint[];
    aging: AgingPoint[];
    contribution: ContributionPoint[];
  };
  receivables: ReceivableRow[];
};

const DEFAULT_SUMMARY: SummaryData = {
  outstandingBalance: 0,
  totalCollected: 0,
  activeCases: 0,
  pastDueCases: 0,
  recoveryRate: 0,
};

const DEFAULT_ANALYTICS = {
  forecast: [] as ForecastPoint[],
  aging: [] as AgingPoint[],
  contribution: [] as ContributionPoint[],
};

function formatCurrency(value: number) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getOrganizationLabel(row: ReceivableRow) {
  return row.type === "LGU"
    ? "LGU Sponsored Stay"
    : row.bookings?.special_booking_label || "Special Agency";
}

function getStatusBadge(status: string) {
  const normalized = String(status).toLowerCase();
  if (normalized === "settled") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Settled</Badge>;
  }
  if (normalized === "partial") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Partial</Badge>;
  }
  return <Badge className="border-[#07008A]/15 bg-[#07008A]/5 text-[#07008A]">Outstanding</Badge>;
}

export default function ReceivablesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SummaryData>(DEFAULT_SUMMARY);
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [list, setList] = useState<ReceivableRow[]>([]);
  const [search, setSearch] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<ReceivableRow | null>(null);

  const router = useRouter();

  const fetchReceivables = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/receivables", { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json().catch(() => ({}))) as Partial<ReceivablesPayload>;
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to load receivables.");
        return;
      }
      setSummary(data.summary ?? DEFAULT_SUMMARY);
      setAnalytics(data.analytics ?? DEFAULT_ANALYTICS);
      setList(Array.isArray(data.receivables) ? data.receivables : []);
    } catch (error) {
      console.error("Failed to load receivables.", error);
      toast.error("Failed to load receivables.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchReceivables();
  }, [fetchReceivables]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list;

    return list.filter((row) => {
      const haystack = [
        getOrganizationLabel(row),
        row.bookings?.reference_number,
        row.bookings?.guests?.full_name,
        row.bookings?.rooms?.room_number,
        row.type,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [list, search]);

  const topContribution = analytics.contribution[0];
  const nextForecastDate = analytics.forecast[0];
  const authToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";

  const handleSyncNow = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/receivables/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to sync receivables.");
        return;
      }

      const totals = (data as { totals?: Record<string, number>; processed?: number }).totals ?? {};
      toast.success(
        `Receivables sync complete. ${data.processed ?? 0} booking(s) checked, ${totals.created ?? 0} created, ${totals.updated ?? 0} updated.`,
      );
      await fetchReceivables();
    } catch {
      toast.error("Failed to sync receivables.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#07008A]/10 bg-[#07008A]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#07008A]">
              <Sparkles className="h-3.5 w-3.5" />
              Enterprise Collections
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#07008A] lg:text-3xl">Receivables Ledger</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Track delayed-payment bookings, monitor collection health, and collect without losing alignment with booking balances.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search organization, booking, guest..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-full border-slate-200 bg-white pl-9 shadow-sm"
              />
            </div>
            <Button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="h-11 rounded-full bg-[#07008A] px-5 text-white hover:bg-[#05006a]"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.85fr]">
          <Card className="overflow-hidden border-0 bg-[linear-gradient(145deg,#07008A,#0C1A75)] text-white shadow-[0_24px_70px_rgba(7,0,138,0.20)]">
            <CardContent className="relative p-6 sm:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,190,92,0.18),transparent_28%)]" />
              <div className="relative space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Collection Health</p>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                      {formatCurrency(summary.outstandingBalance)}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-white/70">
                      Live receivable exposure across LGU and delayed-payment bookings.
                    </p>
                  </div>
                  <div className="hidden rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur sm:block">
                    <WalletCards className="h-6 w-6 text-[#FED501]" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Recovery rate</p>
                    <p className="mt-2 text-2xl font-bold">{summary.recoveryRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Active cases</p>
                    <p className="mt-2 text-2xl font-bold">{summary.activeCases}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Past due</p>
                    <p className="mt-2 text-2xl font-bold text-[#FED501]">{summary.pastDueCases}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Next expected LGU inflow</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {nextForecastDate ? `${nextForecastDate.label} - ${formatCurrency(nextForecastDate.amount)}` : "No upcoming LGU checkout inflows"}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-white/75">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Booking and receivable balances stay in sync
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <Card className="border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,241,0.98))] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Collected</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(summary.totalCollected)}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <CircleDollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,240,0.98))] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top mix</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{topContribution?.label || "No concentration yet"}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {topContribution ? `${formatCurrency(topContribution.amount)} across ${topContribution.count} account(s)` : "Once receivables exist, mix shows up here."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#07008A]/5 p-3 text-[#07008A]">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-red-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,244,244,0.98))] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400">Collection pressure</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">
                      {summary.pastDueCases > 0 ? `${summary.pastDueCases} account(s) need follow-up` : "No past-due pressure today"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr_0.85fr]">
        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <CalendarClock className="h-4 w-4 text-[#07008A]" />
              Expected Inflows
            </CardTitle>
            <CardDescription>Forecasted LGU collections based on outstanding bookings and checkout dates.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-4">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : analytics.forecast.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No forecast data"
                description="Outstanding LGU bookings will appear here once their checkout dates are scheduled."
                action={null}
                borderless
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.forecast} margin={{ top: 20, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(7,0,138,0.05)" }}
                    formatter={(value: number) => [formatCurrency(value), "Expected inflow"]}
                    labelFormatter={(label) => `Checkout: ${label}`}
                  />
                  <Bar dataKey="amount" radius={[10, 10, 0, 0]} fill="#07008A" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
            <CardTitle className="text-lg text-slate-900">Aging Report</CardTitle>
            <CardDescription>Outstanding balances split by checkout timing.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-4">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : analytics.aging.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No aging data" description="Outstanding receivables will appear here." action={null} borderless />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.aging} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={70} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Outstanding"]} />
                  <Bar dataKey="amount" radius={[0, 10, 10, 0]}>
                    {analytics.aging.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
            <CardTitle className="text-lg text-slate-900">Contribution Ratio</CardTitle>
            <CardDescription>How receivable exposure is distributed across booking classes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-4">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : analytics.contribution.length === 0 ? (
              <EmptyState icon={Building2} title="No ratio data" description="Receivable contribution appears once accounts exist." action={null} borderless />
            ) : (
              <div className="grid h-full gap-4">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={analytics.contribution}
                        dataKey="amount"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={76}
                        paddingAngle={4}
                      >
                        {analytics.contribution.map((entry) => (
                          <Cell key={entry.label} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Outstanding"]} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {analytics.contribution.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm font-medium text-slate-700">{entry.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(entry.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden border border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.95))] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Action Queue</CardTitle>
              <CardDescription>Outstanding receivables with quick collection access and booking context.</CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
              <Banknote className="h-3.5 w-3.5 text-[#07008A]" />
              {filtered.length} visible account(s)
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={WalletCards}
              title="No receivables to work"
              description={search ? "No accounts match your current search." : "There are currently no active receivables in the ledger."}
              action={null}
              borderless
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Account</th>
                    <th className="px-4 py-4">Type</th>
                    <th className="px-4 py-4">Checkout</th>
                    <th className="px-4 py-4 text-right">Outstanding</th>
                    <th className="px-4 py-4 text-right">Collected</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Quick Collect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4"><Skeleton className="h-10 w-52" /></td>
                          <td className="px-4 py-4"><Skeleton className="h-8 w-20 rounded-full" /></td>
                          <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-4 py-4"><Skeleton className="ml-auto h-4 w-24" /></td>
                          <td className="px-4 py-4"><Skeleton className="ml-auto h-4 w-24" /></td>
                          <td className="px-4 py-4"><Skeleton className="h-8 w-20 rounded-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="ml-auto h-9 w-32 rounded-full" /></td>
                        </tr>
                      ))
                    : filtered.map((row) => {
                        const checkout = row.bookings?.check_out_date
                          ? new Date(`${row.bookings.check_out_date}T00:00:00`).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Not scheduled";

                        return (
                          <tr key={row.id} className="group hover:bg-slate-50/60">
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900">{getOrganizationLabel(row)}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {row.bookings?.reference_number ? (
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600">
                                      {row.bookings.reference_number}
                                    </span>
                                  ) : null}
                                  {row.bookings?.guests?.full_name ? <span>{row.bookings.guests.full_name}</span> : null}
                                  {row.bookings?.rooms?.room_number ? <span>Room {row.bookings.rooms.room_number}</span> : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full border border-[#07008A]/10 bg-[#07008A]/5 px-2.5 py-1 text-xs font-semibold text-[#07008A]">
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">{checkout}</td>
                            <td className="px-4 py-4 text-right text-sm font-bold text-slate-900">
                              {formatCurrency(row.amount_due)}
                            </td>
                            <td className="px-4 py-4 text-right text-sm font-medium text-emerald-700">
                              {formatCurrency(row.amount_paid)}
                            </td>
                            <td className="px-4 py-4">{getStatusBadge(row.status)}</td>
                            <td className="px-6 py-4 text-right">
                              {row.status !== "Settled" && row.amount_due > 0 ? (
                                <Button
                                  size="sm"
                                  className="h-9 rounded-full bg-[#07008A] px-4 text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-[#05006a]"
                                  onClick={() => setPaymentTarget(row)}
                                >
                                  Quick Collect
                                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">No action needed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {paymentTarget && (
        <CollectPaymentModal
          open={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          receivable={{
            id: paymentTarget.id,
            amount_due: paymentTarget.amount_due,
            amount_paid: paymentTarget.amount_paid,
            status: paymentTarget.status,
            type: paymentTarget.type,
            organization_name: getOrganizationLabel(paymentTarget),
            reference_number: paymentTarget.bookings?.reference_number || null,
            guest_name: paymentTarget.bookings?.guests?.full_name || null,
          }}
          token={authToken}
          onSuccess={() => {
            void fetchReceivables();
          }}
        />
      )}
    </div>
  );
}
