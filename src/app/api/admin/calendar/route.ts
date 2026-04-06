import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { internalError } from "@/lib/api-security";
import { addHours } from "date-fns";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.calendar");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start_date");
  const endParam = url.searchParams.get("end_date");

  try {
    const supabase = getSupabaseAdmin();
    
    // Fetch all active rooms
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("*")
      .order("room_number", { ascending: true });

    if (roomsError) throw roomsError;

    // Fetch global settings to grab check-in/check-out time
    const { data: settingsData } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["check_in_time", "check_out_time"]);

    const settingsMap = (settingsData || []).reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);

    const defaultCheckInTime = settingsMap["check_in_time"] || "14:00"; // format HH:MM
    const defaultCheckOutTime = settingsMap["check_out_time"] || "12:00";

    // Build bookings query natively
    // We want bookings where standard status is not cancelled and overlaps range
    let bookingsQuery = supabase
      .from("bookings")
      .select("*, guests(*), rooms(*)")
      .not("status", "eq", "Cancelled")
      .order("check_in_date", { ascending: true });

    if (startParam && endParam) {
      // Overlap condition: check_in <= end AND check_out >= start
      bookingsQuery = bookingsQuery
        .lte("check_in_date", endParam)
        .gte("check_out_date", startParam);
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) throw bookingsError;

    // Fetch global timezone configuration
    const { getGlobalTimeConfig } = await import("@/lib/settings");
    const { offset } = await getGlobalTimeConfig(supabase);
    const tzOffset = offset || "+08:00";

    // Create a structured payload binding bookings to rooms, ensuring times are applied to YYYY-MM-DD strings
    const result = rooms?.map(room => {
      const roomBookings = bookings?.filter(b => b.room_id === room.id) || [];
      
      const mappedBookings = roomBookings.map(b => {
        // If the date string is just YYYY-MM-DD (10 chars), append time and offset
        let inDate = b.check_in_date;
        if (inDate && inDate.length === 10) inDate = `${inDate}T${defaultCheckInTime}:00${tzOffset}`;
        let outDate = b.check_out_date;
        if (outDate && outDate.length === 10) {
           const referenceIn = b.actual_check_in_at ? new Date(b.actual_check_in_at) : new Date(inDate);
           if (b.rate_plan_kind === "12h") {
             outDate = addHours(referenceIn, 12).toISOString();
           } else if (b.rate_plan_kind === "5h") {
             outDate = addHours(referenceIn, 5).toISOString();
           } else if (b.rate_plan_kind === "3h") {
             outDate = addHours(referenceIn, 3).toISOString();
           } else {
             outDate = `${outDate}T${defaultCheckOutTime}:00${tzOffset}`;
           }
        }

        // Map `actual_check_in_at` and `actual_check_out_at` exactly matching the database schema
        return { 
          ...b, 
          check_in_date: inDate, 
          check_out_date: outDate,
          actual_check_in: b.actual_check_in_at || null,
          actual_check_out: b.actual_check_out_at || null
        };
      });

      return {
        ...room,
        bookings: mappedBookings
      };
    }) || [];

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CALENDAR_GET_ERROR]", error);
    return internalError();
  }
}
