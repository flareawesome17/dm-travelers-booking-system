"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowRightCircle, CheckCircle2, Hotel, Printer } from "lucide-react";

type ExpenseRow = {
  id: string | number;
  date: string;
  category: string;
  description: string;
  notes?: string | null;
  amount: number | string;
  performed_by_user?: {
    name?: string | null;
  } | null;
};

type ReceivableRow = {
  id: string | number;
  reference_number: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number | string;
  balance_due: number | string;
  is_lgu_booking?: boolean | null;
  is_special_booking?: boolean | null;
  special_booking_label?: string | null;
};

type ReportData = {
  total_revenue?: number;
  total_expenses?: number;
  net_profit?: number;
  booking_count?: number;
  order_count?: number;
  expenses_list?: ExpenseRow[];
};

type PrintableDailyReportProps = {
  data: ReportData;
  onClose: () => void;
  dateLabel: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatCurrency(value: number | string | null | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(value: string) {
  return fullDateFormatter.format(new Date(value));
}

function formatDateRange(start: string, end: string) {
  return `${shortDateFormatter.format(new Date(start))} - ${shortDateFormatter.format(new Date(end))}`;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function PageHeader({
  dateLabel,
  generatedAt,
  pageNumber,
  totalPages,
  subtitle,
}: {
  dateLabel: string;
  generatedAt: Date;
  pageNumber: number;
  totalPages: number;
  subtitle: string;
}) {
  return (
    <header className="report-section border-b border-slate-200 pb-6 print:pb-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[#07008A]">
            <Hotel className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              D&amp;M Travellers Inn
            </p>
            <h1 className="text-[2rem] font-black tracking-[-0.04em] text-slate-950 print:text-[1.75rem]">
              Shift Handover Audit
            </h1>
            <p className="text-sm font-medium tracking-[0.22em] text-slate-500 uppercase">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Statement Date
          </p>
          <p className="mt-1 text-xl font-bold text-slate-950 print:text-lg">{dateLabel}</p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            Generated {generatedAtFormatter.format(generatedAt)}
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Page {pageNumber} of {totalPages}
          </p>
        </div>
      </div>
    </header>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "positive" | "negative" | "neutral";
  emphasis?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-[#07008A]";

  return (
    <div
      className={`rounded-[22px] border bg-white p-5 ${
        emphasis ? "border-[#07008A] shadow-sm" : "border-slate-200"
      }`}
    >
      <p className={`mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] ${toneClass}`}>
        {icon}
        {label}
      </p>
      <p className="text-[2rem] font-black tracking-[-0.04em] text-slate-950">{value}</p>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p>
    </div>
  );
}

function ExpenseTable({ rows }: { rows: ExpenseRow[] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            <th className="w-[16%] px-4 py-3">Date</th>
            <th className="w-[18%] px-4 py-3">Category</th>
            <th className="w-[34%] px-4 py-3">Description</th>
            <th className="w-[18%] px-4 py-3">Agent</th>
            <th className="w-[14%] px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((expense) => (
            <tr key={expense.id} className="break-inside-avoid border-t border-slate-100 align-top">
              <td className="px-4 py-3 text-xs font-medium text-slate-500">{formatDate(expense.date)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  {expense.category}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                {expense.description}
                {expense.notes ? (
                  <p className="mt-1 text-xs font-normal text-slate-500">{expense.notes}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs font-medium text-slate-500">
                {expense.performed_by_user?.name || "System"}
              </td>
              <td className="px-4 py-3 text-right text-sm font-black text-slate-900">
                {formatCurrency(expense.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesTable({
  rows,
  total,
  showTotals,
}: {
  rows: ReceivableRow[];
  total: number;
  showTotals: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-slate-950 text-white">
          <tr className="text-left text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            <th className="w-[16%] px-4 py-3">Reference</th>
            <th className="w-[26%] px-4 py-3">Type / Status</th>
            <th className="w-[18%] px-4 py-3">Dates</th>
            <th className="w-[18%] px-4 py-3 text-right">Total Bill</th>
            <th className="w-[22%] px-4 py-3 text-right">Collected By Next Shift</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((receivable) => (
            <tr key={receivable.id} className="break-inside-avoid border-t border-slate-100 align-top">
              <td className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#07008A]">
                {receivable.reference_number}
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">{receivable.status}</p>
                {receivable.is_lgu_booking || receivable.is_special_booking ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {receivable.is_lgu_booking ? "LGU billed" : receivable.special_booking_label || "Special booking"}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs font-medium text-slate-500">
                {formatDateRange(receivable.check_in_date, receivable.check_out_date)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-500">
                {formatCurrency(receivable.total_amount)}
              </td>
              <td className="px-4 py-3 text-right text-xl font-black tracking-[-0.03em] text-slate-950">
                {formatCurrency(receivable.balance_due)}
              </td>
            </tr>
          ))}
        </tbody>
        {showTotals ? (
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={4} className="px-4 py-4 text-right text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Total Pending Handover
              </td>
              <td className="px-4 py-4 text-right text-2xl font-black tracking-[-0.04em] text-[#07008A]">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function SignoffSection() {
  return (
    <section className="report-section mt-10 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Handover Verification
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">Shift acknowledgement</h3>
        </div>
        <p className="max-w-[260px] text-right text-xs font-medium leading-5 text-slate-500">
          Both shifts should verify the amounts, supporting slips, and pending balances before sign off.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center">
          <div className="h-16 border-b border-slate-300" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Relieved Shift</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Sign over printed name</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center">
          <div className="h-16 border-b border-slate-300" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Incoming Shift</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Sign over printed name</p>
        </div>
      </div>
    </section>
  );
}

export default function PrintableDailyReport({
  data,
  onClose,
  dateLabel,
}: PrintableDailyReportProps) {
  const printableDocumentRef = useRef<HTMLDivElement | null>(null);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    const fetchReceivables = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch("/api/reports/pending-receivables", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const json = await response.json();
          setReceivables(Array.isArray(json.receivables) ? json.receivables : []);
        }
      } catch (error) {
        console.error("Failed to fetch receivables", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceivables();
  }, []);

  const expenses = Array.isArray(data.expenses_list) ? data.expenses_list : [];
  const expenseChunks = chunkItems(expenses, 10);
  const receivableChunks = chunkItems(receivables, 9);
  const totalPendingHandover = receivables.reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
  const topPendingAccount = receivables.reduce<ReceivableRow | null>((current, row) => {
    if (!current) return row;
    return Number(row.balance_due || 0) > Number(current.balance_due || 0) ? row : current;
  }, null);

  const totalPages = 1 + expenseChunks.length + receivableChunks.length;
  const summaryPageNumber = 1;
  const expensePageStart = 2;
  const receivablePageStart = expensePageStart + expenseChunks.length;
  const hasDetailPages = expenseChunks.length > 0 || receivableChunks.length > 0;

  const handlePrint = () => {
    if (!printableDocumentRef.current) return;

    const printWindow = window.open("", "_blank", "width=1280,height=960");
    if (!printWindow) return;

    const headMarkup = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((node) => node.outerHTML)
      .join("\n");

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Shift Handover Audit</title>
          ${headMarkup}
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }

            body {
              color: #0f172a;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .print-stack {
              display: block !important;
              background: #ffffff !important;
              padding: 0 !important;
            }

            .print-stack > div {
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
            }

            .report-page {
              width: 100% !important;
              max-width: none !important;
              margin: 0 0 8mm 0 !important;
              break-after: page;
              page-break-after: always;
              box-shadow: none !important;
            }

            .report-page:last-child {
              margin-bottom: 0 !important;
              break-after: auto;
              page-break-after: auto;
            }

            .report-section,
            table,
            thead,
            tbody,
            tfoot,
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            @page {
              size: A4 portrait;
              margin: 12mm;
            }
          </style>
        </head>
        <body>
          <div id="print-root">
            <div class="preview-shell">
              <div class="print-stack">
                <div>
                  ${printableDocumentRef.current.innerHTML}
                </div>
              </div>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div
        id="print-root"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden"
      >
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 shadow-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Preparing document
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
            Building handover pages
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            Loading outstanding receivables and formatting the printable audit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="print-root"
      className="fixed inset-0 z-50 bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 print:static print:block print:bg-white print:p-0"
    >
      <div className="preview-shell mx-auto flex h-full max-w-[1180px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-slate-100 shadow-[0_30px_90px_rgba(15,23,42,0.24)] print:h-auto print:max-w-none print:overflow-visible print:rounded-none print:border-none print:bg-white print:shadow-none">
        <div className="preview-toolbar flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Print preview</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">
              Daily handover statement
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Cleanest export: keep margins on default and turn off browser headers and footers.
            </p>
          </div>

          <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#07008A] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#05006a]"
            >
              <Printer className="h-4 w-4" />
              Print Audit Now
            </button>
          </div>
        </div>

        <div className="print-stack flex-1 overflow-auto bg-slate-200/70 px-3 py-4 sm:px-6 sm:py-8 print:overflow-visible print:bg-white print:p-0">
          <div
            ref={printableDocumentRef}
            className="mx-auto flex w-full max-w-[820px] min-w-0 flex-col gap-6 print:block print:max-w-none print:gap-0"
          >
            <section className="report-page relative w-full rounded-[30px] border border-slate-200 bg-white px-10 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.12)] print:w-full print:max-w-none print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
              <PageHeader
                dateLabel={dateLabel}
                generatedAt={generatedAt}
                pageNumber={summaryPageNumber}
                totalPages={totalPages}
                subtitle="Summary and shift cash position"
              />

              <div className="mt-8 grid grid-cols-3 gap-4">
                <SummaryCard
                  label="Inflows"
                  value={formatCurrency(data.total_revenue)}
                  icon={<ArrowRightCircle className="h-3.5 w-3.5" />}
                  tone="positive"
                />
                <SummaryCard
                  label="Outflows"
                  value={formatCurrency(data.total_expenses)}
                  icon={<ArrowRightCircle className="h-3.5 w-3.5" />}
                  tone="negative"
                />
                <SummaryCard
                  label="Net handover cash"
                  value={formatCurrency(data.net_profit)}
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  tone="neutral"
                  emphasis
                />
              </div>

              <section className="report-section mt-8 rounded-[26px] border border-slate-200 bg-white p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                      Handover overview
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                      Pending balances for next shift
                    </h3>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {receivables.length} active account{receivables.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-4">
                  <SnapshotCard
                    label="Open receivables"
                    value={String(receivables.length)}
                    helper="Accounts that still need settlement"
                  />
                  <SnapshotCard
                    label="Pending handover"
                    value={formatCurrency(totalPendingHandover)}
                    helper="Balance due to be collected by the next shift"
                  />
                  <SnapshotCard
                    label="Activity count"
                    value={String((data.booking_count || 0) + (data.order_count || 0))}
                    helper="Combined booking and order transactions in this report"
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    Highest pending balance
                  </p>
                  {topPendingAccount ? (
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-lg font-black tracking-[-0.03em] text-slate-950">
                          {topPendingAccount.reference_number}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {topPendingAccount.status} | {formatDateRange(topPendingAccount.check_in_date, topPendingAccount.check_out_date)}
                        </p>
                      </div>
                      <p className="text-2xl font-black tracking-[-0.04em] text-[#07008A]">
                        {formatCurrency(topPendingAccount.balance_due)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      No receivables are pending for handover.
                    </p>
                  )}
                </div>
              </section>

              {!hasDetailPages ? (
                <SignoffSection />
              ) : (
                <div className="mt-10 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    Next pages
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                    The detailed ledgers continue on the next pages so rows stay readable and do not split across
                    print pages.
                  </p>
                </div>
              )}
            </section>

            {expenseChunks.map((chunk, chunkIndex) => {
              const currentPageNumber = expensePageStart + chunkIndex;
              const isLastExpensePage = chunkIndex === expenseChunks.length - 1;
              const shouldShowExpenseSignoff = isLastExpensePage && !receivableChunks.length;

              return (
                <section
                  key={`expenses-${chunkIndex}`}
                  className="report-page relative w-full rounded-[30px] border border-slate-200 bg-white px-10 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.12)] print:w-full print:max-w-none print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none"
                >
                  <PageHeader
                    dateLabel={dateLabel}
                    generatedAt={generatedAt}
                    pageNumber={currentPageNumber}
                    totalPages={totalPages}
                    subtitle={`Operating outflows ${expenseChunks.length > 1 ? `(${chunkIndex + 1}/${expenseChunks.length})` : ""}`}
                  />

                  <section className="report-section mt-8">
                    <div className="mb-4 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                          Expense ledger
                        </p>
                        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                          Itemized operating outflows
                        </h3>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {expenses.length} entr{expenses.length === 1 ? "y" : "ies"}
                      </div>
                    </div>

                    <ExpenseTable rows={chunk} />
                  </section>

                  {shouldShowExpenseSignoff ? <SignoffSection /> : null}
                </section>
              );
            })}

            {receivableChunks.map((chunk, chunkIndex) => {
              const currentPageNumber = receivablePageStart + chunkIndex;
              const isLastReceivablePage = chunkIndex === receivableChunks.length - 1;

              return (
                <section
                  key={`receivables-${chunkIndex}`}
                  className="report-page relative w-full rounded-[30px] border border-slate-200 bg-white px-10 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.12)] print:w-full print:max-w-none print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none"
                >
                  <PageHeader
                    dateLabel={dateLabel}
                    generatedAt={generatedAt}
                    pageNumber={currentPageNumber}
                    totalPages={totalPages}
                    subtitle={`Pending receivables ${receivableChunks.length > 1 ? `(${chunkIndex + 1}/${receivableChunks.length})` : ""}`}
                  />

                  <section className="report-section mt-8">
                    <div className="mb-4 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                          Receivables handover
                        </p>
                        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                          Pending receivables for next shift
                        </h3>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {chunk.length} row{chunk.length === 1 ? "" : "s"} on this page
                      </div>
                    </div>

                    <ReceivablesTable
                      rows={chunk}
                      total={totalPendingHandover}
                      showTotals={isLastReceivablePage}
                    />
                  </section>

                  {isLastReceivablePage ? <SignoffSection /> : null}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm;
              }

              html,
              body {
                background: #ffffff !important;
              }

              body * {
                visibility: hidden !important;
              }

              #print-root,
              #print-root * {
                visibility: visible !important;
              }

              #print-root {
                position: static !important;
                inset: auto !important;
                display: block !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
              }

              #print-root .preview-shell,
              #print-root .print-stack {
                display: block !important;
                width: 100% !important;
                max-width: none !important;
                min-width: 0 !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
                box-shadow: none !important;
              }

              #print-root .print-stack > div {
                display: block !important;
                width: 100% !important;
                max-width: none !important;
                min-width: 0 !important;
                margin: 0 !important;
              }

              #print-root .report-page {
                display: block !important;
                width: 100% !important;
                max-width: none !important;
                min-height: 0 !important;
                margin: 0 0 8mm 0 !important;
                break-after: page;
                page-break-after: always;
              }

              #print-root .report-page:last-child {
                margin-bottom: 0 !important;
                break-after: auto;
                page-break-after: auto;
              }

              #print-root .report-section,
              #print-root table,
              #print-root thead,
              #print-root tbody,
              #print-root tfoot,
              #print-root tr {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          `,
        }}
      />
    </div>
  );
}
