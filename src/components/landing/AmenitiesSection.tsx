"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Clock3,
  MapPin,
  Scissors,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wifi,
  Car,
} from "lucide-react";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
  PublicSectionIntro,
} from "@/components/public/PublicPrimitives";

const amenities = [
  { icon: Wifi, title: "Fast Wi-Fi", desc: "Stable connectivity across guest areas and rooms." },
  { icon: Car, title: "Secure Parking", desc: "Easy arrivals with dedicated on-site parking." },
  { icon: UtensilsCrossed, title: "Dining On Site", desc: "Comfort food and familiar favorites, thoughtfully served." },
  { icon: Scissors, title: "Salon Services", desc: "Added convenience for longer stays and quick refreshes." },
  { icon: ShieldCheck, title: "24/7 Security", desc: "A calm environment with dependable site monitoring." },
  { icon: Clock3, title: "Front Desk", desc: "Responsive guest support at any hour of the day." },
  { icon: Sparkles, title: "Housekeeping", desc: "Daily upkeep to keep every stay feeling cared for." },
  { icon: MapPin, title: "Prime Access", desc: "Positioned well for local travel, business, and stopovers." },
];

export default function AmenitiesSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <PublicSection tone="deep-soft" className="py-16 lg:py-24">
      <PublicGrid>
        <div ref={ref}>
          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.65 }}
          >
            <PublicSectionIntro
              eyebrow="What Awaits"
              title="Comfort-led amenities with a more polished guest experience."
              description="Every part of the stay is arranged to feel warm, practical, and quietly premium from arrival to checkout."
            />
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {amenities.map((item, index) => (
              <motion.div
                key={item.title}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                initial={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
              >
                <PublicGlassPanel className="group h-full p-4 sm:p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-light/20 bg-gold/10">
                    <item.icon className="h-5 w-5 text-gold-light" />
                  </div>
                  <h3 className="mt-4 font-heading text-[1.45rem] font-semibold text-white sm:text-[1.7rem]">
                    {item.title}
                  </h3>
                  <p className="mt-3 font-body text-sm leading-7 text-white/80">
                    {item.desc}
                  </p>
                </PublicGlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </PublicGrid>
    </PublicSection>
  );
}
