import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { getBookingChargeBreakdown, toMoneyNumber } from "@/lib/bookingTotals";
import { getBookingExtraDisplayName } from "@/lib/bookingExtras";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getShiftCashReportById,
  type ShiftCashReport,
  type ShiftCashReportRow,
  type ShiftCashTurnoverRow,
} from "@/lib/shiftCashReports";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "assets", "files", "Accounts-recievable.xlsx");
const ITEM_START_ROW = 6;
const ITEM_ROW_COUNT = 10;
const TOTAL_ROW = 16;

type ShiftAccountsReceivableRow = ShiftCashReportRow | ShiftCashTurnoverRow;

type BookingExtraRecord = {
  id: string;
  extra_type?: string | null;
  custom_label?: string | null;
  quantity?: number | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
};

type BookingSupportRecord = {
  id: string;
  reference_number?: string | null;
  total_amount?: number | string | null;
  restaurant_charges_total?: number | string | null;
  extras_total?: number | string | null;
  extensions_total?: number | string | null;
  early_checkin_fee_applied?: number | string | null;
  late_checkout_fee_applied?: number | string | null;
  discount_amount?: number | string | null;
  balance_due?: number | string | null;
  actual_check_in_at?: string | null;
  actual_check_out_at?: string | null;
  reserved_checkin_datetime?: string | null;
  reserved_checkout_datetime?: string | null;
  guests?: { full_name?: string | null } | null;
  rooms?: { room_number?: string | null } | null;
  booking_extras?: BookingExtraRecord[] | null;
};

type AccountsReceivableLine = {
  particular: string;
  amount: number;
  status: string;
};

export type AccountsReceivableWorkbookInput = {
  report: Pick<ShiftCashReport, "shift_log" | "report_mode">;
  reportRow: ShiftAccountsReceivableRow;
  booking: BookingSupportRecord;
  preparedByName?: string | null;
  generatedAt?: Date;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSignatureStamp(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function sanitizeSheetName(value: string) {
  const sanitized = value.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (sanitized || "Accounts Receivable").slice(0, 31);
}

function getTargetOutstanding(row: ShiftAccountsReceivableRow, booking: BookingSupportRecord) {
  if ("collectible_amount" in row) {
    return roundMoney(
      Math.max(0, toMoneyNumber(row.collectible_amount || row.total_amount || booking.balance_due)),
    );
  }

  return roundMoney(Math.max(0, toMoneyNumber(row.remaining_balance_due || booking.balance_due)));
}

function buildBookingExtraLines(
  booking: BookingSupportRecord,
  row: ShiftAccountsReceivableRow,
  lineStatus: string,
) {
  const extras = Array.isArray(booking.booking_extras) ? booking.booking_extras : [];
  const lines = extras
    .map((extra) => ({
      particular: getBookingExtraDisplayName(extra),
      amount: roundMoney(toMoneyNumber(extra.total_price)),
      status: lineStatus,
    }))
    .filter((line) => line.amount > 0);

  if (lines.length > 0) return lines;

  const fallbackLines: AccountsReceivableLine[] = [];
  if (toMoneyNumber(row.extra_bed_amount) > 0) {
    fallbackLines.push({
      particular: "Extra Bed",
      amount: roundMoney(toMoneyNumber(row.extra_bed_amount)),
      status: lineStatus,
    });
  }
  if (toMoneyNumber(row.extra_person_amount) > 0) {
    fallbackLines.push({
      particular: "Extra Person",
      amount: roundMoney(toMoneyNumber(row.extra_person_amount)),
      status: lineStatus,
    });
  }
  if (toMoneyNumber(row.linens_amount) > 0) {
    fallbackLines.push({
      particular: "Linens",
      amount: roundMoney(toMoneyNumber(row.linens_amount)),
      status: lineStatus,
    });
  }
  if (toMoneyNumber(row.charge_amount) > 0) {
    fallbackLines.push({
      particular: "Custom Charge",
      amount: roundMoney(toMoneyNumber(row.charge_amount)),
      status: lineStatus,
    });
  }

  return fallbackLines;
}

function compressLines(lines: AccountsReceivableLine[], maxLines: number) {
  if (lines.length <= maxLines) return lines;
  if (maxLines <= 1) {
    return [
      {
        particular: "Other Charges",
        amount: roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)),
        status: "For Endorsement",
      },
    ];
  }

  const visibleLines = lines.slice(0, maxLines - 1);
  const overflowAmount = roundMoney(lines.slice(maxLines - 1).reduce((sum, line) => sum + line.amount, 0));
  return [
    ...visibleLines,
    {
      particular: "Other Charges",
      amount: overflowAmount,
      status: visibleLines[visibleLines.length - 1]?.status || "For Endorsement",
    },
  ];
}

