"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type RoomType = {
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  max_capacity: number | null;
  total_rooms: number;
  available_rooms: number | null;
};

const STATIC_IMAGES: Record<string, string> = {
  "Standard Room": "/images/room-standard.jpg",
  "Deluxe Room": "/images/room-deluxe.jpg",
  "Executive Suite": "/images/room-suite.jpg",
};

const STATIC_DESCS: Record<string, string> = {
  "Standard Room": "Cozy comfort with all the essentials for a relaxing stay.",
  "Deluxe Room": "Spacious elegance with premium furnishings and garden views.",
  "Executive Suite": "Luxury suite with living area and panoramic tropical views.",
};

function getFallbackImage(index: number): string {
  const fallbacks = ["/images/room-standard.jpg", "/images/room-deluxe.jpg", "/images/room-suite.jpg"];
  return fallbacks[index % fallbacks.length];
}

const FeaturedRoomsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/room-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.room_types) setRooms(data.room_types.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Accommodations</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">Featured Rooms</h2>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden shadow-soft animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <div className="p-5 lg:p-6 space-y-3">
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-9 bg-muted rounded w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {rooms.map((room, i) => {
              const image = room.sample_image_url || STATIC_IMAGES[room.room_type] || getFallbackImage(i);
              const desc = STATIC_DESCS[room.room_type] || "Comfortable and well-appointed accommodation for a great stay.";
              return (
                <motion.div
                  key={room.room_type}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="bg-card rounded-xl overflow-hidden shadow-soft group"
                >
                  <div className="relative overflow-hidden aspect-[4/3]">
                    <img
                      src={image}
                      alt={room.room_type}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {room.min_price != null && (
                      <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                        ₱{room.min_price.toLocaleString()}/night
                      </div>
                    )}
                  </div>
                  <div className="p-5 lg:p-6">
                    <h3 className="font-heading text-xl font-bold text-foreground mb-2">{room.room_type}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                    {room.max_capacity != null && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Up to {room.max_capacity} Guests</span>
                      </div>
                    )}
                    <Link href="/booking">
                      <Button variant="outline" className="w-full group/btn border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                        Book Now <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : null}

        <div className="text-center mt-10">
          <Link href="/rooms">
            <Button variant="ghost" className="text-primary hover:text-primary/80 font-medium">
              View All Rooms <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedRoomsSection;
