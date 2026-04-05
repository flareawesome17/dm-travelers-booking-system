"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star, Send, Loader2, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  guest_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    reference_number: "",
    guest_name: "",
    rating: 5,
    comment: "",
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/public/reviews");
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to submit review");

      toast.success("Review submitted! It will appear once approved by our team.");
      setShowForm(false);
      setFormData({ reference_number: "", guest_name: "", rating: 5, comment: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PublicPageHero
        description="Read what our guests have to say about their stay at D&M Travellers Inn. We take pride in providing a comfortable and memorable experience for every traveler."
        eyebrow="Guest Experience"
        imageAlt="Guest review experience at D&M Travellers Inn"
        imageSrc="/images/hero-hotel.jpg"
        stats={[
          { label: "Rating", value: "4.8/5" },
          { label: "Service", value: "Exemplary" },
          { label: "Community", value: "Verified" },
        ]}
        title="Your comfort is our greatest reward."
      />

      <PublicSection tone="mist" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <h2 className="font-heading text-4xl lg:text-5xl font-semibold text-white mb-4">
                Guest Stories
              </h2>
              <p className="font-body text-white/70 text-lg leading-relaxed">
                Authentic feedback from travelers across the globe who have called D&M their home away from home.
              </p>
            </div>
            
            <Button
              onClick={() => setShowForm(true)}
              className="h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 font-body shadow-lg backdrop-blur-md transition-all active:scale-95"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2 text-gold-light" />
              Write a Review
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-3xl bg-white/5 animate-pulse border border-white/10" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <PublicGlassPanel className="py-20 text-center">
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Star className="h-8 w-8 text-white/20" />
                </div>
                <h3 className="text-2xl font-heading text-white mb-2">No reviews yet</h3>
                <p className="text-white/60 max-w-sm mx-auto">
                  Be the first to share your experience with us! Click the "Write a Review" button above to get started.
                </p>
              </div>
            </PublicGlassPanel>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, idx) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <PublicGlassPanel className="h-full flex flex-col justify-between group hover:bg-white/5 transition-colors duration-500">
                    <div>
                      <div className="flex items-center gap-1 text-gold-light mb-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn(
                              "h-4 w-4",
                              i < review.rating ? "fill-current" : "text-white/20"
                            )} 
                          />
                        ))}
                      </div>
                      
                      <p className="font-body text-white/90 leading-relaxed mb-6 italic">
                        "{review.comment || "Amazing stay! The staff were very accommodating."}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-gold-light font-bold text-xs">
                          {(review.guest_name?.[0] || "G").toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white/80">{review.guest_name}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-white/40">
                        {format(new Date(review.created_at), "MMM yyyy")}
                      </span>
                    </div>
                  </PublicGlassPanel>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-16 flex justify-center">
            <Button
              asChild
              className="h-12 rounded-full bg-gradient-gold px-8 font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95"
            >
              <Link href="/booking">
                Book your stay
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </PublicGrid>
      </PublicSection>

      {/* Review Submission Modal overlay */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setShowForm(false)}
              className="absolute inset-0 bg-secondary/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-secondary border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-br from-white/10 to-transparent p-8 sm:p-12">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-heading font-semibold text-white mb-2">Share Your Story</h3>
                    <p className="text-white/60 text-sm">Tell us about your recent experience at D&M</p>
                  </div>
                  <button 
                    onClick={() => setShowForm(false)}
                    className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="reference" className="text-white/80 ml-1">Booking Reference #</Label>
                      <Input
                        id="reference"
                        placeholder="e.g. DM-123456"
                        required
                        value={formData.reference_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                        className="h-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-gold-light focus:border-gold-light"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/80 ml-1">Your Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        required
                        value={formData.guest_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
                        className="h-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-gold-light focus:border-gold-light"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-white/80 ml-1">Overall Rating</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, rating: s }))}
                          className="group"
                        >
                          <Star 
                            className={cn(
                              "h-8 w-8 transition-all duration-300",
                              s <= formData.rating 
                                ? "fill-gold-light text-gold-light scale-110" 
                                : "text-white/20 hover:text-white/40"
                            )} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-white/80 ml-1">Your Feedback</Label>
                    <Textarea
                      id="comment"
                      placeholder="What did you love about your stay?"
                      rows={4}
                      value={formData.comment}
                      onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white rounded-[1.5rem] focus:ring-gold-light focus:border-gold-light resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 rounded-2xl bg-gradient-gold text-secondary font-bold text-base shadow-xl transition-all active:scale-[0.98]"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Submit Review
                      </>
                    )}
                  </Button>
                  
                  <p className="text-center text-[10px] text-white/40 uppercase tracking-widest mt-4">
                    Reviews are personally checked by our team for authenticity
                  </p>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
