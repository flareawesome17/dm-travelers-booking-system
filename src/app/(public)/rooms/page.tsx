"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, Maximize, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

type RoomTypeOption = {
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  total_rooms: number;
  max_capacity: number | null;
};

function fallbackImageForRoomType(roomType: string) {
  const t = roomType.toLowerCase();
  if (t.includes("suite")) return "/images/room-suite.jpg";
  if (t.includes("deluxe")) return "/images/room-deluxe.jpg";
  if (t.includes("standard")) return "/images/room-standard.jpg";
  return "/images/room-standard.jpg";
}

export default function RoomsPage() {
  const [filter, setFilter] = useState("All");
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/public/room-types")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j?.error || "Failed to load rooms.");
        const list = Array.isArray(j?.room_types) ? j.room_types : [];
        if (!cancelled) setRoomTypes(list);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load rooms."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo(() => ["All", ...roomTypes.map((r) => r.room_type)], [roomTypes]);
  const filtered = useMemo(() => {
    if (filter === "All") return roomTypes;
    return roomTypes.filter((r) => r.room_type === filter);
  }, [filter, roomTypes]);

  return (
    <div className="pt-20">
      {/* Header */}
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl lg:text-5xl font-bold text-primary-foreground mb-3"
          >
            Rooms &amp; Suites
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-secondary-foreground/70 max-w-lg mx-auto"
          >
            Choose from our selection of comfortable and well-appointed rooms.
          </motion.p>
        </div>
      </section>

      {/* Filter + Rooms */}
      <section ref={ref} className="py-12 lg:py-20 bg-background">
        <div className="container mx-auto px-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {filters.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === type
                    ? "bg-primary text-primary-foreground shadow-gold"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Room Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {loading ? (
              <div className="col-span-full text-center text-sm text-muted-foreground">Loading rooms...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center text-sm text-muted-foreground">No rooms available.</div>
            ) : (
              filtered.map((room, i) => (
                <motion.div
                  key={room.room_type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card rounded-xl overflow-hidden shadow-soft flex flex-col md:flex-row group"
                >
                  <div className="relative w-full md:w-2/5 overflow-hidden">
                    <Image
                      src={room.sample_image_url || fallbackImageForRoomType(room.room_type)}
                      alt={room.room_type}
                      width={400}
                      height={300}
                      className="w-full h-48 md:h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5 lg:p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-heading text-xl font-bold text-foreground">{room.room_type}</h3>
                      <span className="text-primary font-bold text-lg">
                        {room.min_price != null ? `₱${Number(room.min_price).toLocaleString()}` : "—"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 flex-1">
                      Comfortable accommodation designed for a relaxing stay.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Up to {room.max_capacity ?? "—"} Guests</span>
                      <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {room.total_rooms} room(s)</span>
                    </div>
                    <Link href="/booking">
                      <Button className="w-full bg-gradient-gold text-secondary font-semibold hover:opacity-90">
                        Book This Room <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
