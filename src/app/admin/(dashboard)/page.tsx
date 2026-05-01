"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays, TrendingUp, Clock, CheckCircle2, ArrowRight, Inbox,
  Plus, Utensils, Banknote, LogIn, LogOut, BedDouble, AlertCircle, ShoppingBag,
  Activity, Zap, PackageSearch, KeyRound
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c: string) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type Booking = {
  id: string;
  reference_number?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  guests?: { full_name?: string };
  rooms?: { room_number?: string };
};

type ExpiringBooking = {
  id: string;
  reference_number?: string;
  guest_name?: string;
  room_number?: string;
  checkout_datetime?: string;
  is_overdue?: boolean;
};

type Room = {
  id: string;
  room_number: string;
  status: "Available" | "Dirty" | "Occupied" | "Maintenance";
};

type RestaurantOrder = {
  id: string;
  customer_name?: string;
  total_amount: number;
  status: string;
  created_at: string;
};

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [roomStats, setRoomStats] = useState({ total: 0, available: 0, occupied: 0, dirty: 0 });
  const [revenue, setRevenue] = useState(0);
  const [lowStockObjects, setLowStockObjects] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [arrivalsToday, setArrivalsToday] = useState<Booking[]>([]);
  const [expiringBookings, setExpiringBookings] = useState<ExpiringBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcome, setWelcome] = useState<{ name: string | null; roleLabel: string | null } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    

    const p = decodeJwtPayload(token);
    const name = p && typeof p.name === "string" ? p.name : null;
    const roleId = p ? (typeof p.role_id === "number" ? p.role_id : Number(p.role_id)) : NaN;
    const roleLabel =
      roleId === 1 ? "Super Admin" : roleId === 2 ? "Manager" : roleId === 3 ? "Staff" : roleId === 4 ? "Housekeeping" : null;
    setWelcome({ name, roleLabel });

    let active = true;
    const fetchData = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [dashboardRes, shiftRes] = await Promise.all([
          fetch("/api/admin/dashboard", { headers }),
          fetch("/api/shifts/current", { headers }),
        ]);

        const [dashboardData, shiftData] = await Promise.all([
          dashboardRes.ok ? dashboardRes.json() : Promise.resolve(null),
          shiftRes.ok ? shiftRes.json() : Promise.resolve(null),
        ]);

        if (!active) return;

        if (dashboardData) {
          setBookings(Array.isArray(dashboardData.recentBookings) ? dashboardData.recentBookings : []);
          setTotalBookings(Number(dashboardData.totalBookings || 0));
          setRoomStats({
            total: Number(dashboardData.roomStats?.total || 0),
            available: Number(dashboardData.roomStats?.available || 0),
            occupied: Number(dashboardData.roomStats?.occupied || 0),
            dirty: Number(dashboardData.roomStats?.dirty || 0),
          });
          setOrders(Array.isArray(dashboardData.recentOrders) ? dashboardData.recentOrders : []);
          setRevenue(Number(dashboardData.revenueToday || 0));
          setLowStockObjects(Array.isArray(dashboardData.lowStock) ? dashboardData.lowStock : []);
          setArrivalsToday(Array.isArray(dashboardData.arrivalsToday) ? dashboardData.arrivalsToday : []);
          setExpiringBookings(Array.isArray(dashboardData.expiringBookings) ? dashboardData.expiringBookings : []);
        }

        if (shiftData && shiftData.shift && shiftData.shift_log?.status !== "CLOSED") {
          setActiveShift(shiftData);
        } else {
          setActiveShift(null);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 120000);
    const handleFocus = () => { void fetchData(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [router]);

  const [nowData, setNowData] = useState({
    today: "",
    timeOfDay: "Good day",
    localizedDate: "Today",
  });

  useEffect(() => {
    const offsetStr = localStorage.getItem("app_timezone_offset") || "+08:00";
    const offsetSign = offsetStr.startsWith("+") ? 1 : -1;
    const [h, m] = offsetStr.substring(1).split(":").map(Number);
    const offsetInMs = offsetSign * (h * 60 + (m || 0)) * 60 * 1000;
    
    const now = new Date(Date.now() + offsetInMs);
    const today = now.toISOString().split("T")[0];
    
    setNowData({
      today,
      timeOfDay: (() => {
        const hour = now.getUTCHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
      })(),
      localizedDate: now.toLocaleDateString(undefined, { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        timeZone: 'UTC'
      })
    });
  }, []);

  const statusVariant: Record<string, string> = {
    "pending payment": "bg-slate-100 text-slate-700 border-slate-200",
    "confirmed": "bg-blue-50 text-blue-700 border-blue-200",
    "checked-in": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "checked-out": "bg-slate-50 text-slate-500 border-slate-200",
    "cancelled": "bg-red-50 text-red-700 border-red-200",
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
  
  const initials = (() => {
    const n = welcome?.name?.trim();
    if (!n) return "A";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "A";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + (b || "")).toUpperCase();
  })();

  // Total rooms and occupancy
  const totalRooms = roomStats.total;
  const occupancyPct = totalRooms > 0 ? Math.round((roomStats.occupied / totalRooms) * 100) : 0;

  return (
    <div className="space-y-6 tablet:space-y-8 pb-12">
      {/* Page Title */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">Live</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">Live updates from D&M Travellers Inn</p>
      </motion.div>

      {/* Welcome Banner */}
      {welcome?.name || welcome?.roleLabel ? (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
          <Card className="border border-slate-200/60 shadow-md bg-gradient-to-br from-[#07008A]/[0.06] via-white to-[#FED501]/[0.08] overflow-hidden card-hover-lift">
            <CardContent className="relative p-5 sm:p-6">
              {/* Decorative accents */}
              <div className="pointer-events-none absolute -top-20 -right-24 h-56 w-56 rounded-full bg-[#FED501]/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-28 h-64 w-64 rounded-full bg-[#07008A]/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(7,0,138,0.25) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }} />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#07008A] text-white flex items-center justify-center shadow-lg shadow-[#07008A]/20 ring-2 ring-white/80">
                    <span className="text-sm font-extrabold tracking-wide">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#07008A]/60">
                      {nowData.timeOfDay}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      {welcome?.name ? `Welcome back, ${welcome.name}.` : "Welcome back."}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500">Signed in as</span>
                      <span className="inline-flex items-center rounded-full border border-[#07008A]/12 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#07008A] shadow-xs">
                        {welcome?.roleLabel || "Staff"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/admin/account">
                    <Button size="sm" className="h-10 bg-[#07008A] hover:bg-[#05006a] text-white shadow-md shadow-[#07008A]/15 transition-all hover:shadow-lg">
                      Manage my account
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {/* Quick Stats Grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3 tablet:gap-4 lg:gap-5">
        {[
          {
            icon: Banknote,
            value: `₱${revenue.toLocaleString()}`,
            label: "Revenue Today",
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            ringColor: "ring-emerald-100",
          },
          {
            icon: CalendarDays,
            value: totalBookings,
            label: "Total Bookings",
            color: "text-[#07008A]",
            bgColor: "bg-[#07008A]/[0.06]",
            ringColor: "ring-[#07008A]/10",
          },
          {
            icon: BedDouble,
            value: roomStats.available,
            label: "Rooms Available",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            ringColor: "ring-blue-100",
            subtitle: `${occupancyPct}% occupied`,
          },
          {
            icon: AlertCircle,
            value: roomStats.dirty,
            label: "Dirty Rooms",
            color: "text-red-600",
            bgColor: "bg-red-50",
            ringColor: "ring-red-100",
            urgent: roomStats.dirty > 0,
          },
        ].map(({ icon: Icon, value, label, color, bgColor, ringColor, subtitle, urgent }) => (
          <motion.div key={label} variants={item}>
            <Card className={cn(
              "border border-slate-100 shadow-elevation-card hover:shadow-md transition-all duration-300 cursor-default group bg-white card-hover-lift",
              urgent && "border-red-200/60 shadow-red-100/50"
            )}>
              <CardContent className="p-3 xs:p-4 tablet:p-5 flex items-center gap-2.5 tablet:gap-4">
                <div className={cn(
                  "flex h-9 w-9 tablet:h-11 tablet:w-11 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 shrink-0",
                  bgColor, color, ringColor
                )}>
                  <Icon className="h-4 w-4 tablet:h-5 tablet:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {loading ? (
                    <Skeleton className="h-6 tablet:h-7 w-16 mb-1" />
                  ) : (
                    <p className={cn(
                      "font-bold text-slate-900 leading-tight truncate",
                      String(value).length > 8 ? "text-sm xs:text-base tablet:text-2xl" : "text-lg tablet:text-2xl"
                    )} title={String(value)}>
                      {value}
                    </p>
                  )}
                  <p className="text-[9px] tablet:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5 truncate">{label}</p>
                  {subtitle && !loading && (
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3 tablet:gap-4">
        <Link href="/admin/bookings" className="group">
          <Card className="border-0 shadow-lg bg-[#07008A] text-white hover:bg-[#05006a] transition-all cursor-pointer card-hover-lift duration-300">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/15 p-2.5 rounded-xl ring-1 ring-white/10"><Plus className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-sm">New Booking</p>
                  <p className="text-[11px] text-white/50">Reserve a room for a guest</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/restaurant" className="group">
          <Card className="border border-slate-100 shadow-elevation-card bg-white hover:shadow-md transition-all cursor-pointer duration-300 card-hover-lift">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-900">
                <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl ring-1 ring-orange-100"><Utensils className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-sm">Restaurant Order</p>
                  <p className="text-[11px] text-slate-400">Dine-in or Room service</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-200" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports" className="group">
          <Card className="border border-slate-100 shadow-elevation-card bg-white hover:shadow-md transition-all cursor-pointer duration-300 card-hover-lift">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-900">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl ring-1 ring-emerald-100"><Plus className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold text-sm">Add Expense</p>
                  <p className="text-[11px] text-slate-400">Record a new operational cost</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-200" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Arrivals & Departures */}
        <div className="lg:col-span-2 space-y-5 lg:space-y-6">
          <Card className="border border-slate-100 shadow-elevation-card bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between py-4 px-5">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Clock className="h-4 w-4 text-[#07008A]" />
                  Today&apos;s Operations
                </CardTitle>
                <CardDescription className="text-[11px] mt-0.5">Schedule for {nowData.localizedDate}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Arrivals */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-100/50">
                  <LogIn className="h-3.5 w-3.5 text-blue-500" /> Arrivals ({arrivalsToday.length})
                </div>
                <div className="space-y-2">
                  {loading ? [1,2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />) : 
                   arrivalsToday.length === 0 ? (
                    <div className="text-center py-6">
                      <Inbox className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No arrivals expected today</p>
                    </div>
                   ) :
                   arrivalsToday.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/50 transition-colors">
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-800">{b.guests?.full_name}</span>
                         <span className="text-[10px] text-slate-500">{b.rooms?.room_number ? `Room ${b.rooms.room_number}` : 'Unassigned'}</span>
                       </div>
                       <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight bg-white border-slate-200">
                         {b.reference_number?.slice(-6)}
                       </Badge>
                     </div>
                   ))
                  }
                </div>
              </div>

              {/* Expiring Soon */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-amber-50/60 px-3 py-2 rounded-lg border border-amber-100/50">
                  <LogOut className="h-3.5 w-3.5 text-amber-500" /> Expiring Soon ({expiringBookings.length})
                </div>
                <div className="space-y-2">
                  {loading ? [1,2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />) : 
                   expiringBookings.length === 0 ? (
                    <div className="text-center py-6">
                      <Inbox className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No urgent departures</p>
                    </div>
                   ) :
                   expiringBookings.map(b => (
                     <div 
                       key={b.id} 
                       onClick={() => router.push(`/admin/bookings?highlight=${b.id}`)}
                       className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-amber-50/50 hover:border-amber-200 transition-all cursor-pointer group"
                     >
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-800">{b.guest_name}</span>
                         <span className="text-[10px] text-slate-500">{b.room_number ? `Room ${b.room_number}` : 'N/A'}</span>
                       </div>
                       <div className="flex flex-col items-end">
                         <Badge className={cn(
                           "text-[9px] uppercase font-bold tracking-tight mb-1",
                           b.is_overdue 
                             ? "bg-red-50 text-red-700 border-red-100 animate-pulse-soft" 
                             : "bg-amber-50 text-amber-700 border-amber-100"
                         )} variant="outline">
                           {b.is_overdue ? "Overdue" : "Due Soon"}
                         </Badge>
                         <span className="text-[9px] text-slate-400 font-medium">
                           {b.checkout_datetime ? new Date(b.checkout_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                         </span>
                       </div>
                     </div>
                   ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Bookings Table */}
          <Card className="border border-slate-100 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 flex flex-row items-center justify-between py-4 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <TrendingUp className="h-4 w-4 text-[#07008A]" /> Recent Bookings
              </CardTitle>
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-[#07008A] hover:bg-[#07008A]/5">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="responsive-table-wrapper">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ref / Guest</th>
                      <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-right py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [1,2,3].map(i => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-3 px-5"><Skeleton className="h-8 w-32" /></td>
                          <td className="py-3 px-5"><Skeleton className="h-5 w-20" /></td>
                          <td className="py-3 px-5"><Skeleton className="h-5 w-24 ml-auto" /></td>
                        </tr>
                      ))
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          <Inbox className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">No bookings yet</p>
                        </td>
                      </tr>
                    ) : (
                      bookings.slice(0, 5).map((b) => (
                        <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800 font-mono tracking-tight">{b.reference_number}</span>
                              <span className="text-[10px] text-slate-500">{b.guests?.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border",
                              statusVariant[String(b.status || "").toLowerCase()] || "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right text-xs text-slate-600">{b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5 lg:space-y-6">
          {/* Active Shift Card */}
          {activeShift && (
            <Card className="border border-slate-100 shadow-xs bg-[#07008A] text-white overflow-hidden">
              <CardHeader className="py-4 px-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#FED501]" /> Active Shift
                  </div>
                  <Badge className="bg-[#FED501] text-[#07008A] uppercase font-bold text-[10px] hover:bg-[#FED501]">{activeShift.shift.name}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">{activeShift.warnings?.is_overtime ? "Overtime:" : "Time Remaining:"}</span>
                    <span className="font-bold">
                      {activeShift.warnings?.is_overtime ? `+${activeShift.time.minutes_remaining} mins` : `${activeShift.time.minutes_remaining} mins`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/70">Net Income:</span>
                    <span className="font-bold text-[#FED501]">₱{(activeShift.totals.net_total || 0).toFixed(2)}</span>
                  </div>
                </div>
                <Link href="/admin/shifts" className="mt-4 block">
                  <Button variant="secondary" size="sm" className="w-full h-8 text-xs font-bold bg-white/10 hover:bg-white/15 text-white border-0">
                    <KeyRound className="mr-2 h-3.5 w-3.5" /> Manage Ledger
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Low Stock Alerts */}
          {lowStockObjects.length > 0 && (
            <Card className="border border-red-200/60 shadow-xs bg-white overflow-hidden">
              <CardHeader className="border-b border-red-50 bg-red-50/40 py-3 px-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                  <PackageSearch className="h-4 w-4" /> Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-red-50">
                  {lowStockObjects.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="p-3 px-5 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                      <Badge variant="destructive" className="text-[10px] bg-red-100 text-red-700 hover:bg-red-200 border-0">
                        {item.current_stock} {item.unit} left
                      </Badge>
                    </div>
                  ))}
                </div>
                {lowStockObjects.length > 3 && (
                  <div className="p-2 border-t border-red-50 bg-red-50/20 text-center">
                    <Link href="/admin/inventory" className="text-[10px] font-bold text-red-600 hover:underline">
                      +{lowStockObjects.length - 3} more items low on stock
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Restaurant Activity */}
          <Card className="border border-slate-100 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 py-4 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <ShoppingBag className="h-4 w-4 text-orange-500" /> Restaurant Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {loading ? [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />) :
               orders.length === 0 ? (
                <div className="text-center py-8">
                  <Utensils className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No recent orders</p>
                </div>
               ) :
               orders.slice(0, 4).map(o => (
                 <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-orange-200/60 hover:bg-orange-50/20 transition-all duration-200">
                   <div className="h-9 w-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 ring-1 ring-orange-100">
                     <Utensils className="h-4 w-4" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-0.5">
                       <p className="text-xs font-bold text-slate-800 truncate pr-2">{o.customer_name || 'Walk-in Guest'}</p>
                       <span className="text-[10px] font-bold text-emerald-600 shrink-0">₱{o.total_amount.toFixed(0)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                       <Badge className={cn(
                         "h-4 text-[9px] uppercase tracking-tight font-bold",
                         o.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                       )} variant="outline">
                         {o.status}
                       </Badge>
                     </div>
                   </div>
                 </div>
               ))
              }
              <Link href="/admin/restaurant" className="block">
                <Button variant="outline" size="sm" className="w-full h-9 text-xs text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-colors">
                  Manage Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Housekeeping Summary */}
          <Card className="border-0 shadow-md bg-[#07008A] text-white overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#FED501]" /> Housekeeping Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white/8 p-3.5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Clean Rooms</p>
                  <p className="text-2xl font-bold mt-1">{roomStats.available}</p>
                </div>
                <div className="bg-red-500/15 p-3.5 rounded-xl border border-red-400/10">
                  <p className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Dirty Rooms</p>
                  <p className="text-2xl font-bold mt-1">{roomStats.dirty}</p>
                </div>
              </div>
              {/* Occupancy progress */}
              {totalRooms > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Occupancy</span>
                    <span className="text-[11px] font-bold text-[#FED501]">{occupancyPct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FED501] rounded-full transition-all duration-500"
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                </div>
              )}
              <Link href="/admin/housekeeping" className="block">
                <Button variant="secondary" size="sm" className="w-full h-9 text-xs font-bold bg-white/10 hover:bg-white/15 text-white border-0">
                  View Cleaning List
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
