'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminHousekeepingPage() {
  const [rooms, setRooms] = useState<unknown[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    fetch(`${API_URL}/api/housekeeping/rooms`, { headers: { Authorization: `Bearer ${token}` } })
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
          <Link href="/admin/rooms" className="block hover:text-[#FED501]">Rooms</Link>
          <Link href="/admin/housekeeping" className="block text-[#FED501]">Housekeeping</Link>
          <Link href="/admin/restaurant" className="block hover:text-[#FED501]">Restaurant</Link>
          <Link href="/" className="block text-sm opacity-80 mt-4">← Back to site</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-[#07008A] mb-6">Housekeeping</h1>
        <div className="grid gap-4">
          {['Dirty', 'In Cleaning', 'Maintenance', 'Clean'].map((status) => (
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
