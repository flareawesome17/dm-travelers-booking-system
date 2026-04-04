"use client";

import { motion, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BedDouble, Hotel, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";

type RoomTypeOption = {
  room_type: string;
  sample_image_url: string | null;
  min_price: number | null;
  total_rooms: number;
  max_capacity: number | null;
};

function fallbackImageForRoomType(roomType: string) {
  const value = roomType.toLowerCase();
  if (value.includes("suite")) return "/images/room-suite.jpg";
  if (value.includes("deluxe")) return "/images/room-deluxe.jpg";
  if (value.includes("standard")) return "/images/room-standard.jpg";
  return "/images/room-standard.jpg";
}

export default function RoomsPage() {
  const [filter, setFilter] = useState("All");
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/public/room-types")
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          throw new Error(json?.error || "Failed to load rooms.");
        }

        const list = Array.isArray(json?.room_types) ? json.room_types : [];
        if (!cancelled) {
          setRoomTypes(list);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Failed to load rooms.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo(
    () => ["All", ...roomTypes.map((room) => room.room_type)],
    [roomTypes],
  );

  const filteredRooms = useMemo(() => {
    if (filter === "All") {
      return roomTypes;
    }

    return roomTypes.filter((room) => room.room_type === filter);
  }, [filter, roomTypes]);

  return (
    <>
      <PublicPageHero
        description="Browse room categories that feel clear, trustworthy, and easy to compare on any device before starting a direct booking."
        eyebrow="Rooms And Suites"
        imageAlt="D&M Travellers Inn room interior"
        imageSrc="/images/room-suite.jpg"
        stats={[
          { label: "Room types", value: loading ? "Loading" : String(roomTypes.length || 0) },
          { label: "Stay style", value: "Comfort-first" },
          { label: "Booking flow", value: "Direct online" },
        ]}
        title="Choose the room that fits your stay."
      />

      <PublicSection tone="deep-soft" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div ref={ref}>
            <div className="flex flex-wrap gap-3">
              {filters.map((type) => (
                <button
                  key={type}
                  className={
                    filter === type
                      ? "rounded-full border border-gold-light/30 bg-gradient-gold px-5 py-3 font-body text-sm font-semibold text-secondary"
                      : "rounded-full border border-white/14 bg-white/8 px-5 py-3 font-body text-sm text-white/88 transition-colors duration-300 hover:bg-white/10 hover:text-white"
                  }
                  onClick={() => setFilter(type)}
                  type="button"
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-5 xl:grid-cols-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <PublicGlassPanel key={index} className="overflow-hidden p-0">
                    <div className="grid min-h-[24rem] animate-pulse md:grid-cols-[0.42fr_0.58fr]">
                      <div className="bg-white/6" />
                      <div className="bg-white/[0.03]" />
                    </div>
                  </PublicGlassPanel>
                ))
              ) : filteredRooms.length === 0 ? (
                <PublicGlassPanel className="xl:col-span-2">
                  <p className="font-body text-sm text-white/76">
                    No rooms are available for this filter.
                  </p>
                </PublicGlassPanel>
              ) : (
                filteredRooms.map((room, index) => (
                  <motion.div
                    key={room.room_type}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    initial={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.55, delay: index * 0.06 }}
                  >
                    <PublicGlassPanel className="overflow-hidden p-0">
                      <div className="flex flex-col h-full">
                        <div className="relative h-64 sm:h-72 shrink-0 w-full">
                          <Image
                            alt={room.room_type}
                            className="object-cover"
                            fill
                            sizes="(max-width: 1280px) 100vw, 44vw"
                            src={room.sample_image_url || fallbackImageForRoomType(room.room_type)}
                          />
                        </div>

                        <div className="flex flex-col p-6 sm:p-8 justify-center">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-5">
                            <div>
                              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-gold-light/90 sm:tracking-[0.32em]">
                                D&amp;M Travellers Inn
                              </p>
                              <h2 className="mt-1.5 font-heading text-2xl font-semibold text-white sm:text-3xl">
                                {room.room_type}
                              </h2>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/60 sm:tracking-[0.3em]">
                                Starting rate
                              </p>
                              <p className="mt-1 font-heading text-[1.75rem] text-gold-light font-semibold sm:text-2xl">
                                {room.min_price != null
                                  ? `PHP ${Number(room.min_price).toLocaleString()}`
                                  : "Request rate"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 text-white/80 font-body text-sm">
                              <Users className="h-4 w-4 text-gold-light" />
                              <span>Up to {room.max_capacity ?? "N/A"} guests</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/80 font-body text-sm">
                              <Hotel className="h-4 w-4 text-gold-light" />
                              <span>{room.total_rooms} rooms in inventory</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/80 font-body text-sm sm:col-span-2">
                              <BedDouble className="h-4 w-4 text-gold-light" />
                              <span>Comfortable accommodation prepared for restful overnight stays.</span>
                            </div>
                          </div>

                          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button
                              asChild
                              className="h-11 rounded-full bg-gradient-gold px-6 font-body text-sm font-semibold text-secondary shadow-[0_12px_30px_-15px_hsl(var(--gold)/0.9)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
                            >
                              <Link href={`/booking?roomType=${encodeURIComponent(room.room_type)}`}>
                                Book this room
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>

                            <Button
                              asChild
                              className="h-11 rounded-full border-white/14 bg-white/6 px-6 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10 hover:text-white"
                              variant="outline"
                            >
                              <Link href="/contact">Ask about availability</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PublicGlassPanel>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </PublicGrid>
      </PublicSection>
    </>
  );
}
