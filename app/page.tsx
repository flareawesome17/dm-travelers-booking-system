import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, Users, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-[#07008A] text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            D&M Travelers Inn
          </Link>
          <nav className="flex gap-6">
            <Link href="/rooms" className="hover:text-[#FED501] transition">
              Rooms
            </Link>
            <Link href="/restaurant" className="hover:text-[#FED501] transition">
              Restaurant
            </Link>
            <Link href="/reviews" className="hover:text-[#FED501] transition">
              Reviews
            </Link>
            <Link href="/booking" className="hover:text-[#FED501] transition">
              Book Now
            </Link>
            <Link href="/admin" className="text-sm opacity-80 hover:opacity-100">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-[#07008A]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920)',
          }}
        />
        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[#FED501] text-sm uppercase tracking-widest mb-4"
          >
            Welcome to Davao
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            Affordable Comfort.
            <br />
            Reliable Hospitality.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto"
          >
            Experience warm Filipino hospitality at D&M Travelers Inn. Book your stay in the heart of Davao.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/10 backdrop-blur rounded-xl p-6 max-w-2xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-left text-sm font-medium mb-1">Check-in</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-lg text-[#333]"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium mb-1">Check-out</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-lg text-[#333]"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium mb-1">Guests</label>
                <select className="w-full px-3 py-2.5 rounded-lg text-[#333]">
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4+</option>
                </select>
              </div>
            </div>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 bg-[#FED501] text-[#07008A] font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition"
            >
              Check Availability
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 container mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-[#07008A] mb-8 text-center"
        >
          Amenities
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {['Free WiFi', 'Air Conditioning', 'Restaurant'].map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-xl shadow-lg text-center"
            >
              <p className="font-semibold text-[#333]">{item}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-[#07008A] mb-4"
          >
            Featured Rooms
          </motion.h2>
          <Link
            href="/rooms"
            className="inline-flex items-center gap-2 bg-[#07008A] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#05006a] transition"
          >
            View All Rooms
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#07008A] text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold">D&M Travelers Inn</p>
          <p className="text-sm opacity-80 mt-2">Plaridel, Misamis Occidental · Near Baobawon Island</p>
        </div>
      </footer>
    </div>
  );
}
