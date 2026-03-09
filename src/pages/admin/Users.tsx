import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminUsers() {
  const [users, setUsers] = useState<unknown[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Admin Users</h1>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left p-3 text-sm">Email</th>
                <th className="text-left p-3 text-sm">Role ID</th>
                <th className="text-left p-3 text-sm">Active</th>
              </tr>
            </thead>
            <tbody>
              {(users as Array<{ email?: string; role_id?: number; is_active?: boolean }>).map(
                (u, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.role_id}</td>
                    <td className="p-3">{u.is_active ? "Yes" : "No"}</td>
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
