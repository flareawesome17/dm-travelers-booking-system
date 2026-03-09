import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
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
      .catch(() => setSettings({}));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Hotel Settings</h1>
        <div className="bg-white rounded-xl shadow p-6 max-w-lg">
          <ul className="space-y-2">
            {Object.entries(settings).map(([key, value]) => (
              <li key={key} className="text-[#333]">
                <span className="font-medium">{key}:</span> {value}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
