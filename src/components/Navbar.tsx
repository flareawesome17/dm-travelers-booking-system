"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Menu, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Rooms", href: "/rooms" },
  { label: "Restaurant", href: "/restaurant" },
  { label: "Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
];

const navDisplayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-nav-display",
  weight: ["600", "700"],
});

const navBodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-nav-body",
  weight: ["400", "500", "600", "700"],
});

const isActivePath = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function Navbar() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(pathname !== "/");
  const [settings, setSettings] = useState<Record<string, string>>({
    hotel_name: "D&M Travelers Inn",
    hotel_phone: "+63 951 868 3018",
  });

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(pathname !== "/" || latest > 18);
  });

  useEffect(() => {
    fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setIsScrolled(pathname !== "/");
  }, [pathname]);

  const hotelName = settings.hotel_name || "D&M Travelers Inn";
  const hotelPhone = settings.hotel_phone || "+63 951 868 3018";


  const surfaceSolid = isScrolled || menuOpen || pathname !== "/";

  return (
    <motion.header
      className={cn(
        navDisplayFont.variable,
        navBodyFont.variable,
        "fixed inset-x-0 top-0 z-50 px-2 py-2 sm:px-4 sm:py-3 lg:px-6",
      )}
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto max-w-[1600px]">
        <div
          className={cn(
            "relative overflow-hidden rounded-[1.8rem] border transition-all duration-500 sm:rounded-full",
            surfaceSolid
              ? "border-white/12 bg-secondary/75 shadow-[0_24px_60px_-34px_rgba(4,14,29,0.95)] backdrop-blur-2xl"
              : "border-white/10 bg-secondary/18 shadow-[0_16px_48px_-32px_rgba(4,14,29,0.92)] backdrop-blur-xl",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),transparent_36%,transparent_70%,rgba(255,214,102,0.1))]" />

          <div className="relative flex h-[4.25rem] items-center justify-between gap-3 px-3 sm:h-[4.5rem] sm:px-5 lg:px-8">
            <Link
              href="/"
              className="min-w-0 flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/12 bg-white/10 p-1">
                <img
                  alt={`${hotelName} logo`}
                  className="object-contain w-full h-full"
                  src={settings.hotel_logo || "/logo.png"}
                />
              </div>

              <div className="min-w-0">
                <p className="truncate font-[family:var(--font-nav-display)] text-[1.05rem] leading-tight text-white sm:text-[1.22rem] lg:text-[1.35rem]">
                  {hotelName}
                </p>
                <p className="hidden truncate pt-0.5 font-[family:var(--font-nav-body)] text-[0.65rem] uppercase tracking-[0.25em] text-gold-light sm:block">
                  <span className="xl:hidden">Warm hospitality</span>
                  <span className="hidden xl:inline">Premium hospitality, warmly delivered</span>
                </p>
              </div>
            </Link>

            <nav className="hidden shrink-0 items-center gap-2 xl:flex">
              {navLinks.map((link) => {
                const active = isActivePath(pathname, link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-[family:var(--font-nav-body)] text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-secondary",
                      active
                        ? "bg-gradient-gold text-secondary shadow-[0_14px_32px_-18px_hsl(var(--gold)/0.95)]"
                        : "text-white hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden shrink-0 items-center gap-3 xl:flex">
              <a
                href={`tel:${hotelPhone.replace(/\s/g, "")}`}
                className="inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 font-[family:var(--font-nav-body)] text-sm text-white/88 transition-colors duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
              >
                <PhoneCall className="h-4 w-4 text-gold-light" />
                {hotelPhone}
              </a>

              <Button
                asChild
                className="h-11 shrink-0 whitespace-nowrap rounded-full bg-gradient-gold px-5 font-[family:var(--font-nav-body)] text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95"
              >
                <Link href="/booking">
                  Book Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white transition-colors duration-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-secondary sm:h-11 sm:w-11 xl:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 mt-3 overflow-hidden rounded-[1.7rem] border border-white/20 bg-[radial-gradient(circle_at_top,rgba(28,61,108,0.16),transparent_36%),linear-gradient(180deg,rgba(8,20,36,0.98),rgba(10,24,43,0.98))] shadow-[0_32px_70px_-36px_rgba(4,14,29,0.98)] backdrop-blur-2xl sm:rounded-[2rem] xl:hidden"
              exit={{ opacity: 0, y: -12 }}
              initial={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <nav className="grid gap-3 p-4">
                {navLinks.map((link) => {
                  const active = isActivePath(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      className={cn(
                        "block rounded-2xl border px-4 py-3 font-[family:var(--font-nav-body)] text-base transition-colors duration-300",
                        active
                          ? "border-gold-light/60 bg-gradient-gold text-secondary shadow-[0_16px_36px_-20px_hsl(var(--gold)/0.95)]"
                          : "border-white/18 bg-white/[0.08] text-white hover:border-white/28 hover:bg-white/[0.12] hover:text-white",
                      )}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                <a
                  className="mt-1 flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-3 font-[family:var(--font-nav-body)] text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-300 hover:border-white/28 hover:bg-white/[0.12]"
                  href={`tel:${hotelPhone.replace(/\s/g, "")}`}
                >
                  <PhoneCall className="h-4 w-4 text-gold-light" />
                  Call the front desk
                </a>

                <Button
                  asChild
                  className="mt-3 h-12 w-full rounded-full bg-gradient-gold font-[family:var(--font-nav-body)] text-sm font-semibold text-secondary"
                >
                  <Link href="/booking" onClick={() => setMenuOpen(false)}>
                    Book Your Stay
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
