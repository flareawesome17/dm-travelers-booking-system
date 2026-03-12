"use client";

import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div>
            <h3 className="font-heading text-xl font-bold text-primary mb-4">
              D&amp;M Travelers Inn
            </h3>
            <p className="text-secondary-foreground/70 text-sm leading-relaxed">
              Your home away from home in Plaridel, Misamis Occidental. Experience warm Filipino hospitality with modern comfort.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Rooms & Suites", path: "/rooms" },
                { label: "Restaurant", path: "/restaurant" },
                { label: "Book Now", path: "/booking" },
                { label: "Guest Reviews", path: "/reviews" },
                { label: "Contact Us", path: "/contact" },
              ].map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className="text-secondary-foreground/70 hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-semibold mb-4">Contact Info</h4>
            <ul className="space-y-3 text-sm text-secondary-foreground/70">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, 7209 Misamis Occidental, Philippines
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                +63 951 868 3018
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                dmsupport@erniecodev.win
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                24/7 Front Desk
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-semibold mb-4">Newsletter</h4>
            <p className="text-sm text-secondary-foreground/70 mb-3">Get exclusive deals and travel tips.</p>
            <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="px-3 py-2 bg-secondary-foreground/10 rounded-md text-sm text-secondary-foreground placeholder:text-secondary-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-gold text-secondary font-semibold rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/10 mt-10 pt-6 text-center text-xs text-secondary-foreground/50">
          © {new Date().getFullYear()} D&amp;M Travelers Inn. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
