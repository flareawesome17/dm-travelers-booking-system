"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const restaurantImg = "/images/restaurant.jpg";

const RestaurantPreview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="order-2 lg:order-1"
          >
            <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Dining</p>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Savor Authentic Flavors
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Our on-site restaurant serves a curated selection of Filipino favorites and international dishes. 
              From hearty breakfast buffets to candlelit dinners, every meal is crafted with fresh, local ingredients.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {["Breakfast", "Lunch", "Dinner", "Drinks"].map((cat) => (
                <div key={cat} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {cat}
                </div>
              ))}
            </div>
            <Link href="/restaurant">
              <Button className="bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90">
                View Full Menu <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="order-1 lg:order-2"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-elevated">
              <img src={restaurantImg} alt="D&M Travelers Inn Restaurant" className="w-full h-64 lg:h-96 object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/40 to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default RestaurantPreview;
