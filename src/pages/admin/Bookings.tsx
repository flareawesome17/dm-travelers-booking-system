import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingForm } from "@/components/admin/bookings/BookingForm";

const API_URL = import.meta.env.VITE_API_URL || "";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  "pending payment": "secondary",
  "pending verification": "secondary",
  "checked-in": "default",
  "checked-out": "outline",
  cancelled: "destructive",
  "no show": "destructive",
};

function getStatusVariant(status?: string) {
  if (!status) return "secondary";
  return statusVariant[String(status).toLowerCase()] ?? "secondary";
}

type BookingRow = {
  id?: string;
  reference_number?: string;
  status?: string;
  check_in_date?: string;
  check_out_date?: string;
  total_amount?: number;
  deposit_paid?: number;
  balance_due?: number;
  rate_plan_kind?: string;
  guests?: { full_name?: string; email?: string; phone_number?: string };
  rooms?: { room_number?: string; room_type?: string } | null;
};

export default function AdminBookings() {
  const [list, setList] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchBookings = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    fetch(`${API_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Bookings</h1>
            <p className="text-muted-foreground mt-1">Manage reservations and check-in dates</p>
          </motion.div>
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <span>All Bookings</span>
                <span className="ml-2 text-xs font-medium rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  {list.length} total
                </span>
              </CardTitle>
              <Dialog open={open} onOpenChange={setOpen}>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add booking
                </Button>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add new booking</DialogTitle>
                  </DialogHeader>
                  <BookingForm
                    apiUrl={API_URL}
                    token={localStorage.getItem("admin_token") || ""}
                    onSuccess={() => {
                      setLoading(true);
                      fetchBookings();
                    }}
                    onClose={() => setOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="text-left py-3 px-6 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Reference
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Guest
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Room
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Rate
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Check-in
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Check-out
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((b) => (
                        <tr
                          key={b.reference_number ?? b.id ?? Math.random()}
                          className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-4 px-6 font-mono text-sm font-medium text-[#07008A]">
                            {b.reference_number ?? "—"}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-700">
                            <div>
                              <span className="font-medium">{b.guests?.full_name ?? "—"}</span>
                              {b.guests?.email && (
                                <div className="text-slate-500 truncate max-w-[140px]">{b.guests.email}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-700">
                            {b.rooms?.room_number ? (
                              <span>
                                {b.rooms.room_number}
                                {b.rooms.room_type && (
                                  <span className="text-slate-500"> ({b.rooms.room_type})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600">
                            {b.rate_plan_kind ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                                {b.rate_plan_kind}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">{b.check_in_date ?? "—"}</td>
                          <td className="py-4 px-4 text-sm text-slate-600">{b.check_out_date ?? "—"}</td>
                          <td className="py-4 px-4 font-semibold text-[#07008A]">
                            ₱{Number(b.total_amount ?? 0).toFixed(0)}
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={getStatusVariant(b.status)} className="capitalize">
                              {b.status ?? "—"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
