'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<unknown[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    fetch(`${API_URL}/api/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <aside className="w-56 bg-[#07008A] text-white p-4">
        <p className="font-bold mb-6">D&M Admin</p>
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className="block hover:text-[#FED501]">Dashboard</Link>
          <Link href="/admin/bookings" className="block hover:text-[#FED501]">Bookings</Link>
          <Link href="/admin/rooms" className="block text-[#FED501]">Rooms</Link>
          <Link href="/admin/housekeeping" className="block hover:text-[#FED501]">Housekeeping</Link>
          <Link href="/admin/restaurant" className="block hover:text-[#FED501]">Restaurant</Link>
          <Link href="/" className="block text-sm opacity-80 mt-4">← Back to site</Link>
        </nav>
      </aside>
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
              {rooms.map((r: { room_number?: string; room_type?: string; status?: string; base_price_per_night?: number }) => (
                <tr key={r.room_number} className="border-t">
                  <td className="p-3">{r.room_number}</td>
                  <td className="p-3">{r.room_type}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">₱{Number(r.base_price_per_night || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
