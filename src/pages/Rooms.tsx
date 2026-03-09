import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Maximize, ArrowRight, Wifi, Car, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import roomStandard from "@/assets/room-standard.jpg";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import roomSuite from "@/assets/room-suite.jpg";

const allRooms = [
  {
    id: "standard",
    name: "Standard Room",
    type: "Standard",
    image: roomStandard,
    price: 1500,
    guests: 2,
    size: "22 sqm",
    desc: "A cozy room with all the essentials for a comfortable and relaxing stay. Features include a queen-size bed, work desk, and en-suite bathroom.",
    amenities: ["Free Wi-Fi", "Air Conditioning", "Hot Shower", "Cable TV", "Work Desk"],
  },
  {
    id: "standard-twin",
    name: "Standard Twin Room",
    type: "Standard",
    image: roomStandard,
    price: 1800,
    guests: 2,
    size: "24 sqm",
    desc: "Perfect for friends or colleagues traveling together. Two single beds with full room amenities.",
    amenities: ["Free Wi-Fi", "Air Conditioning", "Hot Shower", "Cable TV", "Mini Fridge"],
  },
  {
    id: "deluxe",
    name: "Deluxe Room",
    type: "Deluxe",
    image: roomDeluxe,
    price: 2500,
    guests: 2,
    size: "30 sqm",
    desc: "Spacious elegance with premium furnishings and garden views. King-size bed with luxury linens and a seating area.",
    amenities: ["Free Wi-Fi", "Air Conditioning", "Rain Shower", "Smart TV", "Mini Bar", "Coffee Maker"],
  },
  {
    id: "deluxe-family",
    name: "Deluxe Family Room",
    type: "Deluxe",
    image: roomDeluxe,
    price: 3200,
    guests: 4,
    size: "38 sqm",
    desc: "Ideal for families with extra space, additional beds, and child-friendly amenities.",
    amenities: ["Free Wi-Fi", "Air Conditioning", "Rain Shower", "Smart TV", "Mini Bar", "Extra Beds"],
  },
  {
    id: "suite",
    name: "Executive Suite",
    type: "Suite",
    image: roomSuite,
    price: 4500,
    guests: 4,
    size: "50 sqm",
    desc: "Our finest accommodation featuring a separate living area, premium furnishings, and panoramic tropical views.",
    amenities: ["Free Wi-Fi", "Air Conditioning", "Jacuzzi Tub", "Smart TV", "Mini Bar", "Living Area", "Balcony"],
  },
];

const roomTypes = ["All", "Standard", "Deluxe", "Suite"];

const Rooms = () => {
  const [filter, setFilter] = useState("All");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const filtered = filter === "All" ? allRooms : allRooms.filter((r) => r.type === filter);

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Header */}
        <section className="bg-secondary py-16 lg:py-20">
          <div className="container mx-auto px-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-heading text-3xl lg:text-5xl font-bold text-primary-foreground mb-3"
            >
              Rooms & Suites
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-secondary-foreground/70 max-w-lg mx-auto"
            >
              Choose from our selection of comfortable and well-appointed rooms.
            </motion.p>
          </div>
        </section>

        {/* Filter + Rooms */}
        <section ref={ref} className="py-12 lg:py-20 bg-background">
          <div className="container mx-auto px-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {roomTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    filter === type
                      ? "bg-primary text-primary-foreground shadow-gold"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Room Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {filtered.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card rounded-xl overflow-hidden shadow-soft flex flex-col md:flex-row group"
                >
                  <div className="relative w-full md:w-2/5 overflow-hidden">
                    <img src={room.image} alt={room.name} className="w-full h-48 md:h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                  <div className="p-5 lg:p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-heading text-xl font-bold text-foreground">{room.name}</h3>
                      <span className="text-primary font-bold text-lg">₱{room.price.toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 flex-1">{room.desc}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {room.guests} Guests</span>
                      <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {room.size}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {room.amenities.slice(0, 4).map((a) => (
                        <span key={a} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">{a}</span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">+{room.amenities.length - 4}</span>
                      )}
                    </div>
                    <Link to="/booking">
                      <Button className="w-full bg-gradient-gold text-secondary font-semibold hover:opacity-90">
                        Book This Room <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
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

export default Rooms;
