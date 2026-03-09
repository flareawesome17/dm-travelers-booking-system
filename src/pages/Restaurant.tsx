import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import restaurantImg from "@/assets/restaurant.jpg";

const menuItems = [
  { name: "Tapsilog", category: "Breakfast", price: 180, desc: "Beef tapa, garlic rice, and fried egg" },
  { name: "Longsilog", category: "Breakfast", price: 150, desc: "Longganisa, garlic rice, and fried egg" },
  { name: "Pancake Stack", category: "Breakfast", price: 160, desc: "Fluffy pancakes with maple syrup and butter" },
  { name: "Sinigang na Baboy", category: "Lunch", price: 280, desc: "Pork sour soup with vegetables" },
  { name: "Kare-Kare", category: "Lunch", price: 320, desc: "Oxtail stew with peanut sauce" },
  { name: "Grilled Tuna Belly", category: "Lunch", price: 350, desc: "Fresh Davao tuna, grilled to perfection" },
  { name: "Lechon Kawali", category: "Dinner", price: 380, desc: "Crispy deep-fried pork belly" },
  { name: "Seafood Platter", category: "Dinner", price: 650, desc: "Assorted fresh seafood, grilled and steamed" },
  { name: "Chicken Inasal", category: "Dinner", price: 280, desc: "Grilled marinated chicken with rice" },
  { name: "Mango Shake", category: "Drinks", price: 120, desc: "Fresh Davao mango smoothie" },
  { name: "Halo-Halo", category: "Drinks", price: 150, desc: "Classic Filipino shaved ice dessert drink" },
  { name: "San Miguel Beer", category: "Drinks", price: 80, desc: "Ice-cold local beer" },
];

const categories = ["All", "Breakfast", "Lunch", "Dinner", "Drinks"];

const Restaurant = () => {
  const [filter, setFilter] = useState("All");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const filtered = filter === "All" ? menuItems : menuItems.filter((m) => m.category === filter);

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="relative h-64 lg:h-80 overflow-hidden">
          <img src={restaurantImg} alt="D&M Travelers Inn Restaurant" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-hero flex items-center justify-center">
            <div className="text-center">
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl lg:text-5xl font-bold mb-2" style={{ color: "hsl(40, 33%, 98%)" }}>
                Our Restaurant
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ color: "hsl(40, 15%, 75%)" }}>
                Authentic Filipino cuisine & international favorites
              </motion.p>
            </div>
          </div>
        </section>

        {/* Menu */}
        <section ref={ref} className="py-12 lg:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    filter === cat ? "bg-primary text-primary-foreground shadow-gold" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 15 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="bg-card rounded-xl p-5 flex justify-between items-start shadow-soft hover:shadow-elevated transition-shadow"
                >
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground mb-1">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mb-1.5">{item.desc}</p>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{item.category}</span>
                  </div>
                  <span className="text-primary font-bold text-lg ml-4 flex-shrink-0">₱{item.price}</span>
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

export default Restaurant;
