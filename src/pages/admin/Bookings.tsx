import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminBookings() {
  const [list, setList] = useState<unknown[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Bookings</h1>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left p-3 text-sm">Reference</th>
                <th className="text-left p-3 text-sm">Status</th>
                <th className="text-left p-3 text-sm">Check-in</th>
                <th className="text-left p-3 text-sm">Check-out</th>
              </tr>
            </thead>
            <tbody>
              {list.map(
                (b: {
                  reference_number?: string;
                  status?: string;
                  check_in_date?: string;
                  check_out_date?: string;
                }) => (
                  <tr key={b.reference_number} className="border-t">
                    <td className="p-3">{b.reference_number}</td>
                    <td className="p-3">{b.status}</td>
                    <td className="p-3">{b.check_in_date}</td>
                    <td className="p-3">{b.check_out_date}</td>
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
