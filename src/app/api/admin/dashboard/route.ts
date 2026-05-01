import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requireAnyPermission } from "@/lib/rbac";
import { manilaDateString } from "@/lib/ledgerDate";
import { dbError, internalError } from "@/lib/api-security";

export const dynamic = "force-dynamic";

const BOOKING_CARD_SELECT =
  "id, reference_number, status, check_in_date, check_out_date, guests(full_name), rooms(room_number)";

type AmountRow = { amount?: number | string | null };
type RestaurantAmountRow = { total_amount?: number | string | null };

function sumAmount(rows: AmountRow[] | RestaurantAmountRow[] | null | undefined, key: "amount" | "total_amount") {
  return (rows ?? []).reduce((total, row) => total + Number((row as any)[key] || 0), 0);
}

/* ── Server-side response cache ──────────────────────────────────────
 *
 * The dashboard fires 10 parallel DB queries. With 3 admin users polling
 * every 2 minutes, that's 30 queries/min * 10 = 300 query executions/min.
 * Since all users see the same dashboard data, we cache the assembled
 * response for 60 seconds. This means at most 10 queries per minute total
 * regardless of how many admins are logged in.
 * ───────────────────────────────────────────────────────────────────── */
const DASHBOARD_CACHE_TTL_MS = 60_000; // 60 seconds
let dashboardCache: { data: any; expiresAt: number } | null = null;

export async function GET(req: NextRequest) {
  const auth = await requireAnyPermission(req, [
    "bookings.read",
    "rooms.read",
    "restaurant.read",
    "inventory.read",
    "reports.analytics.read",
  ]);
  if ("error" in auth) return auth.error;

  // Return cached response if fresh
  const now = Date.now();
  if (dashboardCache && dashboardCache.expiresAt > now) {
    return NextResponse.json(dashboardCache.data);
  }

  try {
    const supabase = getSupabaseAdmin();
    const today = await manilaDateString(new Date(), supabase);
    const expiringUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const [
      bookingCountResult,
      recentBookingsResult,
      todayBookingsResult,
      roomsResult,
      recentOrdersResult,
      inventoryResult,
      expiringBookingsResult,
      paymentsResult,
      restaurantRevenueResult,
      receivablePaymentsResult,
    ] = await Promise.all([
      supabase.from("bookings").select("id", { count: "planned", head: true }),
      supabase
        .from("bookings")
        .select(BOOKING_CARD_SELECT)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("bookings")
        .select(BOOKING_CARD_SELECT)
        .or(`check_in_date.eq.${today},check_out_date.eq.${today}`)
        .limit(100),
      supabase.from("rooms").select("id, status, is_active").eq("is_active", true),
      supabase
        .from("restaurant_orders")
        .select("id, customer_name, total_amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("inventory_items")
        .select("id, name, current_stock, min_stock_alert, unit")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(250),
      supabase
        .from("bookings")
        .select("id, reference_number, reserved_checkout_datetime, guests(full_name), rooms(room_number)")
        .eq("status", "Checked-In")
        .not("reserved_checkout_datetime", "is", null)
        .lte("reserved_checkout_datetime", expiringUntil)
        .order("reserved_checkout_datetime", { ascending: true })
        .limit(20),
      supabase
        .from("payments")
        .select("amount")
        .eq("status", "Success")
        .eq("accounting_date", today),
      supabase
        .from("restaurant_orders")
        .select("total_amount")
        .eq("status", "Paid")
        .not("order_source", "eq", "Room Service")
        .eq("accounting_date", today),
      supabase
        .from("receivable_payments")
        .select("amount")
        .eq("accounting_date", today),
    ]);

    const firstError =
      recentBookingsResult.error ||
      todayBookingsResult.error ||
      roomsResult.error ||
      recentOrdersResult.error ||
      inventoryResult.error ||
      expiringBookingsResult.error ||
      paymentsResult.error ||
      restaurantRevenueResult.error ||
      receivablePaymentsResult.error ||
      bookingCountResult.error;

    if (firstError) return dbError(firstError, "Failed to load dashboard data");

    const rooms = roomsResult.data ?? [];
    const roomStats = {
      total: rooms.length,
      available: rooms.filter((room) => room.status === "Available").length,
      occupied: rooms.filter((room) => room.status === "Occupied").length,
      dirty: rooms.filter((room) => room.status === "Dirty").length,
    };

    const todayBookings = todayBookingsResult.data ?? [];
    const arrivalsToday = todayBookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase().replace("-", " ");
      return (
        booking.check_in_date?.startsWith(today) &&
        !["checked in", "checked out", "cancelled", "completed"].includes(status)
      );
    });

    const expiringBookings = (expiringBookingsResult.data ?? []).map((booking) => ({
      id: booking.id,
      reference_number: booking.reference_number,
      guest_name: (booking.guests as any)?.full_name,
      room_number: (booking.rooms as any)?.room_number,
      checkout_datetime: booking.reserved_checkout_datetime,
      is_overdue: booking.reserved_checkout_datetime
        ? new Date(booking.reserved_checkout_datetime).getTime() < Date.now()
        : false,
    }));

    const lowStock = (inventoryResult.data ?? [])
      .filter((item) => Number(item.current_stock) <= Number(item.min_stock_alert))
      .slice(0, 6);

    const revenueToday =
      sumAmount(paymentsResult.data, "amount") +
      sumAmount(restaurantRevenueResult.data, "total_amount") +
      sumAmount(receivablePaymentsResult.data, "amount");

    const payload = {
      today,
      totalBookings: bookingCountResult.count ?? 0,
      recentBookings: recentBookingsResult.data ?? [],
      arrivalsToday,
      expiringBookings,
      roomStats,
      recentOrders: recentOrdersResult.data ?? [],
      lowStock,
      revenueToday,
    };

    // Cache for 60 seconds
    dashboardCache = { data: payload, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[ADMIN_DASHBOARD_ERROR]", error);
    return internalError();
  }
}

