import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Maria Santos",
    location: "Manila",
    rating: 5,
    text: "Absolutely wonderful stay! The staff went above and beyond to make us feel at home. The rooms are spotless and the location is perfect.",
  },
  {
    name: "James Lee",
    location: "Singapore",
    rating: 5,
    text: "Best value hotel in Plaridel. Clean rooms, excellent restaurant, and the pool area is a great place to unwind. Highly recommended!",
  },
  {
    name: "Ana Reyes",
    location: "Cebu",
    rating: 4,
    text: "Great location along the national road. The breakfast buffet was impressive and the staff are very accommodating. Will definitely come back!",
  },
];

const TestimonialsSection = () => {
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
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Testimonials</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">What Our Guests Say</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="bg-card rounded-xl p-6 shadow-soft"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star key={si} className={`w-4 h-4 ${si < t.rating ? "fill-primary text-primary" : "text-muted"}`} />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-4 italic">"{t.text}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
