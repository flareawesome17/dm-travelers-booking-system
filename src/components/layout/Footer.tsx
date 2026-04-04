"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, PhoneCall } from "lucide-react";

const quickLinks = [
  { label: "Rooms & Suites", href: "/rooms" },
  { label: "Restaurant", href: "/restaurant" },
  { label: "Guest Reviews", href: "/reviews" },
  { label: "Contact", href: "/contact" },
];

const DEFAULTS = {
  hotel_name: "D&M Travellers Inn",
  hotel_address: "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, Misamis Occidental",
  hotel_phone: "+63 951 868 3018",
  hotel_email: "info@dmtravelersinn.com",
};

export default function Footer() {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULTS);

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

  const hotelName = settings.hotel_name || DEFAULTS.hotel_name;
  const address = settings.hotel_address || DEFAULTS.hotel_address;
  const phone = settings.hotel_phone || DEFAULTS.hotel_phone;
  const email = settings.hotel_email || DEFAULTS.hotel_email;
  const facebookUrl = settings.facebook_url || "";
  const instagramUrl = settings.instagram_url || "";

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
              {hotelName}
            </p>
            <h2 className="mt-4 font-heading text-[clamp(2.1rem,8vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
              A warmer standard for stays in Plaridel.
            </h2>
            <p className="mt-5 font-body text-sm leading-7 text-white/78 sm:text-base">
              Designed for business trips, family stopovers, and restful getaways,
              {hotelName} pairs dependable comfort with a polished,
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
                <span>{address}</span>
              </div>
              <a
                className="flex items-center gap-3 transition-colors duration-300 hover:text-white"
                href={`tel:${phone.replace(/\s/g, "")}`}
              >
                <PhoneCall className="h-4 w-4 text-gold-light" />
                {phone}
              </a>
              <a
                className="flex items-center gap-3 transition-colors duration-300 hover:text-white"
                href={`mailto:${email}`}
              >
                <Mail className="h-4 w-4 text-gold-light" />
                {email}
              </a>
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 text-gold-light" />
                24/7 front desk service
              </div>
            </div>

            {/* Social Links */}
            {(facebookUrl || instagramUrl) && (
              <div className="mt-6 flex items-center gap-3">
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                    aria-label="Facebook"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                    aria-label="Instagram"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.338 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 font-body text-xs uppercase tracking-[0.18em] text-white/56 md:flex-row sm:tracking-[0.22em]">
          <div className="text-center md:text-left">
            (c) {new Date().getFullYear()} {hotelName}. All rights reserved.
          </div>
          <div className="text-center md:text-right text-[0.65rem] sm:text-xs text-white/40">
            Crafted with precision by{" "}
            <a
              href="https://www.erniecodev.win"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/70 transition-colors hover:text-gold-light"
            >
              Erniecodev
            </a>
            {" "}Software Solutions
          </div>
        </div>
      </div>
    </footer>
  );
}
