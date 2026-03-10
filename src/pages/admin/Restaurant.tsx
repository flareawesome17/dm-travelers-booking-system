import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminRestaurant() {
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/menu`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Restaurant Menu</h1>
            <p className="text-muted-foreground mt-1">Manage menu items and pricing</p>
          </motion.div>
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" /> All Items
              </CardTitle>
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items as Array<{ name?: string; category?: string; price?: number }>).map((item, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-medium text-[#07008A]">{item.name ?? "—"}</td>
                          <td className="py-4 px-6 text-sm text-slate-600">{item.category ?? "—"}</td>
                          <td className="py-4 px-6 font-medium text-[#07008A]">₱{Number(item.price ?? 0).toFixed(0)}</td>
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
