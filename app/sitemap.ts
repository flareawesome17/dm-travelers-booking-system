import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api.*$/, '') || 'https://dmtravelersinn.com';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/rooms`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/restaurant`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/reviews`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/booking`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  ];
}
