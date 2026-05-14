import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOrCreateActiveShiftLog } from "@/lib/shiftUtils";
import { toMoneyNumber } from "@/lib/bookingTotals";
import { getBookingExtraBucket } from "@/lib/bookingExtras";
import { getGlobalTimeConfig } from "@/lib/settings";

const EXPORT_TEMPLATE_VERSION = 3;
const TEMPLATE_PATH = path.join(process.cwd(), "public", "assets", "files", "CASH-ON-HAND-REPORT.xlsx");
const ACTIVITY_START_ROW = 10;
const TEMPLATE_ACTIVITY_SLOTS = 14;
const FOOTER_TOTAL_CASH_ROW = 26;
const FOOTER_LESS_EXPENSES_ROW = 27;
const FOOTER_CASH_ON_HAND_ROW = 28;
const SIGNATURE_ROW = 31;
const WORKBOOK_TOTAL_COLUMNS = 21;
const PAYMENT_START_COLUMN = 16;
const PAYMENT_END_COLUMN = 21;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;
type DbErrorLike = { code?: string | null; message?: string | null };

type ShiftDefinition = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
};

type ShiftLogRecord = {
  id: string;
  shift_id: string;
  date: string;
  status: "OPEN" | "CLOSED";
  closed_at?: string | null;
  close_notes?: string | null;
  total_income?: number | string | null;
  total_expense?: number | string | null;
  net_total?: number | string | null;
  shifts?: ShiftDefinition | null;
};

type BookingRecord = {
  id: string;
  guest_id?: string | null;
  room_id?: string | null;
  reference_number?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  balance_due?: number | string | null;
  restaurant_charges_total?: number | string | null;
  num_adults?: number | null;
  num_children?: number | null;
  actual_check_in_at?: string | null;
  actual_check_out_at?: string | null;
  reserved_checkin_datetime?: string | null;
  reserved_checkout_datetime?: string | null;
  early_checkin_fee_applied?: number | string | null;
  late_checkout_fee_applied?: number | string | null;
  room_no?: string | null;
  guest_name?: string | null;
};

type BookingExtraRecord = {
  booking_id: string;
  extra_type?: string | null;
  custom_label?: string | null;
  total_price?: number | string | null;
};

type RestaurantOrderRecord = {
  id: string;
  booking_id?: string | null;
};

type RestaurantOrderItemRecord = {
  order_id: string;
  line_total?: number | string | null;
  is_minimart?: boolean | null;
};

type RestaurantChargeBreakdown = {
  food_amount: number;
  minimart_amount: number;
  has_snapshot_lines: boolean;
};

type PaymentRecord = {
  id: string;
  booking_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  transaction_id?: string | null;
  transaction_time?: string | null;
  created_at?: string | null;
};

type ReceivablePaymentRecord = {
  id: string;
  receivable_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  notes?: string | null;
  cheque_number?: string | null;
  created_at?: string | null;
  booking_id?: string | null;
};

type ExpenseRecord = {
  id: string;
  amount?: number | string | null;
  payment_method?: string | null;
  category?: string | null;
  description?: string | null;
};

type ShiftTransactionRecord = {
  id: string;
  source: "booking" | "restaurant" | "expense" | "manual";
  reference_id?: string | null;
  description?: string | null;
  amount?: number | string | null;
  type: "INCOME" | "EXPENSE";
  created_at?: string | null;
};

type ReceivableRecord = {
  id: string;
  booking_id?: string | null;
};

type RoomRecord = {
  id: string;
  room_number?: string | null;
};

type GuestRecord = {
  id: string;
  full_name?: string | null;
};

export type ShiftCashReportRow = {
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
  early_checkin_amount: number;
  late_checkout_amount: number;
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

export type ShiftCashTurnoverRow = Omit<
  ShiftCashReportRow,
  "cash_amount" | "gcash_amount" | "card_amount" | "cheque_amount" | "qrph_amount" | "payment_count" | "reference_numbers"
> & {
  collectible_amount: number;
  source_shift_log_id?: string | null;
  source_shift_name?: string | null;
};

export type ShiftCashReportSummary = {
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

export type ShiftCashReport = {
  shift_log: ShiftLogRecord;
  summary: ShiftCashReportSummary;
  activity_rows: ShiftCashReportRow[];
  turnover_rows: ShiftCashTurnoverRow[];
  expense_summary: {
    cash_paid: number;
    non_cash_paid: number;
    total: number;
    expense_count: number;
  };
  export_template_version: number;
  report_mode: "live" | "snapshot";
};

type ShiftCashReportWorkbookOptions = {
  preparedByName?: string | null;
};

type ShiftChargeBreakdown = Pick<
  ShiftCashReportRow,
  | "room_rate"
  | "extra_bed_amount"
  | "extra_person_amount"
  | "linens_amount"
  | "charge_amount"
  | "minimart_amount"
  | "food_amount"
  | "early_checkin_amount"
  | "late_checkout_amount"
>;

const CHARGE_ALLOCATION_ORDER: Array<keyof ShiftChargeBreakdown> = [
  "room_rate",
  "extra_bed_amount",
  "extra_person_amount",
  "linens_amount",
  "charge_amount",
  "minimart_amount",
  "food_amount",
  "early_checkin_amount",
  "late_checkout_amount",
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isMissingShiftCashReportTable(error: DbErrorLike | null | undefined) {
  if (!error) return false;

  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    message.includes("shift_cash_reports") ||
    message.includes("shift_cash_report_rows") ||
    message.includes("shift_cash_report_turnovers")
  );
}

function isMissingTurnoverCollectibleColumn(error: DbErrorLike | null | undefined) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("collectible_amount") ||
    message.includes("scheduled_check_in_at") ||
    message.includes("scheduled_check_out_at") ||
    message.includes("remaining_balance_due")
  );
}

function isMissingReservationScheduleColumns(error: DbErrorLike | null | undefined) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("scheduled_check_in_at") ||
    message.includes("scheduled_check_out_at") ||
    message.includes("remaining_balance_due")
  );
}

function cloneStyle<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getLaterTimestamp(left: string | null | undefined, right: string | null | undefined) {
  if (!left) return right || null;
  if (!right) return left || null;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function normalizeRefNumbers(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

export function formatReferenceNumbersForWorkbook(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      normalizeRefNumbers(values)
        .map((value) => value.replace(/\D/g, "").slice(-4))
        .filter(Boolean),
    ),
  ).join(", ");
}

function sortRows<T extends { room_no?: string; guest_name?: string; latest_activity_at?: string | null }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftRoom = String(left.room_no || "").padStart(8, "0");
    const rightRoom = String(right.room_no || "").padStart(8, "0");
    if (leftRoom !== rightRoom) return leftRoom.localeCompare(rightRoom);

    const leftTime = new Date(left.latest_activity_at || 0).getTime();
    const rightTime = new Date(right.latest_activity_at || 0).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;

    return String(left.guest_name || "").localeCompare(String(right.guest_name || ""));
  });
}

function getMethodBucket(method: string | null | undefined) {
  const normalized = String(method || "").trim().toLowerCase();

  if (normalized === "cash") return "cash_amount" as const;
  if (normalized === "gcash") return "gcash_amount" as const;
  if (normalized === "card" || normalized === "bank transfer") return "card_amount" as const;
  if (normalized === "cheque") return "cheque_amount" as const;
  if (normalized === "qrph") return "qrph_amount" as const;
  return "card_amount" as const;
}

function getNormalizedMethod(method: string | null | undefined) {
  return String(method || "").trim().toLowerCase();
}

function getPaymentReferenceNumbers(payment: PaymentRecord) {
  const method = getNormalizedMethod(payment.method);

  if (method === "cash" || method === "card") return [];
  if (!payment.transaction_id) return [];

  return normalizeRefNumbers([payment.transaction_id]);
}

function getReceivablePaymentReferenceNumbers(receivablePayment: ReceivablePaymentRecord) {
  const method = getNormalizedMethod(receivablePayment.method);

  if (method === "card" || method === "cash") return [];
  if (method === "cheque") return normalizeRefNumbers([receivablePayment.cheque_number]);

  return [];
}

function getReceivableBookingId(receivablePayment: ReceivablePaymentRecord) {
  return receivablePayment.booking_id || null;
}

export function getBookingExtrasBreakdown(extras: BookingExtraRecord[]) {
  const breakdown = {
    extra_bed_amount: 0,
    extra_person_amount: 0,
    linens_amount: 0,
    charge_amount: 0,
    minimart_amount: 0,
  };

  for (const extra of extras) {
    const totalPrice = toMoneyNumber(extra.total_price);
    const bucket = getBookingExtraBucket(extra.extra_type);

    if (bucket === "bed") {
      breakdown.extra_bed_amount += totalPrice;
      continue;
    }

    if (bucket === "person") {
      breakdown.extra_person_amount += totalPrice;
      continue;
    }

    if (bucket === "linens") {
      breakdown.linens_amount += totalPrice;
      continue;
    }

    breakdown.charge_amount += totalPrice;
  }

  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, roundMoney(value)]),
  ) as typeof breakdown;
}

