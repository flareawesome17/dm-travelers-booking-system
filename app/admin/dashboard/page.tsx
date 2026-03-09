'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<unknown[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    fetch(`${API_URL}/api/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <aside className="w-56 bg-[#07008A] text-white p-4">
        <p className="font-bold mb-6">D&M Admin</p>
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className="block text-[#FED501]">Dashboard</Link>
          <Link href="/admin/bookings" className="block hover:text-[#FED501]">Bookings</Link>
          <Link href="/admin/rooms" className="block hover:text-[#FED501]">Rooms</Link>
          <Link href="/admin/housekeeping" className="block hover:text-[#FED501]">Housekeeping</Link>
          <Link href="/admin/restaurant" className="block hover:text-[#FED501]">Restaurant</Link>
          <Link href="/admin/reports" className="block hover:text-[#FED501]">Reports</Link>
          <Link href="/admin/users" className="block hover:text-[#FED501]">Users</Link>
          <Link href="/admin/settings" className="block hover:text-[#FED501]">Settings</Link>
          <Link href="/" className="block text-sm opacity-80 mt-4">← Back to site</Link>
        </nav>
      </aside>
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
              {bookings.slice(0, 10).map((b: { reference_number?: string; status?: string; check_in_date?: string }) => (
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
