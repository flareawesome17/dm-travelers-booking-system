import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'D&M Travelers Inn | Affordable Hotel in Davao',
  description:
    'Book your stay at D&M Travelers Inn. Affordable accommodation in Davao. Travelers inn Davao, Davao travelers inn booking, budget hotel Davao city.',
  openGraph: {
    title: 'D&M Travelers Inn | Affordable Hotel in Davao',
    description: 'Affordable comfort and reliable hospitality in Davao.',
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