export function getRestaurantChargeBreakdown(items: RestaurantOrderItemRecord[]) {
  const breakdown = {
    food_amount: 0,
    minimart_amount: 0,
    has_snapshot_lines: items.length > 0,
  };

  for (const item of items) {
    const lineTotal = toMoneyNumber(item.line_total);

    if (item.is_minimart) {
      breakdown.minimart_amount += lineTotal;
      continue;
    }

    breakdown.food_amount += lineTotal;
  }

  return {
    food_amount: roundMoney(breakdown.food_amount),
    minimart_amount: roundMoney(breakdown.minimart_amount),
    has_snapshot_lines: breakdown.has_snapshot_lines,
  };
}

function getRowChargeBreakdown(
  booking: BookingRecord | null | undefined,
  bookingExtras: BookingExtraRecord[],
  restaurantCharges?: RestaurantChargeBreakdown | null,
): ShiftChargeBreakdown {
  const extras = getBookingExtrasBreakdown(bookingExtras);
  const restaurantBreakdown = restaurantCharges?.has_snapshot_lines
    ? restaurantCharges
    : {
        food_amount: roundMoney(toMoneyNumber(booking?.restaurant_charges_total)),
        minimart_amount: 0,
      };

  return {
    room_rate: roundMoney(toMoneyNumber(booking?.total_amount)),
    extra_bed_amount: extras.extra_bed_amount,
    extra_person_amount: extras.extra_person_amount,
    linens_amount: extras.linens_amount,
    charge_amount: extras.charge_amount,
    early_checkin_amount: roundMoney(toMoneyNumber(booking?.early_checkin_fee_applied)),
    late_checkout_amount: roundMoney(toMoneyNumber(booking?.late_checkout_fee_applied)),
    minimart_amount: roundMoney(restaurantBreakdown.minimart_amount),
    food_amount: roundMoney(restaurantBreakdown.food_amount),
  };
}

function getChargeBreakdownTotal(breakdown: ShiftChargeBreakdown) {
  return roundMoney(
    CHARGE_ALLOCATION_ORDER.reduce((total, key) => total + roundMoney(toMoneyNumber(breakdown[key])), 0),
  );
}

function allocateChargeBreakdown(
  breakdown: ShiftChargeBreakdown,
  paidBefore: number,
  amountToAllocate: number,
): ShiftChargeBreakdown {
  let paidBeforeRemaining = roundMoney(Math.max(0, paidBefore));
  let amountRemaining = roundMoney(Math.max(0, amountToAllocate));
  const allocation = {
    room_rate: 0,
    extra_bed_amount: 0,
    extra_person_amount: 0,
    linens_amount: 0,
    charge_amount: 0,
    early_checkin_amount: 0,
    late_checkout_amount: 0,
    minimart_amount: 0,
    food_amount: 0,
  } satisfies ShiftChargeBreakdown;

  for (const key of CHARGE_ALLOCATION_ORDER) {
    const componentTotal = roundMoney(toMoneyNumber(breakdown[key]));
    const alreadyCovered = Math.min(componentTotal, paidBeforeRemaining);
    paidBeforeRemaining = roundMoney(Math.max(0, paidBeforeRemaining - componentTotal));

    const availableInComponent = roundMoney(Math.max(0, componentTotal - alreadyCovered));
    const allocated = roundMoney(Math.min(amountRemaining, availableInComponent));
    allocation[key] = allocated;
    amountRemaining = roundMoney(Math.max(0, amountRemaining - allocated));
  }

  return allocation;
}

export function createBaseRow(
  booking: BookingRecord | null | undefined,
  bookingExtras: BookingExtraRecord[],
  restaurantCharges?: RestaurantChargeBreakdown | null,
) {
  const chargeBreakdown = getRowChargeBreakdown(booking, bookingExtras, restaurantCharges);

  return {
    booking_id: booking?.id || null,
    room_no: String(booking?.room_no || ""),
    guest_name: String(booking?.guest_name || booking?.reference_number || "Unknown Guest"),
    scheduled_check_in_at: booking?.reserved_checkin_datetime || null,
    scheduled_check_out_at: booking?.reserved_checkout_datetime || null,
    remaining_balance_due: roundMoney(toMoneyNumber(booking?.balance_due)),
    check_in_at: booking?.actual_check_in_at || null,
    check_out_at: booking?.actual_check_out_at || null,
    ...chargeBreakdown,
    cash_amount: 0,
    gcash_amount: 0,
    card_amount: 0,
    cheque_amount: 0,
    qrph_amount: 0,
    total_amount: 0,
    payment_count: 0,
    reference_numbers: [] as string[],
    latest_activity_at: null as string | null,
  };
}

export function mergeIncomingTurnoversIntoActivityRows(
  activityRows: ShiftCashReportRow[],
  incomingTurnoverRows: ShiftCashTurnoverRow[],
) {
  const activityBookingIds = new Set(
    activityRows
      .map((row) => row.booking_id)
      .filter((value): value is string => Boolean(value)),
  );

  const carryInRows = incomingTurnoverRows
    .filter((row) => !row.booking_id || !activityBookingIds.has(row.booking_id))
    .map<ShiftCashReportRow>((row) => ({
      booking_id: row.booking_id,
      room_no: row.room_no,
      guest_name: row.guest_name,
      scheduled_check_in_at: row.scheduled_check_in_at ?? null,
      scheduled_check_out_at: row.scheduled_check_out_at ?? null,
      remaining_balance_due: roundMoney(
        toMoneyNumber(row.remaining_balance_due || row.collectible_amount || row.total_amount),
      ),
      check_in_at: row.check_in_at,
      check_out_at: row.check_out_at,
      room_rate: 0,
      extra_bed_amount: row.extra_bed_amount,
      extra_person_amount: row.extra_person_amount,
      linens_amount: row.linens_amount,
      charge_amount: row.charge_amount,
      early_checkin_amount: row.early_checkin_amount,
      late_checkout_amount: row.late_checkout_amount,
      minimart_amount: row.minimart_amount,
      food_amount: row.food_amount,
      cash_amount: 0,
      gcash_amount: 0,
      card_amount: 0,
      cheque_amount: 0,
      qrph_amount: 0,
      total_amount: 0,
      payment_count: 0,
      reference_numbers: [],
      latest_activity_at: row.latest_activity_at,
    }));

  return sortRows([...activityRows, ...carryInRows]);
}

function buildSummary(rows: ShiftCashReportRow[], expenses: ExpenseRecord[]) {
  const summary = rows.reduce<ShiftCashReportSummary>(
    (accumulator, row) => {
      accumulator.total_cash += row.cash_amount;
      accumulator.total_gcash += row.gcash_amount;
      accumulator.total_card += row.card_amount;
      accumulator.total_cheque += row.cheque_amount;
      accumulator.total_qrph += row.qrph_amount;
      accumulator.total_amount += row.total_amount;
      return accumulator;
    },
    {
      total_cash: 0,
      total_gcash: 0,
      total_card: 0,
      total_cheque: 0,
      total_qrph: 0,
      total_amount: 0,
      total_cash_expenses: 0,
      total_non_cash_expenses: 0,
      total_expenses: 0,
      cash_on_hand: 0,
      activity_row_count: rows.length,
      turnover_row_count: 0,
    },
  );

  for (const expense of expenses) {
    const amount = toMoneyNumber(expense.amount);
    if (String(expense.payment_method || "").trim().toLowerCase() === "cash") {
      summary.total_cash_expenses += amount;
    } else {
      summary.total_non_cash_expenses += amount;
    }
  }

  summary.total_cash = roundMoney(summary.total_cash);
  summary.total_gcash = roundMoney(summary.total_gcash);
  summary.total_card = roundMoney(summary.total_card);
  summary.total_cheque = roundMoney(summary.total_cheque);
  summary.total_qrph = roundMoney(summary.total_qrph);
  summary.total_amount = roundMoney(summary.total_amount);
  summary.total_cash_expenses = roundMoney(summary.total_cash_expenses);
  summary.total_non_cash_expenses = roundMoney(summary.total_non_cash_expenses);
  summary.total_expenses = roundMoney(summary.total_cash_expenses + summary.total_non_cash_expenses);
  summary.cash_on_hand = roundMoney(summary.total_cash - summary.total_cash_expenses);

  return summary;
}

function getNextShiftTarget(shifts: ShiftDefinition[], currentShiftId: string, currentDate: string) {
  const activeShifts = [...shifts]
    .filter((shift) => shift.is_active)
    .sort((left, right) => left.sort_order - right.sort_order);

  const currentIndex = activeShifts.findIndex((shift) => shift.id === currentShiftId);
  if (currentIndex === -1 || activeShifts.length === 0) {
    throw new Error("Unable to determine the next active shift for turnover.");
  }

  const nextIndex = (currentIndex + 1) % activeShifts.length;
  const nextShift = activeShifts[nextIndex];
  const targetDate = new Date(`${currentDate}T00:00:00`);

  if (nextIndex === 0) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return {
    shift_id: nextShift.id,
    date: targetDate.toISOString().slice(0, 10),
    name: nextShift.name,
  };
}

