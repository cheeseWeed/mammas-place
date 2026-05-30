// Robots — allow crawling of everything except API, admin, and kid-private portal routes.
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://mammas-place.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/portal/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
