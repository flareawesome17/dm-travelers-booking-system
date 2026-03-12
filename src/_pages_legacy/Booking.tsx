import { motion } from "framer-motion";
import { useState } from "react";
import { CalendarDays, Users, ArrowRight, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import roomStandard from "@/assets/room-standard.jpg";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomSuite from "@/assets/room-suite.jpg";

const roomOptions = [
  { id: "standard", name: "Standard Room", price: 1500, image: roomStandard },
  { id: "standard-twin", name: "Standard Twin", price: 1800, image: roomStandard },
  { id: "deluxe", name: "Deluxe Room", price: 2500, image: roomDeluxe },
  { id: "deluxe-family", name: "Deluxe Family", price: 3200, image: roomDeluxe },
  { id: "suite", name: "Executive Suite", price: 4500, image: roomSuite },
];

const Booking = () => {
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", checkin: "", checkout: "", guests: "1", request: "" });
  const [verificationCode, setVerificationCode] = useState("");

  const totalSteps = 4;

  const handleNext = () => setStep((s) => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const selectedRoomData = roomOptions.find((r) => r.id === selectedRoom);

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen bg-background">
        <section className="bg-secondary py-10 lg:py-14">
          <div className="container mx-auto px-4 text-center">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
              Book Your Stay
            </motion.h1>
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
              {["Room", "Details", "Verify", "Confirmed"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-gradient-gold text-secondary" : "bg-secondary-foreground/20 text-secondary-foreground/50"
                  }`}>
                    {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < 3 && <div className={`w-8 lg:w-12 h-0.5 ${step > i + 1 ? "bg-primary" : "bg-secondary-foreground/20"}`} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 lg:py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            {/* Step 1: Select Room */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Select Your Room</h2>
                {roomOptions.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selectedRoom === room.id ? "border-primary shadow-gold bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <img src={room.image} alt={room.name} className="w-20 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-foreground">{room.name}</h3>
                      <p className="text-sm text-muted-foreground">Starting at ₱{room.price.toLocaleString()}/night</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${selectedRoom === room.id ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {selectedRoom === room.id && <div className="w-full h-full rounded-full flex items-center justify-center"><CheckCircle className="w-4 h-4 text-primary-foreground" /></div>}
                    </div>
                  </button>
                ))}
                <Button onClick={handleNext} disabled={!selectedRoom} className="w-full bg-gradient-gold text-secondary font-semibold h-11 shadow-gold hover:opacity-90 disabled:opacity-50">
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Guest Details */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-4">Reservation Details</h2>
                <div className="bg-card rounded-xl p-6 shadow-soft space-y-4">
                  {selectedRoomData && (
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                      <img src={selectedRoomData.image} alt="" className="w-16 h-12 rounded-lg object-cover" />
                      <div>
                        <p className="font-semibold text-foreground">{selectedRoomData.name}</p>
                        <p className="text-sm text-primary font-bold">₱{selectedRoomData.price.toLocaleString()}/night</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Email *</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Phone *</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Guests</label>
                      <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Check-in *</label>
                      <input type="date" value={form.checkin} onChange={(e) => setForm({ ...form, checkin: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Check-out *</label>
                      <input type="date" value={form.checkout} onChange={(e) => setForm({ ...form, checkout: e.target.value })} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Special Requests</label>
                    <textarea value={form.request} onChange={(e) => setForm({ ...form, request: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Any special requests?" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={handleBack} className="border-border text-foreground">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button onClick={handleNext} disabled={!form.name || !form.email || !form.phone || !form.checkin || !form.checkout} className="flex-1 bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90 disabled:opacity-50">
                    Continue <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Verify Email */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center">
                <div className="bg-card rounded-xl p-8 shadow-soft max-w-md mx-auto">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Verify Your Email</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    We've sent a 6-digit verification code to <strong className="text-foreground">{form.email}</strong>
                  </p>
                  <input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 bg-muted rounded-lg text-center text-lg tracking-[0.3em] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground mb-4">
                    Didn't receive it? <button className="text-primary font-medium hover:underline">Resend code</button>
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleBack} className="border-border text-foreground">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleNext} disabled={verificationCode.length < 6} className="flex-1 bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90 disabled:opacity-50">
                      Verify & Confirm
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirmed */}
            {step === 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="bg-card rounded-xl p-8 shadow-elevated max-w-md mx-auto">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.6 }}
                    className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle className="w-10 h-10 text-primary" />
                  </motion.div>
                  <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your reservation has been confirmed. A confirmation email has been sent to {form.email}.
                  </p>
                  <div className="bg-muted rounded-lg p-4 text-left space-y-2 text-sm mb-6">
                    <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono font-bold text-foreground">DM-{Math.random().toString(36).substr(2, 8).toUpperCase()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span className="font-semibold text-foreground">{selectedRoomData?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="text-foreground">{form.checkin}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="text-foreground">{form.checkout}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Guest</span><span className="text-foreground">{form.name}</span></div>
                  </div>
                  <Button onClick={() => { setStep(1); setSelectedRoom(""); setForm({ name: "", email: "", phone: "", checkin: "", checkout: "", guests: "1", request: "" }); setVerificationCode(""); }} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Make Another Booking
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Booking;
