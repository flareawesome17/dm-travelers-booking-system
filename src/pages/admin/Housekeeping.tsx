import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminHousekeeping() {
  const [rooms, setRooms] = useState<unknown[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/housekeeping/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Housekeeping</h1>
        <div className="grid gap-4">
          {["Dirty", "In Cleaning", "Maintenance", "Clean"].map((status) => (
            <div key={status} className="bg-white rounded-xl shadow p-4">
              <h2 className="font-semibold text-[#333] mb-2">{status}</h2>
              <div className="flex flex-wrap gap-2">
                {(rooms as Array<{ room_number?: string; status?: string }>)
                  .filter((r) => r.status === status)
                  .map((r) => (
                    <span key={r.room_number} className="px-3 py-1 bg-[#F7F7F7] rounded">
                      {r.room_number}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
