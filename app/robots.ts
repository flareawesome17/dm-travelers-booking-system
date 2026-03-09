import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api.*$/, '') || 'https://dmtravelersinn.com';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
