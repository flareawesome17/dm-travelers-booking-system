"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays, TrendingUp, Clock, CheckCircle2, ArrowRight, Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Booking = {
  reference_number?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  completed: "outline",
};

function getStatusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary";
  return statusVariant[String(status).toLowerCase()] ?? "secondary";
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [router]);

  const confirmedCount = bookings.filter((b) => String(b.status || "").toLowerCase().includes("confirm")).length;
  const pendingCount = bookings.filter((b) => String(b.status || "").toLowerCase().includes("pending")).length;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your hotel activity and recent bookings</p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8">
        {[
          { icon: CalendarDays, value: bookings.length, label: "Total Bookings", color: "bg-[#07008A]/10 text-[#07008A]" },
          { icon: CheckCircle2, value: confirmedCount, label: "Confirmed", color: "bg-emerald-500/10 text-emerald-600" },
          { icon: Clock, value: pendingCount, label: "Pending", color: "bg-amber-500/10 text-amber-600" },
        ].map(({ icon: Icon, value, label, color }) => (
          <motion.div key={label} variants={item}>
            <Card className="border-0 shadow-lg bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold text-[#07008A]">{value}</p>}
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Recent Bookings
              </CardTitle>
              <Link href="/admin/bookings" className="text-sm font-medium text-[#07008A] hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4"><Skeleton className="h-10 flex-1" /><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-24" /></div>
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4"><Inbox className="h-7 w-7" /></div>
                <p className="font-medium text-slate-600">No bookings yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">New reservations will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50/80">
                      <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Check-in</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Check-out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 10).map((b, index) => (
                      <motion.tr key={b.reference_number ?? index} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6"><span className="font-mono text-sm font-medium text-[#07008A]">{b.reference_number ?? "—"}</span></td>
                        <td className="py-4 px-6"><Badge variant={getStatusVariant(b.status)} className="capitalize">{b.status ?? "—"}</Badge></td>
                        <td className="py-4 px-6 text-sm text-slate-600">{b.check_in_date ?? "—"}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{b.check_out_date ?? "—"}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
