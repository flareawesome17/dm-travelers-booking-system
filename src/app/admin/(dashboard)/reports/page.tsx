"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Download,
  FileSpreadsheet,
  History,
  LayoutList,
  Loader2,
  Plus,
  ReceiptText,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/context/PermissionsContext";
import { adminFetch, adminFetchOrRedirect, requireAdminSession } from "@/lib/admin-client";

type ShiftSummary = {
  total_cash: number;
  total_gcash: number;
  total_card: number;
  total_cheque: number;
  total_qrph: number;
  total_amount: number;
  total_cash_expenses: number;
  total_non_cash_expenses: number;
  total_expenses: number;
  cash_on_hand: number;
  activity_row_count: number;
  turnover_row_count: number;
};

type ShiftRow = {
  booking_id: string | null;
  room_no: string;
  guest_name: string;
  scheduled_check_in_at: string | null;
  scheduled_check_out_at: string | null;
  remaining_balance_due: number;
  check_in_at: string | null;
  check_out_at: string | null;
  room_rate: number;
  extra_bed_amount: number;
  extra_person_amount: number;
  linens_amount: number;
  charge_amount: number;
  minimart_amount: number;
  food_amount: number;
  cash_amount: number;
  gcash_amount: number;
  card_amount: number;
  cheque_amount: number;
  qrph_amount: number;
  total_amount: number;
  payment_count: number;
  reference_numbers: string[];
  latest_activity_at: string | null;
};

type TurnoverRow = Omit<
  ShiftRow,
  "cash_amount" | "gcash_amount" | "card_amount" | "cheque_amount" | "qrph_amount" | "payment_count" | "reference_numbers"
> & {
  collectible_amount: number;
  source_shift_name?: string | null;
};

type ShiftReport = {
  shift_log: {
    id: string;
    date: string;
    status: "OPEN" | "CLOSED";
    shift_id: string;
    closed_at?: string | null;
    shifts?: { name?: string | null; start_time?: string; end_time?: string } | null;
  };
  summary: ShiftSummary;
  activity_rows: ShiftRow[];
  turnover_rows: TurnoverRow[];
  expense_summary: {
    cash_paid: number;
    non_cash_paid: number;
    total: number;
    expense_count: number;
  };
  export_template_version: number;
  report_mode: "live" | "snapshot";
};

type HistoryItem = {
  id: string;
  date: string;
  status: string;
  closed_at: string | null;
  total_income: number;
  total_expense: number;
  net_total: number;
  shifts: { name: string } | null;
};

