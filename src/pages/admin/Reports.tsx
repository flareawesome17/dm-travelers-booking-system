import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminReports() {
  const [revenue, setRevenue] = useState<{
    total?: number;
    by_method?: Record<string, number>;
  }>({});
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
      .catch(() => setRevenue({}));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Reports</h1>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-[#333] mb-4">Revenue Summary</h2>
          <p className="text-2xl font-bold text-[#07008A]">
            ₱{Number(revenue.total || 0).toFixed(2)}
          </p>
          {revenue.by_method && (
            <ul className="mt-4 space-y-2">
              {Object.entries(revenue.by_method).map(([method, amt]) => (
                <li key={method} className="text-[#333]">
                  {method}: ₱{Number(amt).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={async () => {
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
            }}
            className="mt-4 inline-block bg-[#07008A] text-white px-4 py-2 rounded-lg text-sm hover:opacity-90"
          >
            Export CSV
          </button>
        </div>
      </main>
    </div>
  );
}
