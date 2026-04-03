"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, PhoneCall } from "lucide-react";

const quickLinks = [
  { label: "Rooms & Suites", href: "/rooms" },
  { label: "Restaurant", href: "/restaurant" },
  { label: "Guest Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[linear-gradient(180deg,#081220_0%,#07111d_100%)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-10 h-64 w-64 rounded-full bg-gold/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="max-w-xl">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-gold-light/86 sm:tracking-[0.38em]">
              D&amp;M Travelers Inn
            </p>
            <h2 className="mt-4 font-heading text-[clamp(2.1rem,8vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
              A warmer standard for stays in Plaridel.
            </h2>
            <p className="mt-5 font-body text-sm leading-7 text-white/78 sm:text-base">
              Designed for business trips, family stopovers, and restful getaways,
              D&amp;M Travelers Inn pairs dependable comfort with a polished,
              welcoming atmosphere.
            </p>

            <Link
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/6 px-5 py-3 font-body text-sm font-medium text-white transition-colors duration-300 hover:bg-white/10"
              href="/booking"
            >
              Reserve your stay
              <ArrowRight className="h-4 w-4 text-gold-light" />
            </Link>
          </div>

          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.36em] text-gold-light/78">
              Explore
            </p>
            <div className="mt-5 space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  className="block rounded-full px-4 py-3 font-body text-sm text-white/82 transition-colors duration-300 hover:bg-white/6 hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.36em] text-gold-light/78">
              Contact
            </p>
            <div className="mt-5 space-y-4 font-body text-sm text-white/80">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-gold-light" />
                <span>
                  Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, Misamis Occidental
                </span>
              </div>
              <a
                className="flex items-center gap-3 transition-colors duration-300 hover:text-white"
                href="tel:+639518683018"
              >
                <PhoneCall className="h-4 w-4 text-gold-light" />
                +63 951 868 3018
              </a>
              <a
                className="flex items-center gap-3 transition-colors duration-300 hover:text-white"
                href="mailto:info@dmtravelersinn.com"
              >
                <Mail className="h-4 w-4 text-gold-light" />
                info@dmtravelersinn.com
              </a>
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-gold-light" />
                24/7 front desk service
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 font-body text-xs uppercase tracking-[0.18em] text-white/56 sm:tracking-[0.22em]">
          (c) {new Date().getFullYear()} D&amp;M Travelers Inn. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
