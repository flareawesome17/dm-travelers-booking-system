"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";

export default function ReviewsPage() {
  return (
    <>
      <PublicPageHero
        description="Even before testimonials scale up, the reviews page should feel trustworthy, polished, and easy to scan for guests comparing where to stay."
        eyebrow="Guest Reviews"
        imageAlt="Guest review experience at D&M Travelers Inn"
        imageSrc="/images/hero-hotel.jpg"
        stats={[
          { label: "Focus", value: "Guest trust" },
          { label: "Tone", value: "Warm and polished" },
          { label: "Update path", value: "Ready for live reviews" },
        ]}
        title="Guest trust starts with a clear, polished first impression."
      />

      <PublicSection tone="mist" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
            <PublicGlassPanel>
              <div className="flex items-center gap-1 text-gold-light">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <h2 className="mt-5 font-heading text-[clamp(2rem,7vw,3rem)] font-semibold leading-[1] text-white">
                A premium review page, ready for live guest feedback.
              </h2>
              <p className="mt-5 font-body text-sm leading-7 text-white/80 sm:text-base">
                The old placeholder block felt disconnected from the new brand story.
                This new layout keeps the page valuable now and leaves a clear structure
                for real review cards later.
              </p>
            </PublicGlassPanel>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.6 }}
              className="grid gap-5 sm:grid-cols-2"
            >
              <PublicGlassPanel className="sm:col-span-2">
                <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                  Current State
                </p>
                <p className="mt-4 font-heading text-[1.8rem] text-white sm:text-3xl">
                  No public reviews have been published yet.
                </p>
                <p className="mt-4 font-body text-sm leading-7 text-white/78">
                  As testimonials begin coming in, this page can expand into a richer
                  review wall without needing another visual reset.
                </p>
              </PublicGlassPanel>

              <PublicGlassPanel>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  Guest promise
                </p>
                <p className="mt-3 font-body text-sm leading-7 text-white/80">
                  Clear service, dependable comfort, and a stronger sense of care throughout the stay.
                </p>
              </PublicGlassPanel>

              <PublicGlassPanel>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  Next content upgrade
                </p>
                <p className="mt-3 font-body text-sm leading-7 text-white/80">
                  Add verified testimonials, stay dates, and review highlights when available.
                </p>
              </PublicGlassPanel>
            </motion.div>
          </div>

          <div className="mt-10">
            <Button
              asChild
              className="h-12 rounded-full bg-gradient-gold px-6 font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
            >
              <Link href="/booking">
                Book with confidence
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PublicGrid>
      </PublicSection>
    </>
  );
}
