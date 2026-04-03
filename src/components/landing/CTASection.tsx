"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
} from "@/components/public/PublicPrimitives";

export default function CTASection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <PublicSection tone="ink" className="py-16 lg:py-24">
      <PublicGrid>
        <motion.div
          ref={ref}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.7 }}
        >
          <PublicGlassPanel className="overflow-hidden p-0">
            <div className="relative px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,204,92,0.16),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(49,115,201,0.14),transparent_24%)]" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.38em]">
                    Final Call
                  </p>
                  <h2 className="mt-4 max-w-[16ch] font-heading text-[clamp(2.1rem,7vw,4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl">
                    Make the first impression of the stay feel easy before guests even arrive.
                  </h2>
                  <p className="mt-5 max-w-2xl font-body text-sm leading-7 text-white/80 sm:text-base">
                    The public site now carries the same premium tone across the journey.
                    Let the booking flow finish the story with a cleaner, more confident reservation experience.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    className="h-12 rounded-full bg-gradient-gold px-6 font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
                  >
                    <Link href="/booking">
                      Reserve your room
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-full border-white/18 bg-white/6 px-6 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/contact">Speak with the front desk</Link>
                  </Button>
                </div>
              </div>
            </div>
          </PublicGlassPanel>
        </motion.div>
      </PublicGrid>
    </PublicSection>
  );
}
