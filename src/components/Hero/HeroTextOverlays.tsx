import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { MotionValue } from "framer-motion";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Coffee,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroCta = {
  label: string;
  href: string;
};

type HeroChapter = {
  id: "arrival" | "rooms" | "dining" | "trust" | "booking";
  label: string;
  startFrame: number;
  endFrame: number;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primaryCta: HeroCta;
  secondaryCta: HeroCta;
  chips: string[];
  detailTitle: string;
  detailMeta: string;
};

type HeroTextOverlaysProps = {
  className?: string;
  scrollYProgress: MotionValue<number>;
};

const TOTAL_JOURNEY_FRAMES = 120;

const heroChapters: HeroChapter[] = [
  {
    id: "arrival",
    label: "Arrival",
    startFrame: 0,
    endFrame: 25,
    eyebrow: "D&M Travellers Inn / Looc Proper, Misamis Occidental",
    title: "Stay with comfort.",
    accent: "Arrive in style.",
    description:
      "Premium stays, warm hospitality, and a welcoming atmosphere crafted for easy arrivals, restful nights, and memorable dining.",
    primaryCta: { label: "Book Your Stay", href: "/booking" },
    secondaryCta: { label: "View Rooms", href: "/rooms" },
    chips: ["Premium Hospitality", "Warmly Delivered"],
    detailTitle: "Premium Hospitality",
    detailMeta: "Warmly delivered from arrival to rest",
  },
  {
    id: "rooms",
    label: "Rooms",
    startFrame: 26,
    endFrame: 55,
    eyebrow: "Rooms & Comfort",
    title: "Restful rooms for",
    accent: "easy arrivals.",
    description:
      "Clean, comfortable, and designed for short stays, overnight rest, family visits, and relaxing stopovers.",
    primaryCta: { label: "View Rooms", href: "/rooms" },
    secondaryCta: { label: "Check Rates", href: "/rooms" },
    chips: ["24-Hour Stay", "Clean Rooms", "Family Friendly", "Easy Booking"],
    detailTitle: "Comfort-first rooms",
    detailMeta: "Practical stays with polished essentials",
  },
  {
    id: "dining",
    label: "Dining",
    startFrame: 56,
    endFrame: 85,
    eyebrow: "Restaurant & Dining",
    title: "Dine, relax, and",
    accent: "enjoy the moment.",
    description:
      "Enjoy a warm dining experience for guests, families, and visitors in a welcoming inn atmosphere.",
    primaryCta: { label: "Explore Restaurant", href: "/restaurant" },
    secondaryCta: { label: "See Menu", href: "/restaurant" },
    chips: ["Breakfast", "Meals", "Drinks", "Guest Dining"],
    detailTitle: "Breakfast - Meals - Drinks",
    detailMeta: "A relaxed dining stop for guests and visitors",
  },
  {
    id: "trust",
    label: "Reviews",
    startFrame: 86,
    endFrame: 105,
    eyebrow: "Guest Experience",
    title: "Your inn,",
    accent: "your journey.",
    description:
      "A welcoming place to rest, dine, and enjoy your stay in Misamis Occidental.",
    primaryCta: { label: "Read Reviews", href: "/reviews" },
    secondaryCta: { label: "Contact Us", href: "/contact" },
    chips: ["Warm Hospitality", "Guest-Friendly Rates", "Easy Location", "Comfortable Stay"],
    detailTitle: "Guest confidence",
    detailMeta: "Comfort, location, and service in one stay",
  },
  {
    id: "booking",
    label: "Book",
    startFrame: 106,
    endFrame: 120,
    eyebrow: "Reserve Today",
    title: "Ready for",
    accent: "your stay?",
    description:
      "Choose your room, check availability, and reserve your visit at D&M Travellers Inn.",
    primaryCta: { label: "Book Now", href: "/booking" },
    secondaryCta: { label: "Call Us", href: "tel:+639518683018" },
    chips: ["Check Availability", "Reserve Today"],
    detailTitle: "Reservation prompt",
    detailMeta: "Rooms, rates, and stay details in one flow",
  },
];

const progressToFrame = (progress: number) =>
  Math.min(TOTAL_JOURNEY_FRAMES, Math.max(0, Math.round(progress * TOTAL_JOURNEY_FRAMES)));

const getChapterByFrame = (frame: number) =>
  heroChapters.find((chapter) => frame >= chapter.startFrame && frame <= chapter.endFrame) ??
  heroChapters[0];

const JourneyLink = forwardRef<
  HTMLAnchorElement,
  { children: ReactNode; className?: string; href: string }
>(({ children, className, href }, ref) => {
  if (href.startsWith("tel:")) {
    return (
      <a className={className} href={href} ref={ref}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href} ref={ref}>
      {children}
    </Link>
  );
});

JourneyLink.displayName = "JourneyLink";

function ChapterIcon({ id }: { id: HeroChapter["id"] }) {
  const Icon =
    id === "rooms"
      ? BedDouble
      : id === "dining"
        ? Coffee
        : id === "trust"
          ? ShieldCheck
          : id === "booking"
            ? CalendarCheck
            : Sparkles;

  return <Icon className="h-4 w-4" />;
}

