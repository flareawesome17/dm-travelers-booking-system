"use client";

import HeroSection from "@/components/landing/HeroSection";
import AmenitiesSection from "@/components/landing/AmenitiesSection";
import FeaturedRoomsSection from "@/components/landing/FeaturedRoomsSection";
import RestaurantPreview from "@/components/landing/RestaurantPreview";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import MapSection from "@/components/landing/MapSection";
import CTASection from "@/components/landing/CTASection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AmenitiesSection />
      <FeaturedRoomsSection />
      <RestaurantPreview />
      <TestimonialsSection />
      <MapSection />
      <CTASection />
    </>
  );
}
