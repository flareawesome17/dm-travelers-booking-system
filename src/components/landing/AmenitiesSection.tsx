"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Wifi, Car, UtensilsCrossed, Waves, ShieldCheck, Clock, Sparkles, MapPin, Scissors } from "lucide-react";

const amenities = [
  { icon: Wifi, title: "Free Wi-Fi", desc: "High-speed internet throughout" },
  { icon: Car, title: "Free Parking", desc: "Secure on-site parking" },
  { icon: UtensilsCrossed, title: "Restaurant", desc: "Filipino & international cuisine" },
  { icon: Scissors, title: "Salon", desc: "Professional salon services available" },
  { icon: ShieldCheck, title: "24/7 Security", desc: "CCTV & security staff" },
  { icon: Clock, title: "Front Desk", desc: "Round-the-clock service" },
  { icon: Sparkles, title: "Housekeeping", desc: "Daily room cleaning" },
  { icon: MapPin, title: "Prime Location", desc: "Near Plaridel attractions" },
];

const AmenitiesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">What We Offer</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">Hotel Amenities</h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {amenities.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-card rounded-xl p-5 lg:p-6 text-center group hover:shadow-soft transition-shadow duration-300"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-sm lg:text-base font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AmenitiesSection;
