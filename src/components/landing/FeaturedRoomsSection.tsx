"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { Users, Maximize, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const roomStandard = "/images/room-standard.jpg";
const roomDeluxe = "/images/room-deluxe.jpg";
const roomSuite = "/images/room-suite.jpg";

const rooms = [
  {
    name: "Standard Room",
    image: roomStandard,
    price: 1500,
    guests: 2,
    size: "22 sqm",
    desc: "Cozy comfort with all the essentials for a relaxing stay.",
  },
  {
    name: "Deluxe Room",
    image: roomDeluxe,
    price: 2500,
    guests: 2,
    size: "30 sqm",
    desc: "Spacious elegance with premium furnishings and garden views.",
  },
  {
    name: "Executive Suite",
    image: roomSuite,
    price: 4500,
    guests: 4,
    size: "50 sqm",
    desc: "Luxury suite with living area and panoramic tropical views.",
  },
];

const FeaturedRoomsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Accommodations</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">Featured Rooms</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {rooms.map((room, i) => (
            <motion.div
              key={room.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="bg-card rounded-xl overflow-hidden shadow-soft group"
            >
              <div className="relative overflow-hidden aspect-[4/3]">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  ₱{room.price.toLocaleString()}/night
                </div>
              </div>
              <div className="p-5 lg:p-6">
                <h3 className="font-heading text-xl font-bold text-foreground mb-2">{room.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{room.desc}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {room.guests} Guests</span>
                  <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {room.size}</span>
                </div>
                <Link href="/booking">
                  <Button variant="outline" className="w-full group/btn border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Book Now <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/rooms">
            <Button variant="ghost" className="text-primary hover:text-primary/80 font-medium">
              View All Rooms <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedRoomsSection;
