import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const existingReviews = [
  { name: "Maria Santos", location: "Manila", rating: 5, text: "Absolutely wonderful stay! The staff went above and beyond. Will definitely come back!", date: "2025-12-15" },
  { name: "James Lee", location: "Singapore", rating: 5, text: "Best value hotel in Davao. Clean rooms, excellent restaurant, and the pool is great.", date: "2025-11-28" },
  { name: "Ana Reyes", location: "Cebu", rating: 4, text: "Great location near SM Lanang. Breakfast buffet was impressive and staff are very accommodating.", date: "2025-11-10" },
  { name: "David Kim", location: "Seoul", rating: 5, text: "The executive suite exceeded my expectations. Beautiful views and impeccable service throughout our stay.", date: "2025-10-22" },
  { name: "Sofia Garcia", location: "Davao", rating: 4, text: "Perfect for a staycation! Love the pool area and the restaurant food is authentic Filipino flavors.", date: "2025-10-05" },
  { name: "Michael Torres", location: "CDO", rating: 5, text: "Professional staff and well-maintained facilities. The location is very convenient for business travelers.", date: "2025-09-18" },
];

const Reviews = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [showForm, setShowForm] = useState(false);

  const avgRating = (existingReviews.reduce((s, r) => s + r.rating, 0) / existingReviews.length).toFixed(1);

  return (
    <>
      <Navbar />
      <main className="pt-20">
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
              <span className="text-primary-foreground font-bold text-xl">{avgRating}</span>
              <span className="text-secondary-foreground/60 text-sm">({existingReviews.length} reviews)</span>
            </motion.div>
          </div>
        </section>

        <section ref={ref} className="py-12 lg:py-20 bg-background">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-8">
              <Button onClick={() => setShowForm(!showForm)} className="bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90">
                {showForm ? "Close" : "Write a Review"}
              </Button>
            </div>

            {showForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-card rounded-xl p-6 shadow-soft mb-10"
                onSubmit={(e) => { e.preventDefault(); setShowForm(false); }}
              >
                <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Share Your Experience</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input placeholder="Your name" className="px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                  <select className="px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Rating</option>
                    <option value="5">★★★★★ Excellent</option>
                    <option value="4">★★★★ Very Good</option>
                    <option value="3">★★★ Good</option>
                    <option value="2">★★ Fair</option>
                    <option value="1">★ Poor</option>
                  </select>
                </div>
                <textarea placeholder="Tell us about your stay..." rows={4} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none" required />
                <Button type="submit" className="bg-gradient-gold text-secondary font-semibold hover:opacity-90">Submit Review</Button>
              </motion.form>
            )}

            <div className="space-y-4">
              {existingReviews.map((review, i) => (
                <motion.div
                  key={review.name}
                  initial={{ opacity: 0, y: 15 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="bg-card rounded-xl p-5 lg:p-6 shadow-soft"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{review.name}</p>
                      <p className="text-xs text-muted-foreground">{review.location}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star key={si} className={`w-3.5 h-3.5 ${si < review.rating ? "fill-primary text-primary" : "text-muted"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 italic">"{review.text}"</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Reviews;
