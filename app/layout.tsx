import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'D&M Travelers Inn | Affordable Hotel in Plaridel, Misamis Occidental',
  description:
    'Book your stay at D&M Travelers Inn. Affordable accommodation in Plaridel, Misamis Occidental. Near Baobawon Island. Budget hotel Plaridel.',
  openGraph: {
    title: 'D&M Travelers Inn | Affordable Hotel in Plaridel',
    description: 'Affordable comfort and reliable hospitality in Plaridel, Misamis Occidental.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
