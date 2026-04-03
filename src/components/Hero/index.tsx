"use client";

import { useRef } from "react";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import HeroCanvas from "./HeroCanvas";
import HeroTextOverlays from "./HeroTextOverlays";
import { cn } from "@/lib/utils";

const heroDisplayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-hero-display",
  weight: ["500", "600", "700"],
});

const heroBodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-hero-body",
  weight: ["400", "500", "600", "700"],
});

export default function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const vignetteOpacity = useTransform(scrollYProgress, [0, 0.4, 1], [0.5, 0.72, 0.84]);
  const ambientOpacity = useTransform(scrollYProgress, [0, 0.55, 1], [0.85, 0.45, 0.2]);
  const topTintOpacity = useTransform(scrollYProgress, [0, 0.28, 0.72, 1], [0.9, 0.7, 0.5, 0.36]);
  const lineOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.2, 0.42, 0.36, 0.1]);
  const ambientScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <section
      ref={sectionRef}
      className={cn(
        heroDisplayFont.variable,
        heroBodyFont.variable,
        "relative isolate h-[100dvh] md:h-screen lg:h-[420vh] xl:h-[440vh] bg-secondary text-white",
      )}
    >
        <div className="sticky top-0 z-20 h-screen overflow-hidden">
          <HeroCanvas scrollYProgress={scrollYProgress} />

          <motion.div
            aria-hidden="true"
            className="absolute inset-0"
            style={
              reduceMotion
                ? undefined
                : {
                    opacity: ambientOpacity,
                    scale: ambientScale,
                  }
            }
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,212,97,0.22),transparent_26%),radial-gradient(circle_at_82%_22%,rgba(42,101,172,0.22),transparent_26%),radial-gradient(circle_at_78%_78%,rgba(255,198,66,0.14),transparent_22%)]" />
          </motion.div>

          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,37,0.9)_0%,rgba(6,18,37,0.35)_24%,rgba(6,18,37,0.22)_52%,rgba(6,18,37,0.82)_100%)]"
            style={reduceMotion ? undefined : { opacity: topTintOpacity }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,27,0.9)_0%,rgba(5,15,27,0.54)_26%,rgba(5,15,27,0.42)_56%,rgba(5,15,27,0.96)_100%)] lg:hidden"
          />

          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(6,18,37,0.68)_100%)]"
            style={reduceMotion ? undefined : { opacity: vignetteOpacity }}
          />

          <motion.div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-light/80 to-transparent"
            style={reduceMotion ? undefined : { opacity: lineOpacity }}
          />

          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_18%,transparent_82%,rgba(255,215,102,0.08)_100%)] mix-blend-screen"
            style={reduceMotion ? undefined : { opacity: ambientOpacity }}
          />

          <HeroTextOverlays scrollYProgress={scrollYProgress} />
        </div>
    </section>
  );
}
