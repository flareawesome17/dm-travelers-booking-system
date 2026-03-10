import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MapPin, Navigation } from "lucide-react";

const MapSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-primary text-sm uppercase tracking-[0.15em] font-medium mb-2">Location</p>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">Find Us in Plaridel, Misamis Occidental</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-2 rounded-xl overflow-hidden shadow-elevated h-72 lg:h-96">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3951.0!2d123.7!3d8.6!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sPlaridel%2C+Misamis+Occidental!5e0!3m2!1sen!2sph!4v1"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="D&M Travelers Inn location - Plaridel, Misamis Occidental"
            />
          </div>

          <div className="bg-card rounded-xl p-6 shadow-soft flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Our Address</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Looc Proper, Dipolog - Oroquieta National Rd,<br />
              Plaridel, 7209 Misamis Occidental,<br />
              Philippines
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="w-4 h-4 text-primary" />
                Along Dipolog-Oroquieta National Road
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="w-4 h-4 text-primary" />
                Near Baobawon Island
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MapSection;