function buildWorkbookLines(input: AccountsReceivableWorkbookInput) {
  const { booking, reportRow } = input;
  const targetOutstanding = getTargetOutstanding(reportRow, booking);
  const lineStatus = targetOutstanding > 0 ? "For Endorsement" : "Settled";
  const breakdown = getBookingChargeBreakdown(booking);
  const lines: AccountsReceivableLine[] = [];

  if (breakdown.roomTotal > 0) {
    lines.push({
      particular: "Room Accommodation",
      amount: roundMoney(breakdown.roomTotal),
      status: lineStatus,
    });
  }

  if (breakdown.discountAmount > 0) {
    lines.push({
      particular: "Less Discount",
      amount: -roundMoney(breakdown.discountAmount),
      status: "Applied",
    });
  }

  lines.push(...buildBookingExtraLines(booking, reportRow, lineStatus));

  if (breakdown.extensionsTotal > 0) {
    lines.push({
      particular: "Stay Extensions",
      amount: roundMoney(breakdown.extensionsTotal),
      status: lineStatus,
    });
  }

  if (breakdown.earlyCheckInFee > 0) {
    lines.push({
      particular: "Early Check-in Fee",
      amount: roundMoney(breakdown.earlyCheckInFee),
      status: lineStatus,
    });
  }

  if (breakdown.lateCheckOutFee > 0) {
    lines.push({
      particular: "Late Check-out Fee",
      amount: roundMoney(breakdown.lateCheckOutFee),
      status: lineStatus,
    });
  }

  if (toMoneyNumber(reportRow.minimart_amount) > 0) {
    lines.push({
      particular: "Minimart Charges",
      amount: roundMoney(toMoneyNumber(reportRow.minimart_amount)),
      status: lineStatus,
    });
  }

  const restaurantChargeAmount = roundMoney(
    Math.max(
      0,
      toMoneyNumber(reportRow.food_amount) || toMoneyNumber(booking.restaurant_charges_total),
    ),
  );
  if (restaurantChargeAmount > 0) {
    lines.push({
      particular: "Restaurant Charges",
      amount: restaurantChargeAmount,
      status: lineStatus,
    });
  }

  const grossAmount = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const appliedPayments = roundMoney(Math.max(0, grossAmount - targetOutstanding));
  const lineLimit = ITEM_ROW_COUNT - (appliedPayments > 0 ? 1 : 0);
  const visibleLines = compressLines(lines, lineLimit);

  if (appliedPayments > 0) {
    visibleLines.push({
      particular: "Less Payments Received",
      amount: -appliedPayments,
      status: "Collected",
    });
  }

  return {
    lines: visibleLines,
    targetOutstanding,
  };
}

function getRowDateTime(reportRow: ShiftAccountsReceivableRow, booking: BookingSupportRecord, kind: "in" | "out") {
  if (kind === "in") {
    return (
      reportRow.check_in_at ||
      booking.actual_check_in_at ||
      reportRow.scheduled_check_in_at ||
      booking.reserved_checkin_datetime ||
      null
    );
  }

  return (
    reportRow.check_out_at ||
    booking.actual_check_out_at ||
    reportRow.scheduled_check_out_at ||
    booking.reserved_checkout_datetime ||
    null
  );
}

