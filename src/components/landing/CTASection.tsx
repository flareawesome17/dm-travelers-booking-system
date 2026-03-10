import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-10 w-72 h-72 bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-10 w-56 h-56 bg-gold rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4" style={{ color: "hsl(40, 33%, 98%)" }}>
            Ready to Experience Plaridel?
          </h2>
          <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: "hsl(40, 15%, 70%)" }}>
            Book your stay at D&M Travelers Inn today and enjoy affordable luxury in the heart of the city.
          </p>
          <Link to="/booking">
            <Button size="lg" className="bg-gradient-gold text-secondary font-semibold text-base px-8 h-12 shadow-gold hover:opacity-90">
              Reserve Your Room <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
