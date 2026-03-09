import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/landing/HeroSection";
import AmenitiesSection from "@/components/landing/AmenitiesSection";
import FeaturedRoomsSection from "@/components/landing/FeaturedRoomsSection";
import RestaurantPreview from "@/components/landing/RestaurantPreview";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import MapSection from "@/components/landing/MapSection";
import CTASection from "@/components/landing/CTASection";

const Index = () => {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AmenitiesSection />
        <FeaturedRoomsSection />
        <RestaurantPreview />
        <TestimonialsSection />
        <MapSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
};

export default Index;
