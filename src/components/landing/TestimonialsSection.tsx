"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const TestimonialsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-muted/50">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Testimonials</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground mb-4">What Our Guests Say</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            We value honest feedback from our guests. Be the first to share your experience at D&amp;M Travelers Inn.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/reviews">
            <Button className="bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90">
              Read Guest Reviews <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
