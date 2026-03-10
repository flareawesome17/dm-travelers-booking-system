import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Download, Banknote } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminReports() {
  const [revenue, setRevenue] = useState<{
    total?: number;
    by_method?: Record<string, number>;
  }>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/reports/revenue`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRevenue(data || {}))
      .catch(() => setRevenue({}))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleExport = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch(`${API_URL}/api/reports/revenue?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenue.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-1">Revenue and analytics</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg bg-white overflow-hidden">
              <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" /> Revenue Summary
                  </CardTitle>
                  <Button
                    onClick={handleExport}
                    size="sm"
                    className="bg-[#07008A] hover:bg-[#05006a] text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-6 w-full max-w-md" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#07008A]/10 text-[#07008A]">
                        <Banknote className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                        <p className="text-3xl font-bold text-[#07008A]">
                          ₱{Number(revenue.total ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    {revenue.by_method && Object.keys(revenue.by_method).length > 0 && (
                      <div className="border-t pt-6">
                        <p className="text-sm font-semibold text-slate-600 mb-3">By payment method</p>
                        <ul className="space-y-2">
                          {Object.entries(revenue.by_method).map(([method, amt]) => (
                            <li
                              key={method}
                              className="flex items-center justify-between py-2 px-4 rounded-lg bg-slate-50"
                            >
                              <span className="font-medium text-slate-700 capitalize">{method}</span>
                              <span className="font-semibold text-[#07008A]">
                                ₱{Number(amt).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
