import type { Metadata } from "next";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "D&M Travelers Inn - Affordable Luxury Hotel in Plaridel, Misamis Occidental",
  description:
    "Book your stay at D&M Travelers Inn, Plaridel's premier affordable luxury hotel. Comfortable rooms, authentic Filipino restaurant, pool, and warm hospitality. Near Baobawon Island.",
  keywords:
    "travelers inn plaridel, plaridel hotel booking, affordable hotel misamis occidental, plaridel accommodation, budget hotel plaridel",
  authors: [{ name: "D&M Travelers Inn" }],
  openGraph: {
    type: "website",
    title: "D&M Travelers Inn - Affordable Luxury Hotel in Plaridel, Misamis Occidental",
    description:
      "Experience warm Filipino hospitality at D&M Travelers Inn. Comfortable rooms, excellent dining, and prime location in Plaridel, near Baobawon Island.",
    siteName: "D&M Travelers Inn",
  },
  twitter: {
    card: "summary_large_image",
    title: "D&M Travelers Inn - Plaridel, Misamis Occidental Hotel",
    description:
      "Affordable luxury hotel in Plaridel, Misamis Occidental with pool, restaurant, and 24/7 service.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Hotel",
              name: "D&M Travelers Inn",
              description:
                "Affordable luxury hotel in Plaridel, Misamis Occidental, Philippines. Near Baobawon Island.",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Looc Proper, Dipolog - Oroquieta National Rd",
                addressLocality: "Plaridel",
                addressRegion: "Misamis Occidental",
                addressCountry: "PH",
                postalCode: "7209",
              },
              telephone: "+639518683018",
              priceRange: "₱₱",
              starRating: { "@type": "Rating", ratingValue: "4.7" },
              amenityFeature: [
                { "@type": "LocationFeatureSpecification", name: "Free Wi-Fi" },
                { "@type": "LocationFeatureSpecification", name: "Swimming Pool" },
                { "@type": "LocationFeatureSpecification", name: "Restaurant" },
                { "@type": "LocationFeatureSpecification", name: "Free Parking" },
              ],
            }),
          }}
        />
      </head>
      <body>
        <Providers>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
