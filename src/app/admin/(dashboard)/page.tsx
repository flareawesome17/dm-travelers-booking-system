"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays, TrendingUp, Clock, CheckCircle2, ArrowRight, Inbox,
  Plus, Utensils, Banknote, LogIn, LogOut, BedDouble, AlertCircle, ShoppingBag
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  reference_number?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  guests?: { full_name?: string };
  rooms?: { room_number?: string };
};

type Room = {
  id: string;
  room_number: string;
  status: "Clean" | "Dirty" | "Occupied" | "Maintenance";
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [bRes, rRes, oRes, revRes] = await Promise.all([
          fetch("/api/bookings", { headers }),
          fetch("/api/rooms", { headers }),
          fetch("/api/restaurant/orders", { headers }),
          fetch("/api/reports/revenue?startDate=" + new Date().toISOString().split("T")[0], { headers })
        ]);

        const [bData, rData, oData, revData] = await Promise.all([
          bRes.json(), rRes.json(), oRes.json(), revRes.json()
        ]);

        setBookings(Array.isArray(bData) ? bData : []);
        setRooms(Array.isArray(rData) ? rData : []);
        setOrders(Array.isArray(oData) ? oData : []);
        setRevenue(revData?.total_revenue || 0);
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const today = new Date().toISOString().split("T")[0];
  const arrivalsToday = bookings.filter(b => b.check_in_date?.startsWith(today) && b.status !== "Cancelled");
  const departuresToday = bookings.filter(b => b.check_out_date?.startsWith(today) && b.status === "Checked-In");
  
  const roomStats = {
    available: rooms.filter(r => r.status === "Clean").length,
    occupied: rooms.filter(r => r.status === "Occupied").length,
    dirty: rooms.filter(r => r.status === "Dirty").length,
  };

  const statusVariant: Record<string, string> = {
    "pending payment": "bg-slate-100 text-slate-700 border-slate-200",
    "confirmed": "bg-blue-50 text-blue-700 border-blue-200",
    "checked-in": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "checked-out": "bg-slate-50 text-slate-500 border-slate-200",
    "cancelled": "bg-red-50 text-red-700 border-red-200",
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Live updates from D&M Travelers Inn</p>
      </motion.div>

      {/* Quick Stats Grid */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { icon: Banknote, value: `₱${revenue.toLocaleString()}`, label: "Revenue Today", color: "bg-emerald-500/10 text-emerald-600" },
          { icon: CalendarDays, value: bookings.length, label: "Total Bookings", color: "bg-[#07008A]/10 text-[#07008A]" },
          { icon: BedDouble, value: roomStats.available, label: "Rooms Available", color: "bg-blue-500/10 text-blue-600" },
          { icon: AlertCircle, value: roomStats.dirty, label: "Dirty Rooms", color: "bg-red-500/10 text-red-600" },
        ].map(({ icon: Icon, value, label, color }) => (
          <motion.div key={label} variants={item}>
            <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow cursor-default group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl group-hover:scale-110 transition-transform", color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  {loading ? <Skeleton className="h-7 w-16 mb-1" /> : <p className="text-xl font-bold text-slate-900">{value}</p>}
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <Link href="/admin/bookings" className="group">
          <Card className="border-0 shadow-sm bg-[#07008A] text-white hover:bg-[#05006a] transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl"><Plus className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold">New Booking</p>
                  <p className="text-xs text-white/60">Reserve a room for a guest</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/restaurant" className="group">
          <Card className="border-0 shadow-sm bg-white hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-900">
                <div className="bg-orange-500/10 text-orange-600 p-3 rounded-xl"><Utensils className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold">Restaurant Order</p>
                  <p className="text-xs text-slate-400">Dine-in or Room service</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports" className="group">
          <Card className="border-0 shadow-sm bg-white hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-900">
                <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-xl"><Plus className="h-5 w-5" /></div>
                <div>
                  <p className="font-bold">Add Expense</p>
                  <p className="text-xs text-slate-400">Record a new operational cost</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arrivals & Departures */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#07008A]" />
                  Today's Operations
                </CardTitle>
                <CardDescription className="text-xs">Schedule for {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100/50">
                  <LogIn className="h-4 w-4 text-blue-500" /> Arrivals ({arrivalsToday.length})
                </div>
                <div className="space-y-2">
                  {loading ? [1,2].map(i => <Skeleton key={i} className="h-12 w-full" />) : 
                   arrivalsToday.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No arrivals expected today</p> :
                   arrivalsToday.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-800">{b.guests?.full_name}</span>
                         <span className="text-[10px] text-slate-500">{b.rooms?.room_number ? `Room ${b.rooms.room_number}` : 'Unassigned'}</span>
                       </div>
                       <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight bg-white">
                         {b.reference_number?.slice(-6)}
                       </Badge>
                     </div>
                   ))
                  }
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-amber-50/50 px-3 py-2 rounded-lg border border-amber-100/50">
                  <LogOut className="h-4 w-4 text-amber-500" /> Departures ({departuresToday.length})
                </div>
                <div className="space-y-2">
                  {loading ? [1,2].map(i => <Skeleton key={i} className="h-12 w-full" />) : 
                   departuresToday.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No departures scheduled today</p> :
                   departuresToday.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
                       <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-800">{b.guests?.full_name}</span>
                         <span className="text-[10px] text-slate-500">{b.rooms?.room_number ? `Room ${b.rooms.room_number}` : 'N/A'}</span>
                       </div>
                       <Badge className="text-[10px] uppercase font-bold tracking-tight bg-amber-50 text-amber-700 border-amber-100">
                         Due Today
                       </Badge>
                     </div>
                   ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Bookings Table (Smaller) */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#07008A]" /> Recent Bookings
              </CardTitle>
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-[#07008A] hover:bg-[#07008A]/10">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      <th className="text-left py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ref / Guest</th>
                      <th className="text-left py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-3 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 5).map((b, idx) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 font-mono tracking-tight">{b.reference_number}</span>
                            <span className="text-[10px] text-slate-500">{b.guests?.full_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <span className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border",
                            statusVariant[String(b.status || "").toLowerCase()] || "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right text-xs text-slate-600">{b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Restaurant Activity */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-orange-500" /> Restaurant Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {loading ? [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />) :
               orders.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-8">No recent orders</p> :
               orders.slice(0, 4).map(o => (
                 <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-orange-200 transition-colors">
                   <div className="h-10 w-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                     <Utensils className="h-5 w-5" />
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
                <Button variant="outline" size="sm" className="w-full h-9 text-xs text-slate-600 hover:text-orange-600 hover:border-orange-200">
                  Manage Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Room Cleaning Status */}
          <Card className="border-0 shadow-sm bg-[#07008A] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Housekeeping Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Clean Rooms</p>
                  <p className="text-xl font-bold">{roomStats.available}</p>
                </div>
                <div className="bg-red-500/20 p-3 rounded-xl">
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Dirty Rooms</p>
                  <p className="text-xl font-bold">{roomStats.dirty}</p>
                </div>
              </div>
              <Link href="/admin/housekeeping" className="block">
                <Button variant="secondary" size="sm" className="w-full h-9 text-xs font-bold">
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
