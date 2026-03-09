import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AdminRestaurant() {
  const [items, setItems] = useState<unknown[]>([]);
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
      .catch(() => setItems([]));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Restaurant Menu</h1>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left p-3 text-sm">Name</th>
                <th className="text-left p-3 text-sm">Category</th>
                <th className="text-left p-3 text-sm">Price</th>
              </tr>
            </thead>
            <tbody>
              {(items as Array<{ name?: string; category?: string; price?: number }>).map(
                (item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">{item.category}</td>
                    <td className="p-3">₱{Number(item.price || 0).toFixed(0)}</td>
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
