"use client";

import { motion, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Coffee, Soup, UtensilsCrossed, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
  PublicSectionIntro,
} from "@/components/public/PublicPrimitives";

const diningMoments = [
  { label: "Breakfast", icon: Coffee },
  { label: "Local favorites", icon: Soup },
  { label: "Guest dining", icon: UtensilsCrossed },
  { label: "Evening meals", icon: Wine },
];

export default function RestaurantPreview() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <PublicSection tone="deep" className="py-16 lg:py-24">
      <PublicGrid>
        <div
          ref={ref}
          className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12"
        >
          <motion.div
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            initial={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.65 }}
          >
            <PublicSectionIntro
              eyebrow="Dining Experience"
              title="A dining atmosphere that feels welcoming, familiar, and thoughtfully prepared."
              description="The restaurant extends the stay experience with warm service, satisfying meals, and a setting that suits both quick stops and longer evenings."
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {diningMoments.map((item) => (
                <PublicGlassPanel key={item.label} className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
                    <item.icon className="h-4 w-4 text-gold-light" />
                  </div>
                  <span className="font-body text-sm text-white/78">{item.label}</span>
                </PublicGlassPanel>
              ))}
            </div>

            <Button
              asChild
              className="mt-8 h-12 rounded-full bg-gradient-gold px-6 font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
            >
              <Link href="/restaurant">
                Explore the restaurant
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            initial={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            <PublicGlassPanel className="overflow-hidden p-0">
              <div className="relative aspect-[4/3.25] overflow-hidden">
                <Image
                  alt="D&M Travelers Inn restaurant"
                  className="object-cover"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  src="/images/restaurant.jpg"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,14,29,0.1)_0%,rgba(4,14,29,0.78)_100%)]" />

                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-gold-light/88 sm:tracking-[0.36em]">
                    Hospitality Beyond The Room
                  </p>
                  <h3 className="mt-3 max-w-xl font-heading text-[1.9rem] font-semibold text-white sm:text-4xl">
                    From arrival to dining, the stay experience stays cohesive.
                  </h3>
                </div>
              </div>
            </PublicGlassPanel>
          </motion.div>
        </div>
      </PublicGrid>
    </PublicSection>
  );
}
