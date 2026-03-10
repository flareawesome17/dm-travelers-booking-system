import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "Restaurant", path: "/restaurant" },
  { label: "Reviews", path: "/reviews" },
  { label: "Contact", path: "/contact" },
  // { label: "Admin", path: "/admin" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-md border-b border-secondary-foreground/10"
    >
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-heading text-xl lg:text-2xl font-bold text-primary-foreground">
              D&M <span className="text-primary">Travelers Inn</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors duration-200 ${
                  location.pathname === link.path
                    ? "text-primary"
                    : "text-primary-foreground/70 hover:text-primary-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <a href="tel:+639518683018" className="flex items-center gap-2 text-sm text-primary-foreground/70">
              <Phone className="w-4 h-4" />
              +63 951 868 3018
            </a>
            <Link to="/booking">
              <Button variant="default" size="sm" className="bg-gradient-gold text-secondary font-semibold shadow-gold hover:opacity-90">
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-primary-foreground p-2"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-secondary border-t border-secondary-foreground/10"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`text-base py-2 font-medium ${
                    location.pathname === link.path
                      ? "text-primary"
                      : "text-primary-foreground/70"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link to="/booking" onClick={() => setIsOpen(false)}>
                <Button className="w-full bg-gradient-gold text-secondary font-semibold mt-2">
                  Book Now
                </Button>
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
