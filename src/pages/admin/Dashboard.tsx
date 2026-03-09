import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<unknown[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Dashboard</h1>
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-[#333] text-sm">Total Bookings</p>
            <p className="text-2xl font-bold text-[#07008A]">{bookings.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="p-4 font-semibold text-[#333]">Recent Bookings</h2>
          <table className="w-full">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left p-3 text-sm">Reference</th>
                <th className="text-left p-3 text-sm">Status</th>
                <th className="text-left p-3 text-sm">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {bookings
                .slice(0, 10)
                .map((b: { reference_number?: string; status?: string; check_in_date?: string }) => (
                  <tr key={b.reference_number} className="border-t">
                    <td className="p-3">{b.reference_number}</td>
                    <td className="p-3">{b.status}</td>
                    <td className="p-3">{b.check_in_date}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
