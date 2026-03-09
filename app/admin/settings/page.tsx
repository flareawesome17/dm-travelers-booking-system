'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    fetch(`${API_URL}/api/settings`)
      .then((r) => r.json())
      .then((data) => setSettings(typeof data === 'object' ? data : {}))
      .catch(() => setSettings({}));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex">
      <aside className="w-56 bg-[#07008A] text-white p-4">
        <p className="font-bold mb-6">D&M Admin</p>
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className="block hover:text-[#FED501]">Dashboard</Link>
          <Link href="/admin/settings" className="block text-[#FED501]">Settings</Link>
          <Link href="/" className="block text-sm opacity-80 mt-4">← Back to site</Link>
        </nav>
      </aside>
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
