import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type ReservationRow = {
  room_id: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string | null;
  rate_plan_kind: string | null;
  verification_code_expires_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const roomType = (url.searchParams.get("room_type") || "").trim();

    if (!roomType) {
      return NextResponse.json({ error: "room_type is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const todayYmd = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("room_type", roomType)
      .eq("is_active", true);

    if (roomsError) {
      return NextResponse.json({ error: roomsError.message }, { status: 500 });
    }

    const roomIds = (rooms ?? [])
      .filter((room: any) => String(room.status || "") !== "Maintenance")
      .map((room: any) => String(room.id || ""))
      .filter(Boolean);

    if (!roomIds.length) {
      return NextResponse.json({
        room_type: roomType,
        room_ids: [],
        reservations: [],
      });
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("room_id, check_in_date, check_out_date, status, rate_plan_kind, verification_code_expires_at")
      .in("room_id", roomIds)
      .not("status", "in", '("Cancelled","No Show","Checked-Out")')
      .gte("check_out_date", todayYmd)
      .order("check_in_date", { ascending: true });

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 });
    }

    const reservations = (bookings ?? [])
      .map((booking) => booking as ReservationRow)
      .filter((booking) => {
        const roomId = String(booking.room_id || "");
        const checkIn = String(booking.check_in_date || "").slice(0, 10);
        const checkOut = String(booking.check_out_date || "").slice(0, 10);
        const status = String(booking.status || "");
        const expiresAt = String(booking.verification_code_expires_at || "");

        if (!roomId || !checkIn || !checkOut) return false;
        if (status === "Pending Verification" && expiresAt && expiresAt < nowIso) {
          return false;
        }
        return true;
      })
      .map((booking) => ({
        room_id: String(booking.room_id),
        check_in_date: String(booking.check_in_date).slice(0, 10),
        check_out_date: String(booking.check_out_date).slice(0, 10),
        rate_plan_kind: booking.rate_plan_kind ? String(booking.rate_plan_kind) : null,
      }));

    return NextResponse.json({
      room_type: roomType,
      room_ids: roomIds,
      reservations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