export async function generateAccountsReceivableWorkbook(input: AccountsReceivableWorkbookInput) {
  await fs.access(TEMPLATE_PATH);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.worksheets[0];
  const generatedAt = input.generatedAt ?? new Date();
  const roomNo = input.reportRow.room_no || input.booking.rooms?.room_number || "";
  const guestName = input.reportRow.guest_name || input.booking.guests?.full_name || "";
  const { lines, targetOutstanding } = buildWorkbookLines(input);

  worksheet.name = sanitizeSheetName(
    [roomNo ? `RM${roomNo}` : "", guestName || input.booking.reference_number || ""].filter(Boolean).join(" - "),
  );

  worksheet.getCell("B2").value = roomNo;
  worksheet.getCell("E2").value = guestName;
  worksheet.getCell("D3").value = formatDateTime(getRowDateTime(input.reportRow, input.booking, "in"));
  worksheet.getCell("D4").value = formatDateTime(getRowDateTime(input.reportRow, input.booking, "out"));

  for (let offset = 0; offset < ITEM_ROW_COUNT; offset += 1) {
    const rowIndex = ITEM_START_ROW + offset;
    worksheet.getCell(`A${rowIndex}`).value = null;
    worksheet.getCell(`C${rowIndex}`).value = null;
    worksheet.getCell(`D${rowIndex}`).value = null;
    worksheet.getCell(`E${rowIndex}`).value = null;
    worksheet.getCell(`C${rowIndex}`).numFmt = "#,##0.00";

    const line = lines[offset];
    if (!line) continue;

    worksheet.getCell(`A${rowIndex}`).value = line.particular;
    worksheet.getCell(`C${rowIndex}`).value = line.amount;
    worksheet.getCell(`D${rowIndex}`).value = line.status;
  }

  worksheet.getCell(`C${TOTAL_ROW}`).value = {
    formula: `SUM(C${ITEM_START_ROW}:C${ITEM_START_ROW + ITEM_ROW_COUNT - 1})`,
    result: targetOutstanding,
  };
  worksheet.getCell(`C${TOTAL_ROW}`).numFmt = "#,##0.00";

  const computedBy = [String(input.preparedByName || "").trim(), formatSignatureStamp(generatedAt)]
    .filter(Boolean)
    .join(" / ");
  worksheet.getCell("D17").value = computedBy;
  worksheet.getCell("D18").value = "";
  worksheet.getCell("D19").value = "";

  await worksheet.protect("dm-accounts-receivable-readonly", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

async function fetchBookingSupportRecord(bookingId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      reference_number,
      total_amount,
      restaurant_charges_total,
      extras_total,
      extensions_total,
      early_checkin_fee_applied,
      late_checkout_fee_applied,
      discount_amount,
      balance_due,
      actual_check_in_at,
      actual_check_out_at,
      reserved_checkin_datetime,
      reserved_checkout_datetime,
      guests(full_name),
      rooms(room_number),
      booking_extras(id, extra_type, custom_label, quantity, unit_price, total_price)
    `)
    .eq("id", bookingId)
    .single();

  if (error) throw error;
  return data as BookingSupportRecord;
}

function getReportRow(report: ShiftCashReport, bookingId: string) {
  return (
    report.turnover_rows.find((row) => row.booking_id === bookingId) ||
    report.activity_rows.find((row) => row.booking_id === bookingId) ||
    null
  );
}

export async function generateShiftAccountsReceivableWorkbook(args: {
  reportId: string;
  bookingId: string;
  preparedByName?: string | null;
}) {
  const report = await getShiftCashReportById(args.reportId);
  const reportRow = getReportRow(report, args.bookingId);

  if (!reportRow) {
    throw new Error("Booking is not part of this shift report.");
  }

  const booking = await fetchBookingSupportRecord(args.bookingId);
  const buffer = await generateAccountsReceivableWorkbook({
    report,
    reportRow,
    booking,
    preparedByName: args.preparedByName,
  });

  const fileNameParts = [
    "accounts-receivable",
    report.shift_log.date,
    reportRow.room_no ? `room-${reportRow.room_no}` : null,
    booking.reference_number ? String(booking.reference_number).trim().toLowerCase() : null,
  ].filter(Boolean);

  return {
    buffer,
    fileName: `${fileNameParts.join("-").replace(/\s+/g, "-")}.xlsx`,
  };
}