async function fetchShiftLog(supabase: SupabaseAdmin, shiftLogId: string) {
  const { data, error } = await supabase
    .from("shift_logs")
    .select("id, shift_id, date, status, closed_at, close_notes, total_income, total_expense, net_total")
    .eq("id", shiftLogId)
    .single();

  if (error || !data) {
    throw error || new Error("Shift log not found");
  }

  return {
    ...data,
    shifts: (await fetchShiftsByIds(supabase, [data.shift_id])).get(data.shift_id) ?? null,
  } as ShiftLogRecord;
}

async function fetchActiveShifts(supabase: SupabaseAdmin) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, start_time, end_time, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShiftDefinition[];
}

async function fetchShiftsByIds(supabase: SupabaseAdmin, shiftIds: string[]) {
  if (shiftIds.length === 0) return new Map<string, ShiftDefinition>();

  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, start_time, end_time, sort_order, is_active")
    .in("id", shiftIds);

  if (error) throw error;

  return new Map((data ?? []).map((shift) => [shift.id, shift as ShiftDefinition]));
}

async function fetchShiftTransactions(supabase: SupabaseAdmin, shiftLogId: string) {
  const { data, error } = await supabase
    .from("shift_transactions")
    .select("id, source, reference_id, description, amount, type, created_at")
    .eq("shift_log_id", shiftLogId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShiftTransactionRecord[];
}

async function fetchPayments(supabase: SupabaseAdmin, ids: string[]) {
  if (ids.length === 0) return [] as PaymentRecord[];

  const { data, error } = await supabase
    .from("payments")
    .select("id, booking_id, amount, method, transaction_id, transaction_time")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as PaymentRecord[];
}

async function fetchReceivablePayments(supabase: SupabaseAdmin, ids: string[]) {
  if (ids.length === 0) return [] as ReceivablePaymentRecord[];

  const { data, error } = await supabase
    .from("receivable_payments")
    .select("id, receivable_id, amount, method, notes, cheque_number, created_at")
    .in("id", ids);

  if (error) throw error;

  const receivableIds = Array.from(
    new Set(
      (data ?? [])
        .map((payment) => String(payment.receivable_id || "").trim())
        .filter(Boolean),
    ),
  );
  const receivablesById = await fetchReceivablesByIds(supabase, receivableIds);

  return ((data ?? []) as ReceivablePaymentRecord[]).map((payment) => ({
    ...payment,
    booking_id: payment.receivable_id ? receivablesById.get(payment.receivable_id)?.booking_id ?? null : null,
  }));
}

async function fetchBookings(supabase: SupabaseAdmin, bookingIds: string[]) {
  if (bookingIds.length === 0) return [] as BookingRecord[];

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      guest_id,
      room_id,
      reference_number,
      status,
      total_amount,
      balance_due,
      restaurant_charges_total,
      num_adults,
      num_children,
      actual_check_in_at,
      actual_check_out_at,
      reserved_checkin_datetime,
      reserved_checkout_datetime,
      early_checkin_fee_applied,
      late_checkout_fee_applied
    `)
    .in("id", bookingIds);

  if (error) throw error;

  const roomIds = Array.from(
    new Set(
      (data ?? [])
        .map((booking) => String(booking.room_id || "").trim())
        .filter(Boolean),
    ),
  );
  const guestIds = Array.from(
    new Set(
      (data ?? [])
        .map((booking) => String(booking.guest_id || "").trim())
        .filter(Boolean),
    ),
  );

  const [roomsById, guestsById] = await Promise.all([
    fetchRoomsByIds(supabase, roomIds),
    fetchGuestsByIds(supabase, guestIds),
  ]);

  return ((data ?? []) as BookingRecord[]).map((booking) => ({
    ...booking,
    room_no: booking.room_id ? roomsById.get(booking.room_id)?.room_number ?? null : null,
    guest_name: booking.guest_id ? guestsById.get(booking.guest_id)?.full_name ?? null : null,
  }));
}

async function fetchReceivablesByIds(supabase: SupabaseAdmin, receivableIds: string[]) {
  if (receivableIds.length === 0) return new Map<string, ReceivableRecord>();

  const { data, error } = await supabase
    .from("receivables")
    .select("id, booking_id")
    .in("id", receivableIds);

  if (error) throw error;

  return new Map((data ?? []).map((receivable) => [receivable.id, receivable as ReceivableRecord]));
}

async function fetchRoomsByIds(supabase: SupabaseAdmin, roomIds: string[]) {
  if (roomIds.length === 0) return new Map<string, RoomRecord>();

  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_number")
    .in("id", roomIds);

  if (error) throw error;

  return new Map((data ?? []).map((room) => [room.id, room as RoomRecord]));
}

async function fetchGuestsByIds(supabase: SupabaseAdmin, guestIds: string[]) {
  if (guestIds.length === 0) return new Map<string, GuestRecord>();

  const { data, error } = await supabase
    .from("guests")
    .select("id, full_name")
    .in("id", guestIds);

  if (error) throw error;

  return new Map((data ?? []).map((guest) => [guest.id, guest as GuestRecord]));
}

async function fetchBookingExtras(supabase: SupabaseAdmin, bookingIds: string[]) {
  if (bookingIds.length === 0) return [] as BookingExtraRecord[];

  const { data, error } = await supabase
    .from("booking_extras")
    .select("booking_id, extra_type, custom_label, total_price")
    .in("booking_id", bookingIds);

  if (error) throw error;
  return (data ?? []) as BookingExtraRecord[];
}

/**
 * Fetch IDs of all bookings currently checked in with outstanding balances.
 * These bookings must appear in the shift booking sheet regardless of whether
 * any payment was recorded during the current shift, and they must become
 * candidates for cash-on-hand turnover when the shift closes.
 */
async function fetchActiveCheckedInBookingIds(supabase: SupabaseAdmin): Promise<string[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "Checked-In")
    .not("actual_check_in_at", "is", null)
    .is("actual_check_out_at", null)
    .gt("balance_due", 0);

  if (error) {
    console.error("[fetchActiveCheckedInBookingIds]", error);
    return [];
  }
  return (data ?? []).map((row: any) => row.id as string);
}

async function fetchRestaurantChargeBreakdowns(supabase: SupabaseAdmin, bookingIds: string[]) {
  const breakdowns = new Map<string, RestaurantChargeBreakdown>();
  if (bookingIds.length === 0) return breakdowns;

  const { data: orders, error: ordersError } = await supabase
    .from("restaurant_orders")
    .select("id, booking_id")
    .in("booking_id", bookingIds);

  if (ordersError) throw ordersError;

  const orderRecords = (orders ?? []) as RestaurantOrderRecord[];
  const orderIds = orderRecords
    .map((order) => String(order.id || "").trim())
    .filter(Boolean);

  if (orderIds.length === 0) return breakdowns;

  const { data: items, error: itemsError } = await supabase
    .from("restaurant_order_items")
    .select("order_id, line_total, is_minimart")
    .in("order_id", orderIds);

  if (itemsError) throw itemsError;

  const itemsByOrderId = new Map<string, RestaurantOrderItemRecord[]>();
  for (const item of (items ?? []) as RestaurantOrderItemRecord[]) {
    const orderItems = itemsByOrderId.get(item.order_id) ?? [];
    orderItems.push(item);
    itemsByOrderId.set(item.order_id, orderItems);
  }

  for (const order of orderRecords) {
    const bookingId = String(order.booking_id || "").trim();
    if (!bookingId) continue;

    const existing = breakdowns.get(bookingId) ?? {
      food_amount: 0,
      minimart_amount: 0,
      has_snapshot_lines: false,
    };
    const next = getRestaurantChargeBreakdown(itemsByOrderId.get(order.id) ?? []);

    breakdowns.set(bookingId, {
      food_amount: roundMoney(existing.food_amount + next.food_amount),
      minimart_amount: roundMoney(existing.minimart_amount + next.minimart_amount),
      has_snapshot_lines: existing.has_snapshot_lines || next.has_snapshot_lines,
    });
  }

  return breakdowns;
}

async function fetchExpenses(supabase: SupabaseAdmin, ids: string[]) {
  if (ids.length === 0) return [] as ExpenseRecord[];

  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, payment_method, category, description")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as ExpenseRecord[];
}

async function fetchSnapshotHeader(supabase: SupabaseAdmin, shiftLogId: string) {
  const { data, error } = await supabase
    .from("shift_cash_reports")
    .select("*")
    .eq("shift_log_id", shiftLogId)
    .maybeSingle();

  if (error) {
    if (isMissingShiftCashReportTable(error)) return null;
    throw error;
  }
  return data;
}

async function fetchSnapshotRows(supabase: SupabaseAdmin, reportId: string) {
  const { data, error } = await supabase
    .from("shift_cash_report_rows")
    .select("*")
    .eq("report_id", reportId)
    .order("row_order", { ascending: true });

  if (error) {
    if (isMissingShiftCashReportTable(error)) return [];
    throw error;
  }
  return data ?? [];
}

async function fetchIncomingTurnovers(supabase: SupabaseAdmin, shiftId: string, reportDate: string) {
  const turnoverSelect = `
      source_shift_log_id,
      booking_id,
      room_no,
      guest_name,
      scheduled_check_in_at,
      scheduled_check_out_at,
      remaining_balance_due,
      check_in_at,
      check_out_at,
      room_rate,
      extra_bed_amount,
      extra_person_amount,
      linens_amount,
      charge_amount,
      early_checkin_amount,
      late_checkout_amount,
      minimart_amount,
      food_amount,
      collectible_amount,
      total_amount,
      latest_activity_at
    `;
  const legacyTurnoverSelect = `
      source_shift_log_id,
      booking_id,
      room_no,
      guest_name,
      scheduled_check_in_at,
      scheduled_check_out_at,
      remaining_balance_due,
      check_in_at,
      check_out_at,
      room_rate,
      extra_bed_amount,
      extra_person_amount,
      linens_amount,
      charge_amount,
      early_checkin_amount,
      late_checkout_amount,
      minimart_amount,
      food_amount,
      total_amount,
      latest_activity_at
    `;
  let { data, error } = await supabase
    .from("shift_cash_report_turnovers")
    .select(turnoverSelect)
    .eq("target_shift_id", shiftId)
    .eq("target_date", reportDate)
    .order("created_at", { ascending: true });

  if (error && isMissingTurnoverCollectibleColumn(error)) {
    const fallback = await supabase
      .from("shift_cash_report_turnovers")
      .select(legacyTurnoverSelect)
      .eq("target_shift_id", shiftId)
      .eq("target_date", reportDate)
      .order("created_at", { ascending: true });
    data = fallback.data as any;
    error = fallback.error;
  }

  if (error) {
    if (isMissingShiftCashReportTable(error)) return [];
    throw error;
  }

  const sourceShiftLogIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.source_shift_log_id || "").trim())
        .filter(Boolean),
    ),
  );
  const sourceShiftNames = await fetchShiftNamesByLogIds(supabase, sourceShiftLogIds);

  return (data ?? []).map((row: any) => ({
    booking_id: row.booking_id || null,
    room_no: String(row.room_no || ""),
    guest_name: String(row.guest_name || "Unknown Guest"),
    scheduled_check_in_at: row.scheduled_check_in_at || null,
    scheduled_check_out_at: row.scheduled_check_out_at || null,
    remaining_balance_due: roundMoney(toMoneyNumber(row.remaining_balance_due || row.collectible_amount || row.total_amount)),
    check_in_at: row.check_in_at || null,
    check_out_at: row.check_out_at || null,
    room_rate: roundMoney(toMoneyNumber(row.room_rate)),
    extra_bed_amount: roundMoney(toMoneyNumber(row.extra_bed_amount)),
    extra_person_amount: roundMoney(toMoneyNumber(row.extra_person_amount)),
    linens_amount: roundMoney(toMoneyNumber(row.linens_amount)),
    charge_amount: roundMoney(toMoneyNumber(row.charge_amount)),
    early_checkin_amount: roundMoney(toMoneyNumber(row.early_checkin_amount)),
    late_checkout_amount: roundMoney(toMoneyNumber(row.late_checkout_amount)),
    minimart_amount: roundMoney(toMoneyNumber(row.minimart_amount)),
    food_amount: roundMoney(toMoneyNumber(row.food_amount)),
    total_amount: roundMoney(toMoneyNumber(row.collectible_amount ?? row.total_amount)),
    collectible_amount: roundMoney(toMoneyNumber(row.collectible_amount ?? row.total_amount)),
    latest_activity_at: row.latest_activity_at || null,
    source_shift_log_id: row.source_shift_log_id || null,
    source_shift_name: sourceShiftNames.get(String(row.source_shift_log_id || "")) ?? null,
  })) as ShiftCashTurnoverRow[];
}

async function fetchShiftNamesByLogIds(supabase: SupabaseAdmin, shiftLogIds: string[]) {
  if (shiftLogIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("shift_logs")
    .select("id, shift_id")
    .in("id", shiftLogIds);

  if (error) throw error;

  const shiftIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.shift_id || "").trim())
        .filter(Boolean),
    ),
  );
  const shiftsById = await fetchShiftsByIds(supabase, shiftIds);

  return new Map(
    (data ?? []).map((row) => [row.id, shiftsById.get(row.shift_id)?.name || ""]),
  );
}

function mapSnapshotRow(row: any): ShiftCashReportRow {
  return {
    booking_id: row.booking_id || null,
    room_no: String(row.room_no || ""),
    guest_name: String(row.guest_name || "Unknown Guest"),
    scheduled_check_in_at: row.scheduled_check_in_at || null,
    scheduled_check_out_at: row.scheduled_check_out_at || null,
    remaining_balance_due: roundMoney(toMoneyNumber(row.remaining_balance_due)),
    check_in_at: row.check_in_at || null,
    check_out_at: row.check_out_at || null,
    room_rate: roundMoney(toMoneyNumber(row.room_rate)),
    extra_bed_amount: roundMoney(toMoneyNumber(row.extra_bed_amount)),
    extra_person_amount: roundMoney(toMoneyNumber(row.extra_person_amount)),
    linens_amount: roundMoney(toMoneyNumber(row.linens_amount)),
    charge_amount: roundMoney(toMoneyNumber(row.charge_amount)),
    early_checkin_amount: roundMoney(toMoneyNumber(row.early_checkin_amount)),
    late_checkout_amount: roundMoney(toMoneyNumber(row.late_checkout_amount)),
    minimart_amount: roundMoney(toMoneyNumber(row.minimart_amount)),
    food_amount: roundMoney(toMoneyNumber(row.food_amount)),
    cash_amount: roundMoney(toMoneyNumber(row.cash_amount)),
    gcash_amount: roundMoney(toMoneyNumber(row.gcash_amount)),
    card_amount: roundMoney(toMoneyNumber(row.card_amount)),
    cheque_amount: roundMoney(toMoneyNumber(row.cheque_amount)),
    qrph_amount: roundMoney(toMoneyNumber(row.qrph_amount)),
    total_amount: roundMoney(toMoneyNumber(row.total_amount)),
    payment_count: Number(row.payment_count || 0),
    reference_numbers: Array.isArray(row.reference_numbers) ? row.reference_numbers : [],
    latest_activity_at: row.latest_activity_at || null,
  };
}

export function buildCollectibleTurnovers(params: {
  activityRows: ShiftCashReportRow[];
  incomingTurnoverRows: ShiftCashTurnoverRow[];
  bookingsById: Map<string, BookingRecord>;
  bookingExtrasById: Map<string, BookingExtraRecord[]>;
  restaurantChargesByBookingId?: Map<string, RestaurantChargeBreakdown>;
}) {
  const candidateStateByBookingId = new Map<string, { latest_activity_at: string | null }>();

  for (const row of params.activityRows) {
    if (!row.booking_id) continue;
    candidateStateByBookingId.set(row.booking_id, {
      latest_activity_at: getLaterTimestamp(
        candidateStateByBookingId.get(row.booking_id)?.latest_activity_at,
        row.latest_activity_at,
      ),
    });
  }

  for (const row of params.incomingTurnoverRows) {
    if (!row.booking_id) continue;
    candidateStateByBookingId.set(row.booking_id, {
      latest_activity_at: getLaterTimestamp(
        candidateStateByBookingId.get(row.booking_id)?.latest_activity_at,
        row.latest_activity_at,
      ),
    });
  }

  return sortRows(
    Array.from(candidateStateByBookingId.entries()).flatMap(([bookingId, state]) => {
      const booking = params.bookingsById.get(bookingId);
      if (!booking?.actual_check_in_at || booking.actual_check_out_at) return [];

      const collectibleAmount = roundMoney(toMoneyNumber(booking.balance_due));
      if (collectibleAmount <= 0) return [];

      const baseRow = createBaseRow(
        booking,
        params.bookingExtrasById.get(bookingId) ?? [],
        params.restaurantChargesByBookingId?.get(bookingId) ?? null,
      );
      const paidBeforeCollectible = roundMoney(
        Math.max(0, getChargeBreakdownTotal(baseRow) - collectibleAmount),
      );
      const collectibleBreakdown = allocateChargeBreakdown(
        baseRow,
        paidBeforeCollectible,
        collectibleAmount,
      );
      return [{
        ...baseRow,
        ...collectibleBreakdown,
        total_amount: collectibleAmount,
        collectible_amount: collectibleAmount,
        latest_activity_at: state.latest_activity_at,
        source_shift_log_id: null,
        source_shift_name: null,
      }];
    }),
  );
}

async function buildLiveReportFromShiftLog(shiftLog: ShiftLogRecord, supabase: SupabaseAdmin): Promise<ShiftCashReport> {
  const transactions = await fetchShiftTransactions(supabase, shiftLog.id);
  const bookingIncomeTransactions = transactions.filter(
    (transaction) => transaction.source === "booking" && transaction.type === "INCOME" && transaction.reference_id,
  );
  const expenseTransactions = transactions.filter(
    (transaction) => transaction.source === "expense" && transaction.type === "EXPENSE" && transaction.reference_id,
  );

  const bookingReferenceIds = bookingIncomeTransactions
    .map((transaction) => String(transaction.reference_id || "").trim())
    .filter(Boolean);
  const expenseReferenceIds = expenseTransactions
    .map((transaction) => String(transaction.reference_id || "").trim())
    .filter(Boolean);
  const transactionByReferenceId = new Map(
    bookingIncomeTransactions.map((transaction) => [String(transaction.reference_id), transaction]),
  );

  const payments = await fetchPayments(supabase, bookingReferenceIds);
  const paymentIds = new Set(payments.map((payment) => payment.id));
  const receivablePayments = await fetchReceivablePayments(
    supabase,
    bookingReferenceIds.filter((referenceId) => !paymentIds.has(referenceId)),
  );

  const bookingIds = Array.from(
    new Set(
      [
        ...payments.map((payment) => payment.booking_id || null),
        ...receivablePayments.map((payment) => getReceivableBookingId(payment)),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const [bookings, bookingExtras, restaurantChargesByBookingId, expenses, turnoverRows] = await Promise.all([
    fetchBookings(supabase, bookingIds),
    fetchBookingExtras(supabase, bookingIds),
    fetchRestaurantChargeBreakdowns(supabase, bookingIds),
    fetchExpenses(supabase, expenseReferenceIds),
    fetchIncomingTurnovers(supabase, shiftLog.shift_id, shiftLog.date),
  ]);

  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const bookingExtrasById = new Map<string, BookingExtraRecord[]>();
  for (const extra of bookingExtras) {
    const extrasForBooking = bookingExtrasById.get(extra.booking_id) ?? [];
    extrasForBooking.push(extra);
    bookingExtrasById.set(extra.booking_id, extrasForBooking);
  }

  const rowsByBookingId = new Map<string, ShiftCashReportRow>();

  for (const payment of payments) {
    if (!payment.booking_id) continue;

    const booking = bookingsById.get(payment.booking_id);
    const extrasForBooking = bookingExtrasById.get(payment.booking_id) ?? [];
    const existing = rowsByBookingId.get(payment.booking_id)
      ?? createBaseRow(booking, extrasForBooking, restaurantChargesByBookingId.get(payment.booking_id) ?? null);
    const amount = roundMoney(toMoneyNumber(payment.amount));
    const bucket = getMethodBucket(payment.method);
    const referenceNumbers = getPaymentReferenceNumbers(payment);
    const transaction = transactionByReferenceId.get(payment.id);
    const activityAt = transaction?.created_at || payment.transaction_time || payment.created_at || null;

    existing[bucket] = roundMoney(existing[bucket] + amount);
    existing.total_amount = roundMoney(existing.total_amount + amount);
    existing.payment_count += 1;
    existing.reference_numbers = normalizeRefNumbers([
      ...existing.reference_numbers,
      ...referenceNumbers,
    ]);
    existing.latest_activity_at =
      !existing.latest_activity_at || (activityAt && new Date(activityAt).getTime() > new Date(existing.latest_activity_at).getTime())
        ? activityAt
        : existing.latest_activity_at;

    rowsByBookingId.set(payment.booking_id, existing);
  }

  for (const receivablePayment of receivablePayments) {
    const bookingId = getReceivableBookingId(receivablePayment);
    if (!bookingId) continue;

    const booking = bookingsById.get(bookingId);
    const extrasForBooking = bookingExtrasById.get(bookingId) ?? [];
    const existing = rowsByBookingId.get(bookingId)
      ?? createBaseRow(booking, extrasForBooking, restaurantChargesByBookingId.get(bookingId) ?? null);
    const amount = roundMoney(toMoneyNumber(receivablePayment.amount));
    const bucket = getMethodBucket(receivablePayment.method);
    const referenceNumbers = getReceivablePaymentReferenceNumbers(receivablePayment);
    const transaction = transactionByReferenceId.get(receivablePayment.id);
    const activityAt = transaction?.created_at || receivablePayment.created_at || null;

    existing[bucket] = roundMoney(existing[bucket] + amount);
    existing.total_amount = roundMoney(existing.total_amount + amount);
    existing.payment_count += 1;
    existing.reference_numbers = normalizeRefNumbers([
      ...existing.reference_numbers,
      ...referenceNumbers,
    ]);
    existing.latest_activity_at =
      !existing.latest_activity_at || (activityAt && new Date(activityAt).getTime() > new Date(existing.latest_activity_at).getTime())
        ? activityAt
        : existing.latest_activity_at;

    rowsByBookingId.set(bookingId, existing);
  }

  const paymentActivityRows = sortRows(Array.from(rowsByBookingId.values())).map((row) => {
    const booking = row.booking_id ? bookingsById.get(row.booking_id) : null;
    const extrasForBooking = row.booking_id ? (bookingExtrasById.get(row.booking_id) ?? []) : [];
    const restaurantBreakdown = row.booking_id
      ? (restaurantChargesByBookingId.get(row.booking_id) ?? null)
      : null;
    const fullChargeBreakdown = getRowChargeBreakdown(booking, extrasForBooking, restaurantBreakdown);
    const currentShiftCollected = roundMoney(row.total_amount);
    const totalCharges = getChargeBreakdownTotal(fullChargeBreakdown);
    const remainingBalanceDue = roundMoney(toMoneyNumber(booking?.balance_due));
    const priorPaid = roundMoney(Math.max(0, totalCharges - remainingBalanceDue - currentShiftCollected));
    const collectedBreakdown = allocateChargeBreakdown(
      fullChargeBreakdown,
      priorPaid,
      currentShiftCollected,
    );

    return {
      ...row,
      ...collectedBreakdown,
      remaining_balance_due: remainingBalanceDue,
      cash_amount: roundMoney(row.cash_amount),
      gcash_amount: roundMoney(row.gcash_amount),
      card_amount: roundMoney(row.card_amount),
      cheque_amount: roundMoney(row.cheque_amount),
      qrph_amount: roundMoney(row.qrph_amount),
      total_amount: currentShiftCollected,
    };
  });

  // ── Carry checked-in bookings with outstanding balances ─────────────
  // Ensures bookings that are checked in (even without payments during
  // this shift) appear in the shift booking sheet and become candidates
  // for turnover when the shift closes.
  const coveredBookingIds = new Set([
    ...paymentActivityRows.map((r) => r.booking_id),
    ...turnoverRows.map((r) => r.booking_id),
  ].filter((v): v is string => Boolean(v)));

  const allCheckedInIds = await fetchActiveCheckedInBookingIds(supabase);
  const uncoveredIds = allCheckedInIds.filter((id) => !coveredBookingIds.has(id));
  const uncoveredCheckedInRows: ShiftCashReportRow[] = [];

  if (uncoveredIds.length > 0) {
    const [ucBookings, ucExtras, ucRestaurantCharges] = await Promise.all([
      fetchBookings(supabase, uncoveredIds),
      fetchBookingExtras(supabase, uncoveredIds),
      fetchRestaurantChargeBreakdowns(supabase, uncoveredIds),
    ]);

    const ucExtrasById = new Map<string, BookingExtraRecord[]>();
    for (const extra of ucExtras) {
      const arr = ucExtrasById.get(extra.booking_id) ?? [];
      arr.push(extra);
      ucExtrasById.set(extra.booking_id, arr);
    }

    for (const booking of ucBookings) {
      const row = createBaseRow(
        booking,
        ucExtrasById.get(booking.id) ?? [],
        ucRestaurantCharges.get(booking.id) ?? null,
      );
      row.latest_activity_at = booking.actual_check_in_at || null;
      row.room_rate = 0;
      uncoveredCheckedInRows.push(row);
    }
  }

  const allActivityRows = sortRows([...paymentActivityRows, ...uncoveredCheckedInRows]);
  const summary = buildSummary(allActivityRows, expenses);
  summary.turnover_row_count = turnoverRows.length;
  const sortedTurnoverRows = sortRows(turnoverRows);

  return {
    shift_log: shiftLog,
    summary,
    activity_rows: mergeIncomingTurnoversIntoActivityRows(allActivityRows, sortedTurnoverRows),
    turnover_rows: sortedTurnoverRows,
    expense_summary: {
      cash_paid: summary.total_cash_expenses,
      non_cash_paid: summary.total_non_cash_expenses,
      total: summary.total_expenses,
      expense_count: expenses.length,
    },
    export_template_version: EXPORT_TEMPLATE_VERSION,
    report_mode: "live",
  };
}

export async function getCurrentShiftCashReport() {
  const supabase = getSupabaseAdmin();
  const { shiftLog } = await getOrCreateActiveShiftLog();
  return getShiftCashReportById(shiftLog.id, { supabase });
}

export async function getShiftCashReportById(
  shiftLogId: string,
  options?: { supabase?: SupabaseAdmin },
): Promise<ShiftCashReport> {
  const supabase = options?.supabase ?? getSupabaseAdmin();
  const shiftLog = await fetchShiftLog(supabase, shiftLogId);
  const snapshot = shiftLog.status === "CLOSED" ? await fetchSnapshotHeader(supabase, shiftLogId) : null;

  if (snapshot) {
    const snapshotVersion = Number(snapshot.export_template_version || 0);

    if (snapshotVersion < EXPORT_TEMPLATE_VERSION) {
      const liveReport = await buildLiveReportFromShiftLog(shiftLog, supabase);

      return {
        shift_log: shiftLog,
        summary: {
          total_cash: roundMoney(toMoneyNumber(snapshot.total_cash ?? liveReport.summary.total_cash)),
          total_gcash: roundMoney(toMoneyNumber(snapshot.total_gcash ?? liveReport.summary.total_gcash)),
          total_card: roundMoney(toMoneyNumber(snapshot.total_card ?? liveReport.summary.total_card)),
          total_cheque: roundMoney(toMoneyNumber(snapshot.total_cheque ?? liveReport.summary.total_cheque)),
          total_qrph: roundMoney(toMoneyNumber(snapshot.total_qrph ?? liveReport.summary.total_qrph)),
          total_amount: roundMoney(toMoneyNumber(snapshot.total_amount ?? liveReport.summary.total_amount)),
          total_cash_expenses: roundMoney(toMoneyNumber(snapshot.total_cash_expenses ?? liveReport.summary.total_cash_expenses)),
          total_non_cash_expenses: roundMoney(toMoneyNumber(snapshot.total_non_cash_expenses ?? liveReport.summary.total_non_cash_expenses)),
          total_expenses: roundMoney(toMoneyNumber(snapshot.total_expenses ?? liveReport.summary.total_expenses)),
          cash_on_hand: roundMoney(toMoneyNumber(snapshot.cash_on_hand ?? liveReport.summary.cash_on_hand)),
          activity_row_count: liveReport.activity_rows.length,
          turnover_row_count: liveReport.turnover_rows.length,
        },
        activity_rows: liveReport.activity_rows,
        turnover_rows: liveReport.turnover_rows,
        expense_summary: liveReport.expense_summary,
        export_template_version: snapshotVersion || EXPORT_TEMPLATE_VERSION,
        report_mode: "snapshot",
      };
    }

    const [rows, turnoverRows] = await Promise.all([
      fetchSnapshotRows(supabase, snapshot.id),
      fetchIncomingTurnovers(supabase, shiftLog.shift_id, shiftLog.date),
    ]);
    const activityRows = rows.map(mapSnapshotRow);
    const sortedTurnoverRows = sortRows(turnoverRows);

    return {
      shift_log: shiftLog,
      summary: {
        total_cash: roundMoney(toMoneyNumber(snapshot.total_cash)),
        total_gcash: roundMoney(toMoneyNumber(snapshot.total_gcash)),
        total_card: roundMoney(toMoneyNumber(snapshot.total_card)),
        total_cheque: roundMoney(toMoneyNumber(snapshot.total_cheque)),
        total_qrph: roundMoney(toMoneyNumber(snapshot.total_qrph)),
        total_amount: roundMoney(toMoneyNumber(snapshot.total_amount)),
        total_cash_expenses: roundMoney(toMoneyNumber(snapshot.total_cash_expenses)),
        total_non_cash_expenses: roundMoney(toMoneyNumber(snapshot.total_non_cash_expenses)),
        total_expenses: roundMoney(toMoneyNumber(snapshot.total_expenses)),
        cash_on_hand: roundMoney(toMoneyNumber(snapshot.cash_on_hand)),
        activity_row_count: Number(snapshot.activity_row_count || activityRows.length),
        turnover_row_count: Number(snapshot.turnover_row_count || turnoverRows.length),
      },
      activity_rows: activityRows,
      turnover_rows: sortedTurnoverRows,
      expense_summary: {
        cash_paid: roundMoney(toMoneyNumber(snapshot.total_cash_expenses)),
        non_cash_paid: roundMoney(toMoneyNumber(snapshot.total_non_cash_expenses)),
        total: roundMoney(toMoneyNumber(snapshot.total_expenses)),
        expense_count: 0,
      },
      export_template_version: Number(snapshot.export_template_version || EXPORT_TEMPLATE_VERSION),
      report_mode: "snapshot",
    };
  }

  return buildLiveReportFromShiftLog(shiftLog, supabase);
}

export async function finalizeShiftCashReport(shiftLogId: string, options?: { supabase?: SupabaseAdmin }) {
  const supabase = options?.supabase ?? getSupabaseAdmin();
  const shiftLog = await fetchShiftLog(supabase, shiftLogId);

  if (shiftLog.status !== "CLOSED") {
    throw new Error("Shift cash reports can only be finalized after the shift ledger is closed.");
  }

  const activeShifts = await fetchActiveShifts(supabase);
  const report = await buildLiveReportFromShiftLog(shiftLog, supabase);
  const target = getNextShiftTarget(activeShifts, shiftLog.shift_id, shiftLog.date);
  const turnoverCandidateBookingIds = Array.from(
    new Set(
      [
        ...report.activity_rows.map((row) => row.booking_id),
        ...report.turnover_rows.map((row) => row.booking_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const [turnoverBookings, turnoverBookingExtras, turnoverRestaurantChargesByBookingId] = await Promise.all([
    fetchBookings(supabase, turnoverCandidateBookingIds),
    fetchBookingExtras(supabase, turnoverCandidateBookingIds),
    fetchRestaurantChargeBreakdowns(supabase, turnoverCandidateBookingIds),
  ]);
  const turnoverBookingsById = new Map(turnoverBookings.map((booking) => [booking.id, booking]));
  const turnoverBookingExtrasById = new Map<string, BookingExtraRecord[]>();
  for (const extra of turnoverBookingExtras) {
    const extrasForBooking = turnoverBookingExtrasById.get(extra.booking_id) ?? [];
    extrasForBooking.push(extra);
    turnoverBookingExtrasById.set(extra.booking_id, extrasForBooking);
  }
  const outgoingTurnovers = buildCollectibleTurnovers({
    activityRows: report.activity_rows,
    incomingTurnoverRows: report.turnover_rows,
    bookingsById: turnoverBookingsById,
    bookingExtrasById: turnoverBookingExtrasById,
    restaurantChargesByBookingId: turnoverRestaurantChargesByBookingId,
  });

  const { data: savedReport, error: reportError } = await supabase
    .from("shift_cash_reports")
    .upsert({
      shift_log_id: shiftLog.id,
      shift_id: shiftLog.shift_id,
      report_date: shiftLog.date,
      total_cash: report.summary.total_cash,
      total_gcash: report.summary.total_gcash,
      total_card: report.summary.total_card,
      total_cheque: report.summary.total_cheque,
      total_qrph: report.summary.total_qrph,
      total_amount: report.summary.total_amount,
      total_cash_expenses: report.summary.total_cash_expenses,
      total_non_cash_expenses: report.summary.total_non_cash_expenses,
      total_expenses: report.summary.total_expenses,
      cash_on_hand: report.summary.cash_on_hand,
      activity_row_count: report.activity_rows.length,
      turnover_row_count: report.turnover_rows.length,
      export_template_version: EXPORT_TEMPLATE_VERSION,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "shift_log_id",
    })
    .select()
    .single();

  if (reportError || !savedReport) {
    if (isMissingShiftCashReportTable(reportError)) {
      return {
        report_id: null,
        shift_log_id: shiftLog.id,
        target_shift: target,
      };
    }
    throw reportError || new Error("Unable to save shift cash report snapshot.");
  }

  const { error: deleteRowsError } = await supabase
    .from("shift_cash_report_rows")
    .delete()
    .eq("report_id", savedReport.id);
  if (deleteRowsError && !isMissingShiftCashReportTable(deleteRowsError)) {
    throw deleteRowsError;
  }

  const { error: deleteTurnoversError } = await supabase
    .from("shift_cash_report_turnovers")
    .delete()
    .eq("source_report_id", savedReport.id);
  if (deleteTurnoversError && !isMissingShiftCashReportTable(deleteTurnoversError)) {
    throw deleteTurnoversError;
  }

  if (report.activity_rows.length > 0) {
    const rowPayload = report.activity_rows.map((row, index) => ({
      report_id: savedReport.id,
      shift_log_id: shiftLog.id,
      booking_id: row.booking_id,
      row_order: index + 1,
      room_no: row.room_no || null,
      guest_name: row.guest_name,
      scheduled_check_in_at: row.scheduled_check_in_at,
      scheduled_check_out_at: row.scheduled_check_out_at,
      remaining_balance_due: row.remaining_balance_due,
      check_in_at: row.check_in_at,
      check_out_at: row.check_out_at,
      room_rate: row.room_rate,
      extra_bed_amount: row.extra_bed_amount,
      extra_person_amount: row.extra_person_amount,
      linens_amount: row.linens_amount,
      charge_amount: row.charge_amount,
      minimart_amount: row.minimart_amount,
      food_amount: row.food_amount,
      cash_amount: row.cash_amount,
      gcash_amount: row.gcash_amount,
      card_amount: row.card_amount,
      cheque_amount: row.cheque_amount,
      qrph_amount: row.qrph_amount,
      total_amount: row.total_amount,
      payment_count: row.payment_count,
      reference_numbers: row.reference_numbers,
      latest_activity_at: row.latest_activity_at,
    }));

    const { error: rowError } = await supabase
      .from("shift_cash_report_rows")
      .insert(rowPayload);
    let finalRowError = rowError;

    if (rowError && isMissingReservationScheduleColumns(rowError)) {
      const fallbackInsert = await supabase
        .from("shift_cash_report_rows")
        .insert(
          rowPayload.map(
            ({ scheduled_check_in_at, scheduled_check_out_at, remaining_balance_due, ...legacyPayload }) => legacyPayload,
          ),
        );
      finalRowError = fallbackInsert.error;
    }

    if (finalRowError) {
      if (isMissingShiftCashReportTable(finalRowError)) {
        return {
          report_id: savedReport.id,
          shift_log_id: shiftLog.id,
          target_shift: target,
        };
      }
      throw finalRowError;
    }
  }

  if (outgoingTurnovers.length > 0) {
    const turnoverPayload = outgoingTurnovers.map((row) => ({
      source_report_id: savedReport.id,
      source_shift_log_id: shiftLog.id,
      target_shift_id: target.shift_id,
      target_date: target.date,
      booking_id: row.booking_id,
      room_no: row.room_no || null,
      guest_name: row.guest_name,
      scheduled_check_in_at: row.scheduled_check_in_at,
      scheduled_check_out_at: row.scheduled_check_out_at,
      remaining_balance_due: row.remaining_balance_due,
      check_in_at: row.check_in_at,
      check_out_at: row.check_out_at,
      room_rate: row.room_rate,
      extra_bed_amount: row.extra_bed_amount,
      extra_person_amount: row.extra_person_amount,
      linens_amount: row.linens_amount,
      charge_amount: row.charge_amount,
      minimart_amount: row.minimart_amount,
      food_amount: row.food_amount,
      collectible_amount: row.collectible_amount,
      total_amount: row.collectible_amount,
      latest_activity_at: row.latest_activity_at,
    }));

    const { error: turnoverError } = await supabase
      .from("shift_cash_report_turnovers")
      .insert(turnoverPayload);
    let finalTurnoverError = turnoverError;
    if (turnoverError && isMissingTurnoverCollectibleColumn(turnoverError)) {
      const fallbackInsert = await supabase
        .from("shift_cash_report_turnovers")
        .insert(
          turnoverPayload.map(
            ({ collectible_amount, scheduled_check_in_at, scheduled_check_out_at, remaining_balance_due, ...legacyPayload }) => legacyPayload
          )
        );
      finalTurnoverError = fallbackInsert.error;
    }

    if (finalTurnoverError) {
      if (isMissingShiftCashReportTable(finalTurnoverError)) {
        return {
          report_id: savedReport.id,
          shift_log_id: shiftLog.id,
          target_shift: target,
        };
      }
      throw finalTurnoverError;
    }
  }

  return {
    report_id: savedReport.id,
    shift_log_id: shiftLog.id,
    target_shift: target,
  };
}

function getDisplayDateTime(value: string | null | undefined, timezone = "Asia/Manila") {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDatePartInTimezone(value: string | null | undefined, timezone = "Asia/Manila") {
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsed);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function normalizeScheduleTime(value: string | null | undefined, fallback: string) {
  const candidate = String(value || "").trim();
  if (/^\d{2}:\d{2}$/.test(candidate)) return candidate;
  return fallback;
}

function buildScheduleDateTime(
  value: string | null | undefined,
  time: string,
  timezone: string,
  offset: string,
) {
  if (!value) return "";

  const datePart = getDatePartInTimezone(value, timezone);
  if (!datePart) return getDisplayDateTime(value, timezone);

  return getDisplayDateTime(`${datePart}T${time}:00${offset}`, timezone);
}

export function getReservationScheduleDisplay(
  row: Pick<
    ShiftCashReportRow,
    "check_in_at" | "scheduled_check_in_at" | "scheduled_check_out_at" | "remaining_balance_due" | "latest_activity_at"
  >,
  config: Pick<Awaited<ReturnType<typeof getGlobalTimeConfig>>, "timezone" | "offset" | "check_in_time" | "check_out_time"> = {
    timezone: "Asia/Manila",
    offset: "+08:00",
    check_in_time: "14:00",
    check_out_time: "12:00",
  },
) {
  if (row.check_in_at) return "";
  if (!row.scheduled_check_in_at || !row.scheduled_check_out_at) return "";

  const checkInTime = normalizeScheduleTime(config.check_in_time, "14:00");
  const checkOutTime = normalizeScheduleTime(config.check_out_time, "12:00");
  const scheduleTimezone = config.timezone || "Asia/Manila";
  const scheduleOffset = config.offset || "+08:00";

  return `CI: ${buildScheduleDateTime(row.scheduled_check_in_at, checkInTime, scheduleTimezone, scheduleOffset)}\r\nCO: ${buildScheduleDateTime(row.scheduled_check_out_at, checkOutTime, scheduleTimezone, scheduleOffset)}`;
}

function setCurrencyStyle(cell: ExcelJS.Cell) {
  cell.numFmt = "#,##0.00";
}

function setCompactDateTimeStyle(cell: ExcelJS.Cell, maxSize = 9) {
  cell.font = {
    ...(cell.font || {}),
    size: Math.min(cell.font?.size ?? 11, maxSize),
  };
  cell.alignment = {
    ...(cell.alignment || {}),
    wrapText: false,
    shrinkToFit: true,
    vertical: cell.alignment?.vertical ?? "middle",
  };
}

function setScheduleCellStyle(cell: ExcelJS.Cell) {
  cell.font = {
    ...(cell.font || {}),
    size: 9,
  };
  cell.alignment = {
    wrapText: true,
    vertical: "top",
    horizontal: "left",
  };
}

function getPaymentColumnBorder(
  columnNumber: number,
  options?: { topStyle?: "thin" | "medium"; bottomStyle?: "thin" | "medium" },
) {
  return {
    left: { style: columnNumber === PAYMENT_START_COLUMN ? "medium" : "thin" },
    right: { style: columnNumber === PAYMENT_END_COLUMN ? "medium" : "thin" },
    top: { style: options?.topStyle ?? "thin" },
    bottom: { style: options?.bottomStyle ?? "thin" },
  } as Partial<ExcelJS.Borders>;
}

function setOutlineBorder(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  options?: { topStyle?: "thin" | "medium"; bottomStyle?: "thin" | "medium"; leftStyle?: "thin" | "medium"; rightStyle?: "thin" | "medium" },
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = worksheet.getCell(row, column);
      cell.border = {
        ...(cell.border || {}),
        ...(row === startRow ? { top: { style: options?.topStyle ?? "thin" } } : {}),
        ...(row === endRow ? { bottom: { style: options?.bottomStyle ?? "thin" } } : {}),
        ...(column === startColumn ? { left: { style: options?.leftStyle ?? "thin" } } : {}),
        ...(column === endColumn ? { right: { style: options?.rightStyle ?? "thin" } } : {}),
      };
    }
  }
}

function resetWorksheetLayout(worksheet: ExcelJS.Worksheet) {
  const existingMerges = [...(worksheet.model.merges ?? [])];
  for (const range of existingMerges) {
    worksheet.unMergeCells(range);
  }

  const widths = [
    2.6,
    6.9,
    24,
    24,
    17,
    17,
    10,
    8,
    8,
    8,
    9,
    10,
    9,
    10,
    10,
    11,
    11,
    11,
    11,
    11,
    11,
    16,
  ];

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  const headerBandStyle = cloneStyle(worksheet.getCell("A7").style);
  const totalBandStyle = cloneStyle(worksheet.getCell("M7").style);
  const extraBandStyle = cloneStyle(worksheet.getCell("G8").style);
  const paymentBandStyle = cloneStyle(worksheet.getCell("N8").style);
  const headerCellStyle = cloneStyle(worksheet.getCell("B8").style);
  const subHeaderCellStyle = cloneStyle(worksheet.getCell("B9").style);
  const dataCellStyles = Array.from(
    { length: WORKBOOK_TOTAL_COLUMNS },
    (_, index) => cloneStyle(worksheet.getCell(10, Math.min(index + 1, 20)).style),
  );

  worksheet.mergeCells("A7:O7");
  worksheet.mergeCells("P7:U7");
  worksheet.mergeCells("H8:O8");
  worksheet.mergeCells("P8:U8");

  worksheet.getCell("A7").style = cloneStyle(headerBandStyle);
  worksheet.getCell("P7").style = cloneStyle(totalBandStyle);
  worksheet.getCell("H8").style = cloneStyle(extraBandStyle);
  worksheet.getCell("P8").style = cloneStyle(paymentBandStyle);

  worksheet.getCell("A7").value = "ROOM ACCOMMODATION";
  worksheet.getCell("P7").value = "TOTAL";
  worksheet.getCell("H8").value = "EXTRAS";
  worksheet.getCell("P8").value = "PAYMENT METHODS";

  const row8Values = [
    "",
    "ROOM",
    "GUEST NAME:",
    "SCHEDULE",
    "CHECK-IN",
    "CHECK-OUT",
    "ROOM",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  const row9Values = [
    "",
    "No.",
    "",
    "",
    "DATE/TIME:",
    "DATE/TIME:",
    "RATE:",
    "BED:",
    "PERSON:",
    "LINENS:",
    "CHARGE:",
    "MINIMART:",
    "FOOD:",
    "EARLY C/I:",
    "LATE C/O:",
    "CASH",
    "GCASH",
    "CARD",
    "CHEQUE",
    "QRPH",
    "REF NO.",
  ];

  row8Values.forEach((value, index) => {
    const cell = worksheet.getCell(8, index + 1);
    if (!["H8", "P8"].includes(cell.address)) {
      cell.style = cloneStyle(headerCellStyle);
    }
    cell.value = value;
  });
  worksheet.getCell("H8").value = "EXTRAS";
  worksheet.getCell("P8").value = "PAYMENT METHODS";

  row9Values.forEach((value, index) => {
    const cell = worksheet.getCell(9, index + 1);
    cell.style = cloneStyle(subHeaderCellStyle);
    cell.value = value;
  });

  for (let column = 1; column <= WORKBOOK_TOTAL_COLUMNS; column += 1) {
    worksheet.getCell(10, column).style = cloneStyle(dataCellStyles[column - 1] ?? dataCellStyles[1]);
  }

  for (let column = PAYMENT_START_COLUMN; column <= PAYMENT_END_COLUMN; column += 1) {
    worksheet.getCell(9, column).border = getPaymentColumnBorder(column);
    worksheet.getCell(10, column).border = getPaymentColumnBorder(column);
  }

  setOutlineBorder(worksheet, 7, 8, PAYMENT_START_COLUMN, PAYMENT_END_COLUMN, {
    topStyle: "medium",
    bottomStyle: "thin",
    leftStyle: "medium",
    rightStyle: "medium",
  });
  for (let column = PAYMENT_START_COLUMN; column <= PAYMENT_END_COLUMN; column += 1) {
    const cell = worksheet.getCell(8, column);
    cell.border = {
      ...(cell.border || {}),
      top: { style: "medium" },
    };
  }
}

export async function generateShiftCashReportWorkbook(
  report: ShiftCashReport,
  options?: ShiftCashReportWorkbookOptions,
) {
  await fs.access(TEMPLATE_PATH);
  const timeConfig = await getGlobalTimeConfig();
  const { timezone } = timeConfig;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.worksheets[0];

  resetWorksheetLayout(worksheet);

  const extraRows = Math.max(0, report.activity_rows.length - TEMPLATE_ACTIVITY_SLOTS);
  if (extraRows > 0) {
    worksheet.spliceRows(24, 0, ...Array.from({ length: extraRows }, () => []));
  }

  const dataRowStyle = Array.from(
    { length: WORKBOOK_TOTAL_COLUMNS },
    (_, index) => cloneStyle(worksheet.getCell(ACTIVITY_START_ROW, Math.min(index + 1, 20)).style),
  );
  const totalRowIndex = FOOTER_TOTAL_CASH_ROW - 2 + extraRows;
  const totalLabelStyle = cloneStyle(worksheet.getCell(totalRowIndex, 1).style);
  const totalCellStyle = cloneStyle(worksheet.getCell(totalRowIndex, PAYMENT_START_COLUMN).style);

  worksheet.getCell("A5").value = `For ${report.shift_log.shifts?.name || "Shift"} / ${report.shift_log.date} / ${report.report_mode === "snapshot" ? "Final" : "Preview"}`;

  const visibleRows = Math.max(TEMPLATE_ACTIVITY_SLOTS, report.activity_rows.length);
  for (let offset = 0; offset < visibleRows; offset += 1) {
    const rowIndex = ACTIVITY_START_ROW + offset;
    const row = worksheet.getRow(rowIndex);
    for (let column = 1; column <= WORKBOOK_TOTAL_COLUMNS; column += 1) {
      row.getCell(column).style = cloneStyle(dataRowStyle[column - 1] ?? dataRowStyle[1]);
      row.getCell(column).value = null;
    }
    for (let column = PAYMENT_START_COLUMN; column <= PAYMENT_END_COLUMN; column += 1) {
      row.getCell(column).border = getPaymentColumnBorder(column);
    }

    const item = report.activity_rows[offset];
    if (!item) continue;

    row.getCell(1).value = offset + 1;
    row.getCell(2).value = item.room_no || "";
    row.getCell(3).value = item.guest_name;
    row.getCell(4).value = getReservationScheduleDisplay(item, timeConfig);
    row.getCell(5).value = getDisplayDateTime(item.check_in_at, timezone);
    row.getCell(6).value = getDisplayDateTime(item.check_out_at, timezone);
    setScheduleCellStyle(row.getCell(4));
    setCompactDateTimeStyle(row.getCell(5));
    setCompactDateTimeStyle(row.getCell(6));
    if (row.getCell(4).value) {
      row.height = Math.max(row.height ?? 15, 30);
    }
    row.getCell(7).value = item.payment_count > 0 || item.total_amount > 0 ? item.room_rate || null : null;
    row.getCell(8).value = item.extra_bed_amount || null;
    row.getCell(9).value = item.extra_person_amount || null;
    row.getCell(10).value = item.linens_amount || null;
    row.getCell(11).value = item.charge_amount || null;
    row.getCell(12).value = item.minimart_amount || null;
    row.getCell(13).value = item.food_amount || null;
    row.getCell(14).value = item.early_checkin_amount || null;
    row.getCell(15).value = item.late_checkout_amount || null;
    row.getCell(16).value = item.cash_amount || null;
    row.getCell(17).value = item.gcash_amount || null;
    row.getCell(18).value = item.card_amount || null;
    row.getCell(19).value = item.cheque_amount || null;
    row.getCell(20).value = item.qrph_amount || null;
    row.getCell(21).value = formatReferenceNumbersForWorkbook(item.reference_numbers);

    for (let column = 7; column <= 20; column += 1) {
      setCurrencyStyle(row.getCell(column));
    }
  }

  worksheet.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);
  worksheet.getCell(`A${totalRowIndex}`).style = cloneStyle(totalLabelStyle);
  worksheet.getCell(`A${totalRowIndex}`).value = "TOTAL";

  for (let column = 3; column <= WORKBOOK_TOTAL_COLUMNS; column += 1) {
    worksheet.getCell(totalRowIndex, column).style = cloneStyle(dataRowStyle[column - 1] ?? totalCellStyle);
  }

  const maxDataRow = ACTIVITY_START_ROW + visibleRows - 1;
  ["G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"].forEach((columnLetter) => {
    worksheet.getCell(`${columnLetter}${totalRowIndex}`).value = {
      formula: `SUM(${columnLetter}${ACTIVITY_START_ROW}:${columnLetter}${maxDataRow})`,
    };
    setCurrencyStyle(worksheet.getCell(`${columnLetter}${totalRowIndex}`));
  });

  for (let column = 1; column <= WORKBOOK_TOTAL_COLUMNS; column += 1) {
    const cell = worksheet.getCell(totalRowIndex, column);
    const baseBorder = cloneStyle((dataRowStyle[column - 1] as ExcelJS.Style | undefined)?.border ?? cell.border ?? {});
    cell.border = {
      ...baseBorder,
      top: { style: "medium" },
      bottom: { style: "medium" },
    };
  }

  for (let column = PAYMENT_START_COLUMN; column <= PAYMENT_END_COLUMN; column += 1) {
    worksheet.getCell(totalRowIndex, column).border = getPaymentColumnBorder(column, {
      topStyle: "medium",
      bottomStyle: "medium",
    });
  }

  const footerOffset = extraRows;
  worksheet.getCell(`E${FOOTER_TOTAL_CASH_ROW + footerOffset}`).value = report.summary.total_cash;
  worksheet.getCell(`E${FOOTER_LESS_EXPENSES_ROW + footerOffset}`).value = report.summary.total_cash_expenses;
  worksheet.getCell(`E${FOOTER_CASH_ON_HAND_ROW + footerOffset}`).value = report.summary.cash_on_hand;
  worksheet.getCell(`C${34 + footerOffset}`).value =
    String(options?.preparedByName || "").trim().toUpperCase() || " ";

  setCurrencyStyle(worksheet.getCell(`E${FOOTER_TOTAL_CASH_ROW + footerOffset}`));
  setCurrencyStyle(worksheet.getCell(`E${FOOTER_LESS_EXPENSES_ROW + footerOffset}`));
  setCurrencyStyle(worksheet.getCell(`E${FOOTER_CASH_ON_HAND_ROW + footerOffset}`));

  await worksheet.protect("dm-shift-report-readonly", {
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
