"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
  PublicSectionIntro,
} from "@/components/public/PublicPrimitives";

const previewQuotes = [
  "Warm, straightforward hospitality that makes late arrivals easier.",
  "Comfortable rooms and a calmer atmosphere than you expect from a quick stopover.",
];

export default function TestimonialsSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <PublicSection tone="mist" className="py-16 lg:py-24">
      <PublicGrid>
        <div ref={ref} className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.65 }}
          >
            <PublicSectionIntro
              eyebrow="Guest Sentiment"
              title="Trust grows when the experience feels consistent."
              description="The reviews page now sits within the same premium story instead of feeling like a separate product. Even before testimonials scale up, the page feels deliberate."
            />
          </motion.div>

          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="grid gap-4"
          >
            {previewQuotes.map((quote) => (
              <PublicGlassPanel key={quote} className="p-5 sm:p-6">
                <div className="flex items-center gap-1 text-gold-light">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 font-heading text-[1.5rem] leading-snug text-white sm:text-2xl">
                  "{quote}"
                </p>
              </PublicGlassPanel>
            ))}

            <Button
              asChild
              className="mt-2 h-12 rounded-full bg-gradient-gold px-6 font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
            >
              <Link href="/reviews">
                View reviews page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </PublicGrid>
    </PublicSection>
  );
}
