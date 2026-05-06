import { getSupabaseAdmin } from "@/lib/supabase";
import { getGlobalTimeConfig } from "./settings";

/**
 * Get the current time as HH:MM:SS string based on global settings.
 */
export async function manilaTimeString(d: Date = new Date(), supabaseClient?: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { timezone } = await getGlobalTimeConfig(supabaseClient);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Get the current date as YYYY-MM-DD string based on global settings.
 */
export async function manilaDateString(d: Date = new Date(), supabaseClient?: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { timezone } = await getGlobalTimeConfig(supabaseClient);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Parse a time string "HH:MM:SS" to minutes since midnight.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type ShiftDefinition = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
};

/**
 * Determine which shift a given Manila time falls into.
 * Handles overnight shifts (e.g., Night 22:00–06:00).
 */
export function detectShift(
  shifts: ShiftDefinition[],
  currentTime: string
): ShiftDefinition | null {
  const now = timeToMinutes(currentTime);

  for (const shift of shifts) {
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);

    if (start < end) {
      // Normal shift (e.g., 06:00–14:00)
      if (now >= start && now < end) return shift;
    } else {
      // Overnight shift (e.g., 22:00–06:00)
      if (now >= start || now < end) return shift;
    }
  }

  return null;
}

/**
 * Calculate minutes remaining until a shift ends.
 */
export function minutesUntilShiftEnd(
  shift: ShiftDefinition,
  currentTime: string
): number {
  const now = timeToMinutes(currentTime);
  const end = timeToMinutes(shift.end_time);
  const start = timeToMinutes(shift.start_time);

  if (start < end) {
    // Normal shift
    return Math.max(0, end - now);
  } else {
    // Overnight shift
    if (now >= start) {
      // Before midnight portion
      return (1440 - now) + end;
    } else {
      // After midnight portion
      return Math.max(0, end - now);
    }
  }
}

/**
 * Calculate how many minutes have elapsed since the scheduled shift end.
 * Only use this once the shift is already known to be in overtime.
 */
export function minutesPastShiftEnd(
  shift: ShiftDefinition,
  currentTime: string
): number {
  const now = timeToMinutes(currentTime);
  const end = timeToMinutes(shift.end_time);

  return (now - end + 1440) % 1440;
}

/**
 * Get the date to use for a shift_log entry.
 * For overnight shifts past midnight, use yesterday's date.
 */
export async function getShiftDate(
  shift: ShiftDefinition,
  manilaDate: string,
  manilaTime: string,
  supabaseClient?: ReturnType<typeof getSupabaseAdmin>
): Promise<string> {
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);
  const now = timeToMinutes(manilaTime);

  // Overnight shift and we're in the after-midnight portion
  if (start > end && now < end) {
    const { offset, timezone } = await getGlobalTimeConfig(supabaseClient);
    const tzOffset = offset || "+08:00";
    const tzName = timezone || "Asia/Manila";
    const d = new Date(`${manilaDate}T00:00:00${tzOffset}`);
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tzName,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  return manilaDate;
}

/**
 * Server-side: Get or create the shift_log for the current active shift.
 * Returns the shift definition + shift_log row.
 */
