import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-hotel.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroImage} alt="D&M Travelers Inn - Luxury boutique hotel in Davao City" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-hero" />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-gold-light text-sm uppercase tracking-[0.2em] font-body font-medium mb-4"
          >
            Welcome to Davao's Finest
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="font-heading text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-6"
            style={{ color: "hsl(40, 33%, 98%)" }}
          >
            Your Tropical
            <br />
            <span className="text-gradient-gold">Escape Awaits</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg md:text-xl mb-10 max-w-xl leading-relaxed"
            style={{ color: "hsl(40, 15%, 80%)" }}
          >
            Experience warm Filipino hospitality at D&M Travelers Inn. Affordable luxury in the heart of Davao City.
          </motion.p>

          {/* Quick Booking Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-background/95 backdrop-blur-sm rounded-xl p-4 md:p-6 shadow-elevated max-w-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Check-in
                </label>
                <input type="date" className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Check-out
                </label>
                <input type="date" className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Guests
                </label>
                <select className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>1 Guest</option>
                  <option>2 Guests</option>
                  <option>3 Guests</option>
                  <option>4+ Guests</option>
                </select>
              </div>
            </div>
            <Link to="/rooms">
              <Button className="w-full mt-4 bg-gradient-gold text-secondary font-semibold h-11 shadow-gold hover:opacity-90 transition-opacity">
                Check Availability
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-6 h-10 border-2 rounded-full flex justify-center pt-2"
          style={{ borderColor: "hsl(40, 15%, 70%)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
