// Sitemap — public, indexable routes only.
// Excludes /api, /admin, /portal (kid-private dashboards), login pages,
// /cart and /checkout (session-only), and dynamic [param] routes.
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://mammas-place.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const home = {
    url: `${BASE_URL}/`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 1.0,
  };

  const hubs = [
    '/shop',
    '/drive',
    '/geography',
    '/spelling',
    '/math',
    '/language-arts',
    '/chess',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const staticPages = ['/about', '/contact', '/faq', '/shipping'].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const subpages = [
    // Geography — USA
    '/geography/distance',
    '/geography/study',
    '/geography/name-quiz',
    '/geography/capital-quiz',
    '/geography/drag-match',
    '/geography/flag-match',
    '/geography/physical-quiz',
    '/geography/silhouette-puzzle',
    // Geography — World
    '/geography/world/test',
    '/geography/world/study',
    '/geography/world/name-quiz',
    '/geography/world/capital-quiz',
    '/geography/world/continent-quiz',
    '/geography/world/flag-match',
    '/geography/world/physical-quiz',
    // Spelling
    '/spelling/rules',
    '/spelling/placement',
    '/spelling/practice',
    // Math
    '/math/practice',
    '/math/fact-families',
    '/math/word-problems',
    // Language Arts
    '/language-arts/homophones',
    '/language-arts/grammar',
    '/language-arts/phonics',
    '/language-arts/thesaurus',
    '/language-arts/punctuation',
    '/language-arts/dictionary',
    // Chess
    '/chess/play',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [home, ...hubs, ...staticPages, ...subpages];
}