export async function getOrCreateActiveShiftLog(adminId?: string) {
  const supabase = getSupabaseAdmin();

  // 1. Load active shift definitions
  const { data: shifts, error: sErr } = await supabase
    .from("shifts")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (sErr) throw sErr;
  if (!shifts || shifts.length === 0) throw new Error("No active shifts configured.");

  // 2. Detect current theoretical shift based on physical time
  const now = new Date();
  const currentTime = await manilaTimeString(now, supabase);
  const currentDate = await manilaDateString(now, supabase);

  const detectedShift = detectShift(shifts as ShiftDefinition[], currentTime);
  if (!detectedShift) throw new Error("No shift matches the current time.");

  const targetShiftDate = await getShiftDate(detectedShift, currentDate, currentTime, supabase);

  // 3. Find if there's any OPEN shift log currently (to handle manual overtime)
  const { data: openLogs, error: openErr } = await supabase
    .from("shift_logs")
    .select("*")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(1);

  if (openErr) throw openErr;
  const existingOpenLog = openLogs?.[0];

  if (existingOpenLog) {
    const isOvertime = existingOpenLog.shift_id !== detectedShift.id || existingOpenLog.date !== targetShiftDate;
    
    if (isOvertime) {
      // 4. Fetch auto-close setting
      const { data: settingsData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "auto_close_shifts")
        .maybeSingle();
      
      const autoCloseShifts = settingsData?.value === "true";

      if (autoCloseShifts) {
        // Auto-close the old orphaned shift
        // Fetch calculations before auto-closing
        const { data: transactions, error: txErr } = await supabase
          .from("shift_transactions")
          .select("type, amount")
          .eq("shift_log_id", existingOpenLog.id);

        let totalIncome = 0;
        let totalExpense = 0;
        let netTotal = 0;

        if (!txErr && transactions) {
          totalIncome = transactions
            .filter((t: any) => t.type === "INCOME")
            .reduce((s, t) => s + Number(t.amount || 0), 0);
          totalExpense = transactions
            .filter((t: any) => t.type === "EXPENSE")
            .reduce((s, t) => s + Number(t.amount || 0), 0);
          netTotal = totalIncome - totalExpense;
        }

        // Auto-close the old orphaned shift
        await supabase.from("shift_logs").update({
          status: "CLOSED",
          closed_at: new Date().toISOString(),
          close_notes: "Auto-closed due to shift timeout",
          closing_type: "AUTO",
          total_income: totalIncome,
          total_expense: totalExpense,
          net_total: netTotal,
        }).eq("id", existingOpenLog.id);
        // Fall through to create the proper detected shift
      } else {
        // Maintain the open shift and mark it as overtime
        const fallbackShiftDef = shifts.find(s => s.id === existingOpenLog.shift_id) || detectedShift;
        return { 
          shift: fallbackShiftDef, 
          shiftLog: existingOpenLog, 
          shifts: shifts as ShiftDefinition[], 
          is_overtime: true 
        };
      }
    } else {
      // Still firmly within bounds
      const matchedShiftDef = shifts.find(s => s.id === existingOpenLog.shift_id) || detectedShift;
      return { 
        shift: matchedShiftDef, 
        shiftLog: existingOpenLog, 
        shifts: shifts as ShiftDefinition[], 
        is_overtime: false 
      };
    }
  }

  // 5. Normal Path: Get or create the detected shift_log
  const { data: existing, error: eErr } = await supabase
    .from("shift_logs")
    .select("*")
    .eq("shift_id", detectedShift.id)
    .eq("date", targetShiftDate)
    .maybeSingle();

  if (eErr) throw eErr;

  if (existing) {
    return { shift: detectedShift, shiftLog: existing, shifts: shifts as ShiftDefinition[], is_overtime: false };
  }

  // Create new shift log
  const { data: created, error: cErr } = await supabase
    .from("shift_logs")
    .insert({
      shift_id: detectedShift.id,
      date: targetShiftDate,
      opened_by: adminId || null,
      status: "OPEN",
    })
    .select("*")
    .single();

  if (cErr) throw cErr;

  return { shift: detectedShift, shiftLog: created, shifts: shifts as ShiftDefinition[], is_overtime: false };
}

/**
 * Server-side: Insert a transaction into the current active shift.
 * Non-blocking — if no shift is found, silently skips.
 */
type AddShiftTransactionParams = {
  source: "booking" | "restaurant" | "expense" | "manual" | "other_service";
  referenceId?: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category?: string;
  performedBy?: string | null;
  onFailure?: "silent" | "throw";
};

function isMissingShiftTransactionPerformedByColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? error.code : null;
  const message = "message" in error ? error.message : null;

  return (
    code === "PGRST204" &&
    typeof message === "string" &&
    message.includes("'performed_by'") &&
    message.includes("'shift_transactions'")
  );
}

export async function addShiftTransaction(params: AddShiftTransactionParams) {
  try {
    const supabase = getSupabaseAdmin();
    const { shiftLog } = await getOrCreateActiveShiftLog(params.performedBy || undefined);

    if (shiftLog.status === "CLOSED") {
      if (params.onFailure === "throw") {
        throw new Error("Active shift ledger is already closed.");
      }
      return null;
    }

    const insertPayload = {
      shift_log_id: shiftLog.id,
      source: params.source,
      reference_id: params.referenceId || null,
      description: params.description,
      amount: params.amount,
      type: params.type,
      category: params.category || null,
    };

    const insertTransaction = async (payload: typeof insertPayload & { performed_by?: string | null }) =>
      supabase
        .from("shift_transactions")
        .insert(payload)
        .select("*")
        .single();

    let { data, error } = await insertTransaction({
      ...insertPayload,
      ...(params.performedBy ? { performed_by: params.performedBy } : {}),
    });

    // Backward compatibility for environments where the DB migration has not been applied yet.
    if (error && params.performedBy && isMissingShiftTransactionPerformedByColumn(error)) {
      ({ data, error } = await insertTransaction(insertPayload));
    }

    if (error) throw error;
    return data;
  } catch (err) {
    if (params.onFailure === "throw") {
      throw err;
    }

    // Non-blocking: log error but don't fail the parent operation
    console.error("[ShiftTransaction] Failed to record:", err);
    return null;
  }
}
