'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Array<{
    id: string;
    room_number: string;
    room_type: string;
    capacity: number;
    base_price_per_night: number;
    amenities?: string[];
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`)
      .then((r) => r.json())
      .then((data) => {
        setRooms(Array.isArray(data) ? data : []);
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-[#07008A] text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">D&M Travelers Inn</Link>
          <nav className="flex gap-6">
            <Link href="/rooms" className="text-[#FED501]">Rooms</Link>
            <Link href="/restaurant" className="hover:text-[#FED501] transition">Restaurant</Link>
            <Link href="/booking" className="hover:text-[#FED501] transition">Book Now</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[#07008A] mb-8"
        >
          Our Rooms
        </motion.h1>

        {loading ? (
          <p className="text-[#333]">Loading rooms...</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div className="h-48 bg-[#07008A]/10" />
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-[#333]">{room.room_type} - {room.room_number}</h2>
                  <p className="text-[#333] mt-1">Up to {room.capacity} guests</p>
                  <p className="text-[#07008A] font-bold mt-2">₱{Number(room.base_price_per_night).toFixed(0)} / night</p>
                  <Link
                    href={`/booking?room=${encodeURIComponent(room.room_type)}`}
                    className="mt-4 inline-block bg-[#FED501] text-[#07008A] font-semibold px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    Book Now
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
