'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function RestaurantPage() {
  const [items, setItems] = useState<Array<{ name: string; description?: string; price: number; category: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/menu`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  const byCategory = items.reduce((acc, item) => {
    const c = item.category || 'Other';
    if (!acc[c]) acc[c] = [];
    acc[c].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-[#07008A] text-white py-4">
        <div className="container mx-auto px-4 flex justify-between">
          <Link href="/" className="text-xl font-bold">D&M Travelers Inn</Link>
          <nav className="flex gap-6">
            <Link href="/rooms" className="hover:text-[#FED501]">Rooms</Link>
            <Link href="/booking" className="hover:text-[#FED501]">Book</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[#07008A] mb-8"
        >
          Restaurant Menu
        </motion.h1>
        {Object.entries(byCategory).map(([cat, list], i) => (
          <motion.section
            key={cat}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="mb-10"
          >
            <h2 className="text-xl font-semibold text-[#333] mb-4">{cat}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {list.map((item) => (
                <div key={item.name} className="bg-white p-4 rounded-xl shadow">
                  <p className="font-semibold text-[#333]">{item.name}</p>
                  {item.description && <p className="text-sm text-[#333] mt-1">{item.description}</p>}
                  <p className="text-[#07008A] font-bold mt-2">₱{Number(item.price).toFixed(0)}</p>
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </main>
    </div>
  );
}
