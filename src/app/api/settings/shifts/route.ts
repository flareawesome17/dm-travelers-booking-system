import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { updateShiftSchedulesSchema } from "@/lib/validation-schemas";

type ShiftRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
};

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function buildIntervals(shift: ShiftRow) {
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);

  if (start < end) {
    return [
      { start, end },
      { start: start + 1440, end: end + 1440 },
    ];
  }

  return [{ start, end: end + 1440 }];
}

function findOverlap(shifts: ShiftRow[]) {
  const activeShifts = shifts.filter((shift) => shift.is_active);

  for (let i = 0; i < activeShifts.length; i += 1) {
    for (let j = i + 1; j < activeShifts.length; j += 1) {
      const currentIntervals = buildIntervals(activeShifts[i]);
      const nextIntervals = buildIntervals(activeShifts[j]);

      for (const current of currentIntervals) {
        for (const next of nextIntervals) {
          if (Math.max(current.start, next.start) < Math.min(current.end, next.end)) {
            return [activeShifts[i].name, activeShifts[j].name] as const;
          }
        }
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "settings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("shifts")
      .select("id, name, start_time, end_time, sort_order, is_active")
      .order("sort_order");

    if (error) return dbError(error, "Failed to load shift schedules");
    return NextResponse.json(data ?? []);
  } catch {
    return dbError(null, "Failed to load shift schedules");
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, "settings.write");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateShiftSchedulesSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const incomingIds = new Set(parsed.data.map((shift) => shift.id));

    const { data: existingRows, error: existingError } = await supabase
      .from("shifts")
      .select("id")
      .order("sort_order");

    if (existingError) return dbError(existingError, "Failed to validate shift schedules");

    const existingIds = new Set((existingRows ?? []).map((row) => row.id));
    if (incomingIds.size !== existingIds.size || [...incomingIds].some((id) => !existingIds.has(id))) {
      return apiError("invalid_shift_schedule", "Shift definitions are out of sync. Reload settings and try again.", 409);
    }

    const normalizedRows: ShiftRow[] = parsed.data.map((shift) => ({
      ...shift,
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
    }));

    const overlap = findOverlap(normalizedRows);
    if (overlap) {
      return apiError(
        "invalid_shift_schedule",
        `Active shifts cannot overlap. Conflict detected between ${overlap[0]} and ${overlap[1]}.`,
        422
      );
    }

    const { error } = await supabase
      .from("shifts")
      .upsert(normalizedRows, { onConflict: "id" });

    if (error) return dbError(error, "Failed to update shift schedules");
    return NextResponse.json({ success: true });
  } catch {
    return dbError(null, "Failed to update shift schedules");
  }
}
