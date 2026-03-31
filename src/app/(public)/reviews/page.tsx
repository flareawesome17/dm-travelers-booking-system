"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

export default function ReviewsPage() {
  return (
    <div className="pt-20">
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl lg:text-5xl font-bold text-primary-foreground mb-3">
            Guest Reviews
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-primary text-primary" />
              ))}
            </div>
            <span className="text-secondary-foreground/60 text-sm">No reviews yet</span>
          </motion.div>
        </div>
      </section>

      <section className="py-12 lg:py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="bg-card rounded-xl p-10 shadow-soft">
            <Star className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">No Reviews Yet</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;re just getting started. Check back soon to read what our guests have to say about their stay at D&amp;M Travelers Inn.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
