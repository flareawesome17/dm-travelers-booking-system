import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type RoomRow = {
  id: string;
  room_type: string;
  is_active?: boolean | null;
  status?: string | null;
  image_urls?: string[] | null;
  capacity?: number | null;
  rate_24h_enabled?: boolean | null;
  rate_24h_price?: number | null;
  rate_12h_enabled?: boolean | null;
  rate_12h_price?: number | null;
  rate_5h_enabled?: boolean | null;
  rate_5h_price?: number | null;
  rate_3h_enabled?: boolean | null;
  rate_3h_price?: number | null;
};

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function cmpYmd(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function roomStartingPrice(room: RoomRow) {
  if (room.rate_24h_enabled === false) return null;
  const p = room.rate_24h_price != null ? Number(room.rate_24h_price) : NaN;
  if (!Number.isFinite(p) || p <= 0) return null;
  return p;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const checkIn = url.searchParams.get("check_in") || "";
    const checkOut = url.searchParams.get("check_out") || "";

    if ((checkIn && !isYmd(checkIn)) || (checkOut && !isYmd(checkOut))) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (checkIn && checkOut && cmpYmd(checkIn, checkOut) >= 0) {
      return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: rooms, error: rErr } = await supabase
      .from("rooms")
      .select(
        "id, room_type, is_active, status, image_urls, capacity, rate_24h_enabled, rate_24h_price, rate_12h_enabled, rate_12h_price, rate_5h_enabled, rate_5h_price, rate_3h_enabled, rate_3h_price"
      )
      .eq("is_active", true);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

    const activeRooms = (rooms ?? []).filter((r: any) => String(r.status || "") !== "Maintenance") as RoomRow[];
    const roomIds = activeRooms.map((r) => r.id);

    let bookingsByRoom = new Map<string, Array<{ check_in_date: string; check_out_date: string; status: string; verification_code_expires_at?: string | null }>>();
    if (checkIn && checkOut && roomIds.length) {
      const nowIso = new Date().toISOString();
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("room_id, check_in_date, check_out_date, status, verification_code_expires_at")
        .in("room_id", roomIds)
        .not("status", "in", '("Cancelled","No Show","Checked-Out")')
        .lte("check_in_date", checkOut)
        .gte("check_out_date", checkIn);
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

      for (const b of bookings ?? []) {
        const status = String((b as any).status || "");
        if (status === "Pending Verification") {
          const exp = (b as any).verification_code_expires_at ? String((b as any).verification_code_expires_at) : "";
          if (exp && exp < nowIso) continue;
        }
        const rid = String((b as any).room_id || "");
        if (!rid) continue;
        if (!bookingsByRoom.has(rid)) bookingsByRoom.set(rid, []);
        bookingsByRoom.get(rid)!.push({
          check_in_date: String((b as any).check_in_date).slice(0, 10),
          check_out_date: String((b as any).check_out_date).slice(0, 10),
          status,
          verification_code_expires_at: (b as any).verification_code_expires_at ? String((b as any).verification_code_expires_at) : null,
        });
      }
    }

    const typeMap = new Map<
      string,
      {
        room_type: string;
        sample_image_url: string | null;
        min_price: number | null;
        total_rooms: number;
        available_rooms: number | null;
        max_capacity: number | null;
      }
    >();

    for (const room of activeRooms) {
      const type = String(room.room_type || "").trim();
      if (!type) continue;
      const p = roomStartingPrice(room);
      if (p == null) continue;

      const existing = typeMap.get(type) ?? {
        room_type: type,
        sample_image_url: null as string | null,
        min_price: null as number | null,
        total_rooms: 0,
        available_rooms: checkIn && checkOut ? 0 : null,
        max_capacity: null as number | null,
      };

      existing.total_rooms += 1;

      const img = Array.isArray(room.image_urls) && room.image_urls.length ? String(room.image_urls[0]) : null;
      if (!existing.sample_image_url && img) existing.sample_image_url = img;

      existing.min_price = existing.min_price == null ? p : Math.min(existing.min_price, p);

      const cap = room.capacity != null ? Number(room.capacity) : null;
      if (cap != null && Number.isFinite(cap)) existing.max_capacity = existing.max_capacity == null ? cap : Math.max(existing.max_capacity, cap);

      if (checkIn && checkOut) {
        const bookings = bookingsByRoom.get(room.id) ?? [];
        let overlaps = false;
        for (const b of bookings) {
          if (cmpYmd(b.check_in_date, checkOut) < 0 && cmpYmd(b.check_out_date, checkIn) > 0) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) existing.available_rooms = (existing.available_rooms ?? 0) + 1;
      }

      typeMap.set(type, existing);
    }

    const room_types = Array.from(typeMap.values()).sort((a, b) => a.room_type.localeCompare(b.room_type));
    return NextResponse.json({ room_types });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