function ChapterProgress({ activeChapter }: { activeChapter: HeroChapter }) {
  return (
    <div className="mt-7 border-t border-white/12 pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.24em] text-white/52">
          The D&M Stay Journey
        </p>
        <p className="font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.24em] text-gold-light">
          {activeChapter.label}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {heroChapters.map((chapter) => {
          const active = chapter.id === activeChapter.id;

          return (
            <div key={chapter.id} className="min-w-0">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors duration-500",
                  active ? "bg-gradient-gold" : "bg-white/14",
                )}
              />
              <p
                className={cn(
                  "mt-2 truncate font-[family:var(--font-hero-body)] text-[0.62rem] font-semibold uppercase tracking-[0.12em] transition-colors duration-500",
                  active ? "text-gold-light" : "text-white/42",
                )}
              >
                {chapter.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatingChapterCards({ chapter }: { chapter: HeroChapter }) {
  const featuredChips = chapter.chips.slice(0, chapter.id === "arrival" ? 2 : 4);

  return (
    <motion.div
      key={chapter.id}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      className="pointer-events-none absolute left-[calc(100%+1rem)] top-8 hidden w-[17rem] space-y-3 xl:block"
      initial={{ opacity: 0, x: 10, filter: "blur(5px)" }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
        <div className="rounded-[1.35rem] border border-white/16 bg-[rgba(7,18,32,0.68)] p-4 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-light">
              <ChapterIcon id={chapter.id} />
            </div>
            <div>
              <p className="font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.22em] text-white/52">
                {chapter.label}
              </p>
              <p className="mt-1 font-[family:var(--font-hero-display)] text-lg leading-tight text-white">
                {chapter.detailTitle}
              </p>
            </div>
          </div>
          <p className="mt-4 font-[family:var(--font-hero-body)] text-sm leading-6 text-white/70">
            {chapter.detailMeta}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {featuredChips.map((chip) => (
            <span
              className="rounded-full border border-white/14 bg-white/[0.08] px-3 py-2 font-[family:var(--font-hero-body)] text-[0.72rem] font-medium text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
    </motion.div>
  );
}

function ChapterPanel({ chapter }: { chapter: HeroChapter }) {
  return (
    <div
      className={cn(
        "pointer-events-auto relative w-full max-w-[42rem] rounded-[1.65rem] border border-white/16 bg-[linear-gradient(145deg,rgba(6,17,31,0.86),rgba(9,23,40,0.62))] p-5 shadow-[0_34px_90px_-42px_rgba(0,0,0,0.98)] backdrop-blur-2xl sm:p-6 lg:p-7",
        chapter.id === "booking" ? "border-gold-light/30 bg-[linear-gradient(145deg,rgba(10,23,38,0.9),rgba(36,27,13,0.68))]" : "",
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_34%,rgba(255,210,90,0.07))]" />

      <div className="relative">
        <motion.div
          key={chapter.id}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-light/25 bg-gold/12 text-gold-light">
                <ChapterIcon id={chapter.id} />
              </div>
              <p className="font-[family:var(--font-hero-body)] text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-gold-light sm:text-[0.7rem] sm:tracking-[0.3em]">
                {chapter.eyebrow}
              </p>
            </div>

            <h1 className="mt-5 max-w-[12ch] font-[family:var(--font-hero-display)] text-[clamp(2.45rem,7vw,5.8rem)] font-semibold leading-[0.9] text-white [text-shadow:0_16px_34px_rgba(0,0,0,0.42)] lg:text-[clamp(4.4rem,6.4vw,6.7rem)]">
              {chapter.title}
              <span className="mt-1 block text-gold-light">{chapter.accent}</span>
            </h1>

            <p className="mt-5 max-w-[35rem] font-[family:var(--font-hero-body)] text-[0.98rem] leading-7 text-white/88 sm:text-base">
              {chapter.description}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-full bg-gradient-gold px-6 font-[family:var(--font-hero-body)] text-sm font-semibold text-secondary shadow-[0_20px_48px_-22px_hsl(var(--gold)/0.98)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
              >
                <JourneyLink href={chapter.primaryCta.href}>
                  {chapter.primaryCta.label}
                  <ArrowRight className="h-4 w-4" />
                </JourneyLink>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-white/18 bg-white/[0.08] px-6 font-[family:var(--font-hero-body)] text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors duration-300 hover:bg-white/[0.13] hover:text-white"
              >
                <JourneyLink href={chapter.secondaryCta.href}>
                  {chapter.secondaryCta.href.startsWith("tel:") ? (
                    <PhoneCall className="h-4 w-4 text-gold-light" />
                  ) : null}
                  {chapter.secondaryCta.label}
                </JourneyLink>
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 xl:hidden">
              {chapter.chips.map((chip) => (
                <span
                  className="rounded-full border border-white/14 bg-white/[0.08] px-3 py-2 font-[family:var(--font-hero-body)] text-[0.72rem] font-medium text-white/82"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>

            {chapter.id === "booking" ? (
              <div className="mt-6 rounded-[1.15rem] border border-gold-light/20 bg-gold/10 p-4">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="mt-0.5 h-5 w-5 text-gold-light" />
                  <div>
                    <p className="font-[family:var(--font-hero-body)] text-sm font-semibold text-white">
                      Reserve directly with D&M Travellers Inn.
                    </p>
                    <p className="mt-1 font-[family:var(--font-hero-body)] text-sm leading-6 text-white/70">
                      Check availability, select your room, and finish the booking in the current reservation flow.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
        </motion.div>

        <ChapterProgress activeChapter={chapter} />
      </div>
    </div>
  );
}

function MobileHeroOverlays({ settings }: { settings: Record<string, string> }) {
  const hotelName = settings.hotel_name || "D&M Travellers Inn";
  const hotelAddress = settings.hotel_address?.split(",")?.[0]?.trim() || "Looc Proper";
  const arrivalChapter = heroChapters[0];

  return (
    <div className="flex h-full flex-col justify-end px-4 pb-5 pt-[6rem] sm:px-6 sm:pb-6 lg:hidden">
      <div className="pointer-events-auto rounded-[1.45rem] border border-white/16 bg-[rgba(5,16,30,0.78)] p-5 shadow-[0_30px_70px_-38px_rgba(0,0,0,0.98)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 text-gold-light" />
          <p className="font-[family:var(--font-hero-body)] text-[0.62rem] uppercase tracking-[0.22em] text-gold-light">
            {hotelName} / {hotelAddress}
          </p>
        </div>

        <h1 className="mt-4 max-w-[10ch] font-[family:var(--font-hero-display)] text-[clamp(2.25rem,12vw,3.65rem)] font-semibold leading-[0.92] text-white [text-shadow:0_12px_28px_rgba(0,0,0,0.48)]">
          {arrivalChapter.title}
          <span className="mt-1 block text-gold-light">{arrivalChapter.accent}</span>
        </h1>
        <p className="mt-4 max-w-[22rem] font-[family:var(--font-hero-body)] text-sm leading-6 text-white/88 sm:text-base sm:leading-7">
          {arrivalChapter.description}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            className="h-12 rounded-full bg-gradient-gold px-5 font-[family:var(--font-hero-body)] text-sm font-semibold text-secondary"
          >
            <Link href="/booking">
              Book Your Stay
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-full border-white/18 bg-white/[0.08] px-5 font-[family:var(--font-hero-body)] text-sm font-medium text-white hover:bg-white/[0.13] hover:text-white"
          >
            <Link href="/rooms">View Rooms</Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Restaurant", href: "/restaurant" },
            { label: "Contact", href: "/contact" },
            { label: "Call", href: "tel:+639518683018" },
          ].map((item) => (
            <JourneyLink
              className="rounded-full border border-white/12 bg-white/[0.07] px-2 py-2 text-center font-[family:var(--font-hero-body)] text-[0.72rem] font-medium text-white/82"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </JourneyLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopHeroOverlays({
  activeChapter,
  scrollYProgress,
}: {
  activeChapter: HeroChapter;
  scrollYProgress: MotionValue<number>;
}) {
  const reduceMotion = useReducedMotion();
  const panelY = useTransform(scrollYProgress, [0, 1], [0, 18]);
  const panelOpacity = useTransform(scrollYProgress, [0, 0.96, 1], [1, 1, 0.98]);

  return (
    <div className="hidden h-full px-4 pb-8 pt-28 sm:px-6 lg:block lg:px-10 lg:pb-10 lg:pt-32">
      <motion.div
        className="absolute left-6 top-[7.4rem] max-w-[min(58vw,42rem)] xl:left-10 xl:top-[8.2rem]"
        style={reduceMotion ? undefined : { opacity: panelOpacity, y: panelY }}
      >
        <ChapterPanel chapter={activeChapter} />
        <FloatingChapterCards chapter={activeChapter} />

        {activeChapter.id === "arrival" ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 font-[family:var(--font-hero-body)] text-xs font-medium uppercase tracking-[0.2em] text-white/62 backdrop-blur-xl"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold-light" />
            Scroll the stay journey
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  );
}

export default function HeroTextOverlays({
  className,
  scrollYProgress,
}: HeroTextOverlaysProps) {
  const reduceMotion = useReducedMotion();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeChapter, setActiveChapter] = useState<HeroChapter>(heroChapters[0]);
  const activeChapterIdRef = useRef<HeroChapter["id"]>(heroChapters[0].id);

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

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (reduceMotion) {
      return;
    }

    const nextChapter = getChapterByFrame(progressToFrame(latest));
    if (activeChapterIdRef.current !== nextChapter.id) {
      activeChapterIdRef.current = nextChapter.id;
      setActiveChapter(nextChapter);
    }
  });

  const presentedChapter = useMemo(
    () => (reduceMotion ? heroChapters[0] : activeChapter),
    [activeChapter, reduceMotion],
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 mx-auto h-full max-w-[1600px]",
        className,
      )}
    >
      <MobileHeroOverlays settings={settings} />
      <DesktopHeroOverlays
        activeChapter={presentedChapter}
        scrollYProgress={scrollYProgress}
      />
    </div>
  );
}
