import { useEffect, useState } from "react";
import Link from "next/link";
import type { MotionValue } from "framer-motion";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroTextOverlaysProps = {
  className?: string;
  scrollYProgress: MotionValue<number>;
};

function MobileHeroOverlays({
  scrollYProgress,
  settings,
}: {
  scrollYProgress: MotionValue<number>;
  settings: Record<string, string>;
}) {
  const hotelName = settings.hotel_name || "D&M Travelers Inn";
  const hotelAddress = settings.hotel_address?.split(",")?.[0]?.trim() || "Plaridel";
  const hotelProvince = settings.hotel_address?.includes("Misamis Occidental") ? "Misamis Occidental" : "";
  const locationText = hotelProvince ? `${hotelAddress}, ${hotelProvince}` : hotelAddress;

  const reduceMotion = useReducedMotion();
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.45, 0.9], [1, 0.92, 0.52]);
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, 10]);
  const ctaOpacity = useTransform(scrollYProgress, [0, 0.18, 0.9], [0.96, 1, 0.86]);
  const ctaY = useTransform(scrollYProgress, [0, 1], [0, 14]);

  return (
    <div className="flex h-full flex-col justify-between px-4 pb-4 pt-[5.75rem] sm:px-6 sm:pb-6 sm:pt-[6.5rem] lg:hidden">
      <motion.div
        className="max-w-[15.5rem] sm:max-w-[18.75rem]"
        style={
          reduceMotion
            ? undefined
            : {
                opacity: headlineOpacity,
                y: headlineY,
              }
        }
      >
        <p className="font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.34em] text-gold-light/88 sm:text-[0.7rem]">
          {hotelName}
        </p>
        <p className="mt-2 font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.28em] text-white/74 sm:text-[0.7rem] sm:tracking-[0.34em]">
          {locationText}
        </p>

        <h1 className="mt-4 max-w-[8ch] font-[family:var(--font-hero-display)] text-[clamp(2.15rem,13vw,3.85rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-white [text-shadow:0_12px_28px_rgba(0,0,0,0.42)]">
          Stay with comfort.
          <span className="mt-2 block text-gold-light">Arrive in style.</span>
        </h1>
        <p className="mt-4 max-w-[17.25rem] font-[family:var(--font-hero-body)] text-[0.96rem] leading-6 text-white/92 sm:max-w-[19rem] sm:text-[1rem] sm:leading-7">
          Premium stays, warm hospitality, and a welcoming atmosphere for easy
          arrivals, restful nights, and memorable dining.
        </p>
      </motion.div>

      <motion.div
        className="pointer-events-auto w-full"
        style={
          reduceMotion
            ? undefined
            : {
                opacity: ctaOpacity,
                y: ctaY,
              }
        }
      >
        <Button
          asChild
          className="h-12 w-full rounded-full bg-gradient-gold px-5 font-[family:var(--font-hero-body)] text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)]"
        >
          <Link href="/booking">
            Book Your Stay
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}

function DesktopHeroOverlays({
  scrollYProgress,
  settings,
}: {
  scrollYProgress: MotionValue<number>;
  settings: Record<string, string>;
}) {
  const hotelName = settings.hotel_name || "D&M Travelers Inn";
  const hotelAddress = settings.hotel_address?.split(",")?.[0]?.trim() || "Plaridel";
  const hotelProvince = settings.hotel_address?.includes("Misamis Occidental") ? "Misamis Occidental" : "";
  const locationText = hotelProvince ? `${hotelAddress}, ${hotelProvince}` : hotelAddress;

  const reduceMotion = useReducedMotion();
  const opacity = useTransform(scrollYProgress, [0, 0.16, 0.74, 1], [1, 1, 0.52, 0.2]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 46]);

  return (
    <div className="hidden h-full px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:block lg:px-10 lg:pb-10 lg:pt-32">
      <motion.div
        className="absolute left-6 top-28 max-w-[min(50vw,45rem)] xl:left-10 xl:top-32"
        style={reduceMotion ? undefined : { opacity, y }}
      >
        <p className="font-[family:var(--font-hero-body)] text-[0.65rem] uppercase tracking-[0.42em] text-gold-light/90 sm:text-xs">
          {hotelName} / {locationText}
        </p>
        <h1 className="mt-4 max-w-[11ch] font-[family:var(--font-hero-display)] text-[clamp(4.25rem,7vw,7.25rem)] font-semibold leading-[0.86] tracking-[-0.04em] text-white [text-shadow:0_12px_28px_rgba(0,0,0,0.28)]">
          Stay with comfort.
          <span className="mt-2 block text-gold-light">Arrive in style.</span>
        </h1>
        <p className="mt-5 max-w-[34rem] font-[family:var(--font-hero-body)] text-base leading-7 text-white/90">
          Premium stays, warm hospitality, and a welcoming atmosphere crafted
          for easy arrivals, restful nights, and memorable dining.
        </p>

        <div className="pointer-events-auto mt-7 max-w-[18rem]">
          <Button
            asChild
            className="h-12 w-full rounded-full bg-gradient-gold px-6 font-[family:var(--font-hero-body)] text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
          >
            <Link href="/booking">
              Book Your Stay
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function HeroTextOverlays({
  className,
  scrollYProgress,
}: HeroTextOverlaysProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 mx-auto h-full max-w-[1600px]",
        className,
      )}
    >
      <MobileHeroOverlays scrollYProgress={scrollYProgress} settings={settings} />
      <DesktopHeroOverlays scrollYProgress={scrollYProgress} settings={settings} />
    </div>
  );
}
