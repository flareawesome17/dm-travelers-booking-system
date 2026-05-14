"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Soup, Sparkles, UtensilsCrossed } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { PublicAssetImage } from "@/components/public/PublicAssetImage";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";
import { publicAssets } from "@/lib/public-assets";

type MenuItem = {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  category?: string | null;
  image_url?: string | null;
  discount?: {
    name: string;
    type: string;
    value: number;
    amount: number;
  } | null;
};

export default function RestaurantPage() {
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-120px" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/public/menu")
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          throw new Error(json?.error || "Failed to load menu.");
        }

        if (!cancelled) {
          setItems(Array.isArray(json) ? json : []);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Failed to load menu.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Set<string>();

    items.forEach((item) => {
      const category = typeof item.category === "string" ? item.category.trim() : "";
      if (category) {
        unique.add(category);
      }
    });

    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "All") {
      return items;
    }

    return items.filter((item) => String(item.category || "") === filter);
  }, [filter, items]);

  return (
    <>
      <PublicPageHero
        description="Browse our selection of thoughtfully prepared meals, crafted to suit guests looking for warm, satisfying dining options during their stay."
        eyebrow="Restaurant"
        imageAlt="Dining at D&M Travellers Inn"
        imageSrc={publicAssets.restaurant}
        stats={[
          { label: "Dining style", value: "Warm and familiar" },
          { label: "Menu flow", value: "Category-led" },
          { label: "Guest mood", value: "Comfortable" },
        ]}
        title="Dining that extends the welcome beyond the room."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: UtensilsCrossed, title: "Guest-ready meals" },
            { icon: ChefHat, title: "Thoughtful preparation" },
            { icon: Soup, title: "Local and familiar flavors" },
          ].map((item) => (
            <PublicGlassPanel key={item.title} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
                <item.icon className="h-4 w-4 text-gold-light" />
              </div>
              <span className="font-body text-sm text-white/76">{item.title}</span>
            </PublicGlassPanel>
          ))}
        </div>
      </PublicPageHero>

      <PublicSection tone="ink" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div ref={ref}>
            <div className="flex flex-wrap gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
                ))
              ) : categories.length > 1 ? (
                categories.map((category) => (
                  <button
                    key={category}
                    className={
                      filter === category
                        ? "rounded-full border border-gold-light/30 bg-gradient-gold px-5 py-3 font-body text-sm font-semibold text-secondary"
                        : "rounded-full border border-white/14 bg-white/8 px-5 py-3 font-body text-sm text-white/88 transition-colors duration-300 hover:bg-white/10 hover:text-white"
                    }
                    onClick={() => setFilter(category)}
                    type="button"
                  >
                    {category}
                  </button>
                ))
              ) : null}
            </div>

            <div className="mt-10 min-h-[400px]">
              {loading ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <PublicGlassPanel key={index} className="overflow-hidden p-0">
                      <div className="aspect-[4/4.2] animate-pulse bg-white/6" />
                    </PublicGlassPanel>
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                    <UtensilsCrossed className="h-8 w-8 text-white/20" />
                  </div>
                  <h3 className="mb-2 font-heading text-xl text-white">No items found</h3>
                  <p className="mx-auto max-w-xs font-body text-white/60">
                    Our menu is currently being updated. Please check back soon!
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      initial={{ opacity: 0, y: 24 }}
                      transition={{ duration: 0.5, delay: index * 0.04 }}
                    >
                      <PublicGlassPanel className="group h-full overflow-hidden p-0">
                        <div className="relative aspect-[4/2.6]">
                          <PublicAssetImage
                            alt={item.name || "Menu item"}
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            fallbackSrc={publicAssets.restaurant}
                            fill
                            sizes="(max-width: 1280px) 100vw, 33vw"
                            src={item.image_url}
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,rgba(5,14,27,0.86)_100%)]" />
                          <div className="absolute left-5 top-5 rounded-full border border-white/14 bg-secondary/68 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-gold-light/84 backdrop-blur-md">
                            {item.category || "Menu"}
                          </div>
                        </div>

                        <div className="p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="font-heading text-2xl font-semibold text-white">
                                {item.name || "Menu item"}
                              </h2>
                              <p className="mt-3 font-body text-sm leading-7 text-white/78">
                                {item.description || "Prepared to suit guests looking for warm, satisfying dining options."}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {item.discount && (
                                <span className="text-[10px] text-white/40 line-through font-medium">
                                  PHP {Number(item.original_price).toLocaleString()}
                                </span>
                              )}
                              <div className="shrink-0 rounded-full bg-gradient-gold px-3 py-1 text-sm font-semibold text-secondary relative group/price">
                                PHP {Number(item.price || 0).toLocaleString()}
                                {item.discount && (
                                  <div className="absolute -top-8 right-0 bg-gold-light text-secondary text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover/price:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                                    {item.discount.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-white/62 sm:tracking-[0.28em]">
                            <Sparkles className="h-3.5 w-3.5 text-gold-light" />
                            Refined presentation
                          </div>
                        </div>
                      </PublicGlassPanel>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PublicGrid>
      </PublicSection>
    </>
  );
}
