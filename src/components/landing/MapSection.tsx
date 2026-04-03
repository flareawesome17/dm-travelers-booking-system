"use client";

import { motion, useInView } from "framer-motion";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicSection,
  PublicSectionIntro,
} from "@/components/public/PublicPrimitives";

export default function MapSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });
  const [settings, setSettings] = useState<Record<string, string>>({
    hotel_name: "D&M Travelers Inn",
    hotel_address: "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, 7209 Misamis Occidental, Philippines",
  });

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  const hotelName = settings.hotel_name || "D&M Travelers Inn";
  const hotelAddress = settings.hotel_address || "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, 7209 Misamis Occidental, Philippines";


  return (
    <PublicSection tone="deep-soft" className="py-16 lg:py-24">
      <PublicGrid>
        <div ref={ref}>
          <motion.div
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.65 }}
            className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"
          >
            <PublicSectionIntro
              eyebrow="Location"
              title="Positioned for easy arrivals in Plaridel."
              description="Guests can reach the property conveniently from the main road, making the inn a practical base for overnight stays, local travel, and business movement."
            />

            <PublicGlassPanel className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  Setting
                </p>
                <p className="mt-2 font-heading text-2xl text-white">Looc Proper</p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  Access
                </p>
                <p className="mt-2 font-heading text-2xl text-white">Main road frontage</p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  Guest fit
                </p>
                <p className="mt-2 font-heading text-2xl text-white">Leisure and business</p>
              </div>
            </PublicGlassPanel>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <motion.div
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.65, delay: 0.08 }}
            >
              <PublicGlassPanel className="h-[26rem] overflow-hidden p-0">
                <iframe
                  allowFullScreen
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3944.8595754630787!2d123.71979897568883!3d8.609477995413382!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x325495c8a9c5efe3%3A0xf917895811e58050!2sD%26M%20Travellers%20Inn!5e0!3m2!1sen!2sph!4v1775187551578!5m2!1sen!2sph"
                  style={{ border: 0 }}
                  title={`${hotelName} location`}
                />
              </PublicGlassPanel>
            </motion.div>

            <motion.div
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.65, delay: 0.14 }}
              className="grid gap-4"
            >
              <PublicGlassPanel>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 text-gold-light" />
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                      Address
                    </p>
                    <p className="mt-3 font-body text-sm leading-7 text-white/82">
                      {hotelAddress}
                    </p>
                  </div>
                </div>
              </PublicGlassPanel>

              <PublicGlassPanel>
                <div className="flex items-start gap-3">
                  <Navigation className="mt-1 h-5 w-5 text-gold-light" />
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                      Direction note
                    </p>
                    <p className="mt-3 font-body text-sm leading-7 text-white/82">
                      Positioned along the Dipolog-Oroquieta National Road for easy
                      roadside access and convenient guest movement.
                    </p>
                  </div>
                </div>
              </PublicGlassPanel>

              <PublicGlassPanel>
                <div className="flex items-start gap-3">
                  <LocateFixed className="mt-1 h-5 w-5 text-gold-light" />
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                      Nearby context
                    </p>
                    <p className="mt-3 font-body text-sm leading-7 text-white/82">
                      Well suited for travelers moving through Plaridel and nearby
                      destinations including Baobawon Island access points.
                    </p>
                  </div>
                </div>
              </PublicGlassPanel>
            </motion.div>
          </div>
        </div>
      </PublicGrid>
    </PublicSection>
  );
}
