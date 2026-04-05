"use client";

import { motion, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BedDouble, Hotel, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
  PublicSectionIntro,
} from "@/components/public/PublicPrimitives";

type RoomType = {
  room_id: string;
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  max_capacity: number | null;
  total_rooms: number;
  available_rooms: number | null;
  is_featured: boolean;
};

const STATIC_DESCS: Record<string, string> = {
  "Standard Room": "A clean, relaxed room category for practical overnight comfort.",
  "Deluxe Room": "More space, a more elevated finish, and a calmer in-room rhythm.",
  "Executive Suite": "A higher-tier stay experience for guests who want extra room to unwind.",
};

export default function FeaturedRoomsSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/room-types")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data?.room_types)) {
          // Filter to only rooms explicitly marked as featured
          const featured = data.room_types.filter((r: RoomType) => r.is_featured);
          setRooms(featured);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublicSection tone="ink" className="py-16 lg:py-24">
      <PublicGrid>
        <div ref={ref}>
          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.65 }}
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
          >
            <PublicSectionIntro
              eyebrow="Accommodations"
              title="Room categories shaped for restful, straightforward stays."
              description="Browse our hand-picked featured rooms, or view all availability for your dates."
            />

            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/6 px-5 py-3 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10"
            >
              View all rooms
              <ArrowRight className="h-4 w-4 text-gold-light" />
            </Link>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {loading ? (
              [0, 1, 2].map((item) => (
                <PublicGlassPanel key={item} className="overflow-hidden p-0">
                  <div className="aspect-[4/4.6] animate-pulse bg-white/6" />
                </PublicGlassPanel>
              ))
            ) : rooms.length > 0 ? (
              rooms.map((room, index) => {
                const description =
                  STATIC_DESCS[room.room_type] ||
                  "Comfortable accommodation with the essentials in place for a dependable stay.";

                return (
                  <motion.div
                    key={room.room_id}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    initial={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.55, delay: index * 0.08 }}
                  >
                    <PublicGlassPanel className="group h-full overflow-hidden p-0">
                      <div className="relative aspect-[4/4.7] overflow-hidden">
                        {room.sample_image_url ? (
                          <Image
                            alt={room.room_type}
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            fill
                            sizes="(max-width: 1024px) 100vw, 33vw"
                            src={room.sample_image_url}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/60 to-secondary/20 p-8 text-center backdrop-blur-md transition-all duration-700 group-hover:scale-105">
                            <div className="flex flex-col items-center gap-3">
                              <div className="rounded-full bg-white/10 p-4 backdrop-blur-sm">
                                <Hotel className="h-8 w-8 text-gold-light/40" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-heading text-lg font-medium text-white/40">No Preview</p>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/20">Image coming soon</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_24%,rgba(5,14,27,0.82)_100%)]" />

                        <div className="absolute left-4 top-4 rounded-full border border-white/14 bg-secondary/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-gold-light/90 backdrop-blur-md sm:left-5 sm:top-5 sm:tracking-[0.28em]">
                          Featured
                        </div>

                        {room.min_price != null ? (
                          <div className="absolute right-5 top-5 rounded-full bg-gradient-gold px-3 py-1 text-sm font-semibold text-secondary">
                            PHP {Number(room.min_price).toLocaleString()}
                          </div>
                        ) : null}

                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/72 sm:tracking-[0.32em]">
                            D&M Travellers Inn
                          </p>
                          <h3 className="mt-2 font-heading text-[1.9rem] font-semibold text-white sm:text-3xl">
                            {room.room_type}
                          </h3>
                          <p className="mt-3 font-body text-sm leading-6 text-white/82">
                            {description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-white/72 sm:tracking-[0.22em]">
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-gold-light" />
                              Up to {room.max_capacity ?? "N/A"} guests
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <BedDouble className="h-3.5 w-3.5 text-gold-light" />
                              {room.total_rooms} total rooms
                            </span>
                          </div>

                          <Button
                            asChild
                            className="mt-6 h-11 rounded-full bg-white/10 px-5 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/16"
                            variant="ghost"
                          >
                            <Link href={`/booking?roomId=${encodeURIComponent(room.room_id)}`}>
                              Book this room
                              <ArrowRight className="h-4 w-4 text-gold-light" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </PublicGlassPanel>
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Hotel className="h-8 w-8 text-white/20" />
                </div>
                <p className="font-heading text-xl text-white/40">Our featured selections are being updated.</p>
                <p className="text-white/20 mt-2">Please check back soon for our recommended stays.</p>
              </div>
            )}
          </div>
        </div>
      </PublicGrid>
    </PublicSection>
  );
}
