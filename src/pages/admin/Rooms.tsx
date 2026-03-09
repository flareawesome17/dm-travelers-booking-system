import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminRooms() {
  const [rooms, setRooms] = useState<unknown[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Rooms</h1>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left p-3 text-sm">Room #</th>
                <th className="text-left p-3 text-sm">Type</th>
                <th className="text-left p-3 text-sm">Status</th>
                <th className="text-left p-3 text-sm">Price/night</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(
                (r: {
                  room_number?: string;
                  room_type?: string;
                  status?: string;
                  base_price_per_night?: number;
                }) => (
                  <tr key={r.room_number} className="border-t">
                    <td className="p-3">{r.room_number}</td>
                    <td className="p-3">{r.room_type}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">₱{Number(r.base_price_per_night || 0).toFixed(0)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
