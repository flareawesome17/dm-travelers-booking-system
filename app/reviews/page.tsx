'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Array<{ guest_name: string; rating: number; comment?: string; created_at?: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/reviews`)
      .then((r) => r.json())
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-[#07008A] text-white py-4">
        <div className="container mx-auto px-4 flex justify-between">
          <Link href="/" className="text-xl font-bold">D&M Travelers Inn</Link>
          <Link href="/booking" className="hover:text-[#FED501]">Book Now</Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[#07008A] mb-8"
        >
          Guest Reviews
        </motion.h1>
        <div className="grid md:grid-cols-2 gap-6">
          {reviews.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-xl shadow"
            >
              <p className="font-semibold text-[#333]">{r.guest_name}</p>
              <p className="text-[#FED501]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
              {r.comment && <p className="text-[#333] mt-2">{r.comment}</p>}
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
