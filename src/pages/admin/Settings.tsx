import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings as SettingsIcon } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/settings`)
      .then((r) => r.json())
      .then((data) => setSettings(typeof data === "object" ? data : {}))
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, [navigate]);

  const entries = Object.entries(settings);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Hotel Settings</h1>
            <p className="text-muted-foreground mt-1">Configure hotel details and preferences</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg bg-white overflow-hidden max-w-2xl">
              <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" /> Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex justify-between gap-4">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 flex-1 max-w-xs" />
                      </div>
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No settings configured yet.</p>
                ) : (
                  <ul className="space-y-0 divide-y">
                    {entries.map(([key, value]) => (
                      <li
                        key={key}
                        className="flex items-center justify-between py-4 first:pt-0 gap-4"
                      >
                        <span className="font-medium text-slate-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm text-slate-600 text-right break-all max-w-[60%]">
                          {value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
