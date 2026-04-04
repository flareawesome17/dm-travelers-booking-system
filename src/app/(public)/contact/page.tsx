"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Clock3, Mail, MapPin, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PublicGlassPanel,
  PublicGrid,
  PublicPageHero,
  PublicSection,
} from "@/components/public/PublicPrimitives";

const DEFAULTS = {
  address: "Looc Proper, Dipolog - Oroquieta National Rd, Plaridel, 7209 Misamis Occidental, Philippines",
  phone: "+63 951 868 3018",
  email: "info@dmtravelersinn.com",
};

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings(data);
        }
      })
      .catch(() => {});
  }, []);

  const contactItems = [
    {
      icon: MapPin,
      title: "Address",
      text: settings.hotel_address || DEFAULTS.address,
    },
    {
      icon: PhoneCall,
      title: "Phone",
      text: settings.hotel_phone || DEFAULTS.phone,
    },
    {
      icon: Mail,
      title: "Email",
      text: settings.hotel_email || DEFAULTS.email,
    },
    {
      icon: Clock3,
      title: "Front Desk",
      text: "Open 24 hours, 7 days a week",
    },
  ];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setStatus("success");
        setForm({ name: "", email: "", subject: "", message: "" });
        return;
      }

      const data = await response.json();
      setErrorMsg(data.error || "Failed to send message. Please try again.");
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <>
      <PublicPageHero
        description="Make it easy for guests to ask a question, check availability, or reach the front desk without friction on mobile, tablet, or desktop."
        eyebrow="Contact"
        imageAlt="D&M Travellers Inn contact and arrival experience"
        imageSrc="/images/hero-hotel.jpg"
        stats={[
          { label: "Support", value: "Front desk ready" },
          { label: "Response path", value: "Direct inquiry" },
          { label: "Availability", value: "24/7 desk" },
        ]}
        title="Speak with the team before you arrive."
      />

      <PublicSection tone="deep-soft" className="pb-16 pt-6 lg:pb-24 lg:pt-8">
        <PublicGrid>
          <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.6 }}
              className="grid gap-4"
            >
              {contactItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.5, delay: index * 0.06 }}
                >
                  <PublicGlassPanel className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10">
                      <item.icon className="h-5 w-5 text-gold-light" />
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                        {item.title}
                      </p>
                      <p className="mt-3 font-body text-sm leading-7 text-white/82">
                        {item.text}
                      </p>
                    </div>
                  </PublicGlassPanel>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.6, delay: 0.08 }}
            >
              <PublicGlassPanel className="p-6 sm:p-7">
                <p className="text-[0.72rem] uppercase tracking-[0.26em] text-gold-light/86 sm:tracking-[0.34em]">
                  Send A Message
                </p>
                <h2 className="mt-4 font-heading text-[1.9rem] font-semibold text-white sm:text-3xl">
                  Reach the team with a cleaner, more premium inquiry form.
                </h2>

                {status === "success" ? (
                  <div className="mt-6 rounded-[1.25rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 font-body text-sm text-emerald-100">
                    Message sent. The team will get back to you soon.
                  </div>
                ) : null}

                {status === "error" ? (
                  <div className="mt-6 rounded-[1.25rem] border border-red-400/20 bg-red-500/10 px-4 py-3 font-body text-sm text-red-100">
                    {errorMsg}
                  </div>
                ) : null}

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      placeholder="Full name"
                      required
                      value={form.name}
                    />
                    <input
                      className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      placeholder="Email address"
                      required
                      type="email"
                      value={form.email}
                    />
                  </div>

                  <input
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                    onChange={(event) => setForm({ ...form, subject: event.target.value })}
                    placeholder="Subject"
                    required
                    value={form.subject}
                  />

                  <textarea
                    className="min-h-[11rem] w-full rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 font-body text-sm text-white outline-none transition-colors placeholder:text-white/34 focus:border-gold-light/30"
                    minLength={10}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    placeholder="Your message"
                    required
                    value={form.message}
                  />

                  <Button
                    className="h-12 w-full rounded-full bg-gradient-gold font-body text-sm font-semibold text-secondary shadow-[0_18px_40px_-20px_hsl(var(--gold)/0.95)] transition-transform duration-300 hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
                    disabled={status === "sending"}
                    type="submit"
                  >
                    {status === "sending" ? "Sending message..." : "Send message"}
                  </Button>
                </form>
              </PublicGlassPanel>
            </motion.div>
          </div>
        </PublicGrid>
      </PublicSection>
    </>
  );
}
