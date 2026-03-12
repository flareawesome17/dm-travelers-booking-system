import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Contact = () => {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="bg-secondary py-16 lg:py-20">
          <div className="container mx-auto px-4 text-center">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl lg:text-5xl font-bold text-primary-foreground mb-3">
              Contact Us
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-secondary-foreground/70">
              We'd love to hear from you
            </motion.p>
          </div>
        </section>

        <section className="py-12 lg:py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Contact Info */}
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground mb-6">Get In Touch</h2>
                <div className="space-y-5">
                  {[
                    { icon: MapPin, title: "Address", text: "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, 7209 Misamis Occidental, Philippines" },
                    { icon: Phone, title: "Phone", text: "+63 951 868 3018" },
                    { icon: Mail, title: "Email", text: "info@dmtravelersinn.com" },
                    { icon: Clock, title: "Front Desk", text: "Open 24 hours, 7 days a week" },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Form */}
              <form className="bg-card rounded-xl p-6 shadow-soft space-y-4" onSubmit={(e) => e.preventDefault()}>
                <h3 className="font-heading text-lg font-semibold text-foreground">Send a Message</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input placeholder="Name" className="px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input type="email" placeholder="Email" className="px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <input placeholder="Subject" className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <textarea placeholder="Your message..." rows={5} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                <Button type="submit" className="w-full bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90">
                  Send Message
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Contact;
