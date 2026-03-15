"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "@/components/ui/sonner";

type MenuItem = {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  category?: string | null;
  image_url?: string | null;
};

export default function RestaurantPage() {
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/public/menu")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j?.error || "Failed to load menu.");
        if (!cancelled) setItems(Array.isArray(j) ? j : []);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load menu."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const uniq = new Set<string>();
    for (const i of items) {
      const c = typeof i.category === "string" ? i.category.trim() : "";
      if (c) uniq.add(c);
    }
    return ["All", ...Array.from(uniq).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((m) => String(m.category || "") === filter);
  }, [filter, items]);

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="relative h-64 lg:h-80 overflow-hidden">
        <Image
          src="/images/restaurant.jpg"
          alt="D&M Travelers Inn Restaurant"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-hero flex items-center justify-center">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-heading text-3xl lg:text-5xl font-bold mb-2"
              style={{ color: "hsl(40, 33%, 98%)" }}
            >
              Our Restaurant
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ color: "hsl(40, 15%, 75%)" }}
            >
              Authentic Filipino cuisine &amp; international favorites
            </motion.p>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section ref={ref} className="py-12 lg:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === cat ? "bg-primary text-primary-foreground shadow-gold" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center text-sm text-muted-foreground">Loading menu...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center text-sm text-muted-foreground">No items available.</div>
            ) : (
              filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="bg-card rounded-xl p-5 flex justify-between items-start shadow-soft hover:shadow-elevated transition-shadow"
                >
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground mb-1">{item.name ?? "—"}</h3>
                    <p className="text-xs text-muted-foreground mb-1.5">{item.description ?? ""}</p>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{item.category ?? "Other"}</span>
                  </div>
                  <span className="text-primary font-bold text-lg ml-4 flex-shrink-0">₱{Number(item.price || 0)}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