type AnalyticsData = {
  total_revenue: number;
  room_revenue: number;
  restaurant_revenue: number;
  receivable_revenue?: number;
  total_expenses: number;
  net_profit: number;
  by_method: Record<string, number>;
  by_source: Record<string, number>;
  expenses_list: Array<{
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    notes?: string | null;
    performed_by_user?: { name?: string | null } | null;
  }>;
};

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ShiftMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="border border-slate-200 shadow-xs">
      <CardContent className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-black tracking-tight text-[#07008A]">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function ShiftRowsTable({
  rows,
  emptyLabel,
  variant = "activity",
}: {
  rows: ShiftRow[] | TurnoverRow[];
  emptyLabel: string;
  variant?: "activity" | "turnover";
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10">
        <EmptyState icon={LayoutList} title={emptyLabel} description="Nothing is recorded for this section yet." />
      </div>
    );
  }

  if (variant === "turnover") {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[
                "Room",
                "Guest",
                "Check-In",
                "Check-Out",
                "Room Rate",
                "Bed",
                "Person",
                "Linens",
                "Charge",
                "Minimart",
                "Food",
                "Collectible",
                "Source Shift",
              ].map((label) => (
                <th key={label} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows as TurnoverRow[]).map((row, index) => (
              <tr key={`${row.room_no}-${row.guest_name}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-3 font-semibold text-slate-800">{row.room_no || "â€”"}</td>
                <td className="px-3 py-3 text-slate-700">{row.guest_name}</td>
                <td className="px-3 py-3 text-slate-500">{formatDateTime(row.check_in_at)}</td>
                <td className="px-3 py-3 text-slate-500">{formatDateTime(row.check_out_at)}</td>
                <td className="px-3 py-3">{formatCurrency(row.room_rate)}</td>
                <td className="px-3 py-3">{formatCurrency(row.extra_bed_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.extra_person_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.linens_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.charge_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.minimart_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.food_amount)}</td>
                <td className="px-3 py-3 font-semibold text-amber-700">{formatCurrency(row.collectible_amount || row.total_amount)}</td>
                <td className="px-3 py-3 text-slate-500">{row.source_shift_name || "â€”"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1300px] w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {[
              "Room",
              "Guest",
              "Check-In",
              "Check-Out",
              "Room Rate",
              "Bed",
              "Person",
              "Linens",
              "Charge",
              "Minimart",
              "Food",
              "Cash",
              "GCash",
              "Card",
              "Cheque",
              "QRPh",
              "Ref No.",
            ].map((label) => (
              <th key={label} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => {
            const isActivity = "cash_amount" in row;
            return (
              <tr key={`${row.room_no}-${row.guest_name}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-3 font-semibold text-slate-800">{row.room_no || "—"}</td>
                <td className="px-3 py-3 text-slate-700">{row.guest_name}</td>
                <td className="px-3 py-3 text-slate-500">{formatDateTime(row.check_in_at)}</td>
                <td className="px-3 py-3 text-slate-500">{formatDateTime(row.check_out_at)}</td>
                <td className="px-3 py-3">{formatCurrency(row.room_rate)}</td>
                <td className="px-3 py-3">{formatCurrency(row.extra_bed_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.extra_person_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.linens_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.charge_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.minimart_amount)}</td>
                <td className="px-3 py-3">{formatCurrency(row.food_amount)}</td>
                <td className="px-3 py-3">{isActivity ? formatCurrency((row as ShiftRow).cash_amount) : "—"}</td>
                <td className="px-3 py-3">{isActivity ? formatCurrency((row as ShiftRow).gcash_amount) : "—"}</td>
                <td className="px-3 py-3">{isActivity ? formatCurrency((row as ShiftRow).card_amount) : "—"}</td>
                <td className="px-3 py-3">{isActivity ? formatCurrency((row as ShiftRow).cheque_amount) : "—"}</td>
                <td className="px-3 py-3">{isActivity ? formatCurrency((row as ShiftRow).qrph_amount) : "—"}</td>
                <td className="px-3 py-3 text-slate-500">
                  {isActivity ? (row as ShiftRow).reference_numbers.join(", ") || "—" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState("shift");
  const [shiftLoading, setShiftLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [currentReport, setCurrentReport] = useState<ShiftReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("monthly");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Supplies",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const selectedShiftIdRef = useRef<string | null>(null);
  const selectedReportRef = useRef<ShiftReport | null>(null);
  const hasBootstrappedRef = useRef(false);
  const hasSkippedInitialPeriodRefreshRef = useRef(false);
  const canReadShiftCash = hasPermission("reports.shift_cash.read");
  const canReadAnalytics = hasPermission("reports.analytics.read");
  const canReadReports = canReadShiftCash || canReadAnalytics;
  const canExportReports = hasPermission("reports.shift_cash.export");

  useEffect(() => {
    if (!canReadShiftCash && canReadAnalytics && activeTab === "shift") {
      setActiveTab("analytics");
    }
  }, [canReadShiftCash, canReadAnalytics, activeTab]);

  const visibleReport = useMemo(() => {
    if (selectedShiftId && currentReport?.shift_log.id === selectedShiftId) {
      return currentReport;
    }
    return selectedReport ?? currentReport;
  }, [currentReport, selectedReport, selectedShiftId]);

  useEffect(() => {
    selectedShiftIdRef.current = selectedShiftId;
    selectedReportRef.current = selectedReport;
  }, [selectedReport, selectedShiftId]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const start = new Date();
      if (period === "daily") start.setHours(0, 0, 0, 0);
      else if (period === "weekly") start.setDate(start.getDate() - 7);
      else if (period === "monthly") start.setMonth(start.getMonth() - 1);
      else if (period === "yearly") start.setFullYear(start.getFullYear() - 1);

      const response = await adminFetchOrRedirect(
        router,
        `/api/reports/revenue?startDate=${start.toISOString()}`,
      );
      if (!response.ok) throw new Error("Failed to load analytics");
      setAnalytics(await response.json());
    } catch {
      toast.error("Failed to load revenue analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [period, router]);

  const fetchShiftDetail = useCallback(
    async (shiftLogId: string) => {
      setDetailLoading(true);
      try {
        const response = await adminFetchOrRedirect(router, `/api/reports/shifts/${shiftLogId}`);
        if (!response.ok) throw new Error("Failed to load shift report");
        setSelectedReport(await response.json());
        setSelectedShiftId(shiftLogId);
      } catch {
        toast.error("Failed to load shift report");
      } finally {
        setDetailLoading(false);
      }
    },
    [router],
  );

  const fetchShiftData = useCallback(async () => {
    setShiftLoading(true);
    try {
      const [currentResponse, historyResponse] = await Promise.all([
        adminFetchOrRedirect(router, "/api/reports/shifts/current"),
        adminFetchOrRedirect(router, "/api/shifts/history?page=1&limit=20"),
      ]);

      if (!currentResponse.ok) throw new Error("Failed to load current shift report");
      if (!historyResponse.ok) throw new Error("Failed to load shift history");

      const [currentJson, historyJson] = await Promise.all([
        currentResponse.json(),
        historyResponse.json(),
      ]);

      setCurrentReport(currentJson);
      setHistory(historyJson.data ?? []);
      setSelectedShiftId((existing) => existing ?? currentJson.shift_log.id);

      const currentSelectedShiftId = selectedShiftIdRef.current;
      const currentSelectedReport = selectedReportRef.current;
      if (!currentSelectedReport && (!currentSelectedShiftId || currentSelectedShiftId === currentJson.shift_log.id)) {
        setSelectedReport(currentJson);
      }
    } catch {
      toast.error("Failed to load shift reports");
    } finally {
      setShiftLoading(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const allowed = await requireAdminSession(router);
      if (!allowed) {
        setShiftLoading(false);
        setAnalyticsLoading(false);
        return;
      }
      try {
        const promises = [];
        if (canReadShiftCash) promises.push(fetchShiftData());
        else setShiftLoading(false);
        
        if (canReadAnalytics) promises.push(fetchAnalytics());
        else setAnalyticsLoading(false);
        
        await Promise.all(promises);
      } finally {
        hasBootstrappedRef.current = true;
      }
    })();
  }, [fetchAnalytics, fetchShiftData, router, canReadShiftCash, canReadAnalytics]);

  useEffect(() => {
    if (!hasBootstrappedRef.current || !canReadAnalytics) return;

    if (!hasSkippedInitialPeriodRefreshRef.current) {
      hasSkippedInitialPeriodRefreshRef.current = true;
      return;
    }

    fetchAnalytics();
  }, [canReadAnalytics, fetchAnalytics, period]);

  const handleExport = async () => {
    const report = visibleReport;
    if (!report) return;

    try {
      const response = await adminFetchOrRedirect(
        router,
        `/api/reports/shifts/${report.shift_log.id}/export`,
      );
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cash-on-hand-${report.shift_log.date}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export shift report");
    }
  };

  const handleCreateExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittingExpense(true);
    try {
      const response = await adminFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          category: expenseForm.category,
          date: expenseForm.date,
          notes: expenseForm.notes || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to record expense");

      toast.success("Expense recorded");
      setIsAddExpenseOpen(false);
      setExpenseForm({
        description: "",
        amount: "",
        category: "Supplies",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      const promises = [];
      if (canReadAnalytics) promises.push(fetchAnalytics());
      if (canReadShiftCash) promises.push(fetchShiftData());
      await Promise.all(promises);
    } catch {
      toast.error("Failed to record expense");
    } finally {
      setSubmittingExpense(false);
    }
  };

  if (!permissionsLoading && !canReadReports && !shiftLoading && !analyticsLoading) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access Restricted"
        description="You do not have the required permissions to view reports."
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#07008A]">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Shift cash-on-hand is now the primary front-desk report. Revenue analytics remain available as a secondary view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => {
            if (canReadShiftCash) void fetchShiftData();
            if (canReadAnalytics) void fetchAnalytics();
          }}>
            Refresh
          </Button>
          {canExportReports && (
            <Button onClick={handleExport} disabled={!visibleReport}>
              <Download className="mr-2 h-4 w-4" /> Export XLSX
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full max-w-md ${canReadShiftCash && canReadAnalytics ? "grid-cols-2" : "grid-cols-1"}`}>
          {canReadShiftCash && <TabsTrigger value="shift">Shift Cash Report</TabsTrigger>}
          {canReadAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="shift" className="space-y-6">
          {shiftLoading ? (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <Skeleton className="h-[640px] w-full" />
              <Skeleton className="h-[640px] w-full" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <Card className="border border-[#07008A]/10 shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-[#07008A]">
                      <ReceiptText className="h-4 w-4" />
                      Current Shift
                    </CardTitle>
                    <CardDescription>Live preview of the active ledger report.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentReport ? (
                      <>
                        <div>
                          <p className="text-lg font-bold text-slate-900">{currentReport.shift_log.shifts?.name || "Shift"}</p>
                          <p className="text-sm text-slate-500">{currentReport.shift_log.date}</p>
                        </div>
                        <Badge variant={currentReport.shift_log.status === "OPEN" ? "default" : "outline"}>
                          {currentReport.shift_log.status === "OPEN" ? "Live Preview" : "Closed"}
                        </Badge>
                        <Button
                          className="w-full"
                          variant={selectedShiftId === currentReport.shift_log.id ? "default" : "outline"}
                          onClick={() => {
                            setSelectedShiftId(currentReport.shift_log.id);
                            setSelectedReport(currentReport);
                          }}
                        >
                          View Current Shift
                        </Button>
                      </>
                    ) : (
                      <EmptyState icon={Wallet} title="No active shift" description="The active shift report is not available." />
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-[#07008A]">
                      <History className="h-4 w-4" />
                      Closed Shift Archive
                    </CardTitle>
                    <CardDescription>Recent finalized shift ledgers and their reports.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[560px] overflow-y-auto">
                    {history.length === 0 ? (
                      <EmptyState icon={History} title="No closed shifts" description="Closed shifts will appear here." />
                    ) : (
                      history.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void fetchShiftDetail(item.id)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedShiftId === item.id
                              ? "border-[#07008A] bg-[#07008A]/5"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.shifts?.name || "Shift"}</p>
                              <p className="text-xs text-slate-500">{item.date}</p>
                            </div>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Net {formatCurrency(item.net_total)}</p>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {detailLoading ? (
                  <Skeleton className="h-[640px] w-full" />
                ) : visibleReport ? (
                  <Card className="border border-slate-200 shadow-xs">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle className="text-xl text-[#07008A]">
                            {visibleReport.shift_log.shifts?.name || "Shift"} Cash-on-Hand Report
                          </CardTitle>
                          <CardDescription>
                            {visibleReport.shift_log.date} | {visibleReport.report_mode === "snapshot" ? "Finalized snapshot" : "Live preview"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={visibleReport.shift_log.status === "OPEN" ? "default" : "outline"}>
                            {visibleReport.shift_log.status}
                          </Badge>
                          <Badge variant="outline">Template v{visibleReport.export_template_version}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 p-6">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ShiftMetricCard label="Cash On Hand" value={formatCurrency(visibleReport.summary.cash_on_hand)} helper="Cash receipts minus cash-paid expenses" />
                        <ShiftMetricCard label="Cash Receipts" value={formatCurrency(visibleReport.summary.total_cash)} helper="Only the cash column contributes to cash on hand" />
                        <ShiftMetricCard label="Cash Expenses" value={formatCurrency(visibleReport.summary.total_cash_expenses)} helper="Cash-paid expenses only" />
                        <ShiftMetricCard label="Turnover Rows" value={String(visibleReport.summary.turnover_row_count)} helper="Carried from the previous closed shift" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <ShiftMetricCard label="GCash" value={formatCurrency(visibleReport.summary.total_gcash)} helper="Shift collections" />
                        <ShiftMetricCard label="Card" value={formatCurrency(visibleReport.summary.total_card)} helper="Shift collections" />
                        <ShiftMetricCard label="Cheque" value={formatCurrency(visibleReport.summary.total_cheque)} helper="Shift collections" />
                        <ShiftMetricCard label="QRPh" value={formatCurrency(visibleReport.summary.total_qrph)} helper="Shift collections" />
                        <ShiftMetricCard label="All Methods" value={formatCurrency(visibleReport.summary.total_amount)} helper="Cash plus non-cash collections" />
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-semibold">Cash-on-hand logic</p>
                            <p className="mt-1">Non-cash collections stay visible in the shift report, but only cash receipts and cash-paid expenses affect the final cash-on-hand figure.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200">
                        <div className="border-b border-slate-200 px-4 py-3">
                          <p className="font-semibold text-slate-900">Booking Activity This Shift</p>
                          <p className="text-sm text-slate-500">One aggregated row per booking for payment activity recorded under this shift.</p>
                        </div>
                        <ShiftRowsTable rows={visibleReport.activity_rows} emptyLabel="No booking activity yet" variant="activity" />
                      </div>

                      <div className="rounded-2xl border border-slate-200">
                        <div className="border-b border-slate-200 px-4 py-3">
                          <p className="font-semibold text-slate-900">Incoming Turnover</p>
                          <p className="text-sm text-slate-500">Open checked-in bookings with remaining collectible balance carried in from the previous closed shift.</p>
                        </div>
                        <ShiftRowsTable rows={visibleReport.turnover_rows} emptyLabel="No incoming turnover" variant="turnover" />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <EmptyState icon={FileSpreadsheet} title="Select a shift report" description="Choose the current shift or a closed shift from the archive to review its cash-on-hand report." />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>

            {hasPermission("expenses.create") && (
              <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Expense</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateExpense} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="expense-description">Description</Label>
                      <Input
                        id="expense-description"
                        value={expenseForm.description}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expense-amount">Amount</Label>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          value={expenseForm.amount}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expense-category">Category</Label>
                        <Input
                          id="expense-category"
                          value={expenseForm.category}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expense-date">Date</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={expenseForm.date}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expense-notes">Notes</Label>
                      <Textarea
                        id="expense-notes"
                        value={expenseForm.notes}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                    <Button type="submit" disabled={submittingExpense} className="w-full">
                      {submittingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Save Expense
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {analyticsLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : analytics ? (
            <>
              <div className="grid gap-6 md:grid-cols-3">
                <ShiftMetricCard label="Revenue" value={formatCurrency(analytics.total_revenue)} helper="Ledger-backed inflows for the selected period" />
                <ShiftMetricCard label="Expenses" value={formatCurrency(analytics.total_expenses)} helper="Operational outflows for the selected period" />
                <ShiftMetricCard label="Net Profit" value={formatCurrency(analytics.net_profit)} helper="Revenue minus expenses" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border border-slate-200 shadow-xs">
                  <CardHeader>
                    <CardTitle className="text-base text-[#07008A]">Revenue By Source</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(analytics.by_source || {}).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(value)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-xs">
                  <CardHeader>
                    <CardTitle className="text-base text-[#07008A]">Revenue By Method</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(analytics.by_method || {}).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(value)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-slate-200 shadow-xs">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-[#07008A]">
                    <Banknote className="h-4 w-4" />
                    Recent Expenses
                  </CardTitle>
                  <CardDescription>Secondary analytics view for expense review and management.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {analytics.expenses_list.length === 0 ? (
                    <div className="py-10">
                      <EmptyState icon={Banknote} title="No expenses recorded" description="There are no expenses in this period." />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            {["Date", "Description", "Category", "Recorded By", "Notes", "Amount"].map((label) => (
                              <th key={label} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics.expenses_list.map((expense) => (
                            <tr key={expense.id}>
                              <td className="px-4 py-3 text-slate-500">{expense.date}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{expense.description}</td>
                              <td className="px-4 py-3">{expense.category}</td>
                              <td className="px-4 py-3">{expense.performed_by_user?.name || "System"}</td>
                              <td className="px-4 py-3 text-slate-500">{expense.notes || "—"}</td>
                              <td className="px-4 py-3 font-bold text-rose-600">{formatCurrency(expense.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
