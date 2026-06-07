// Scripture Study Guide — the faith/scripture learning section (moved here from
// the shop's "Study Guides" category and renamed). Text-only cards (NO product
// images) grouped by topic, each linking out to its study guide. This is one of
// the few sections that stays OPEN on the Sabbath.

import Link from 'next/link';
import SectionGuard from '@/components/SectionGuard';
import { getStudyGuides } from '@/lib/products';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Scripture Study Guide',
  description: 'Faith and scripture study guides — read and study by topic.',
};

// Pretty topic name from a product subcategory key.
function topicLabel(sub: string | undefined): string {
  if (!sub) return 'Study Guides';
  const map: Record<string, string> = {
    atonement: 'The Atonement',
    easter: 'Easter',
    faith: 'Faith',
    charity: 'Charity',
    service: 'Service',
    repentance: 'Repentance',
    patriarchalBlessings: 'Patriarchal Blessings',
  };
  return map[sub] ?? sub.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

// Drop a leading "Topic: " prefix from the product name so cards read cleanly
// under their topic heading (e.g. "Faith: What Faith Is" -> "What Faith Is").
function shortTitle(name: string): string {
  const i = name.indexOf(': ');
  return i > -1 ? name.slice(i + 2) : name;
}

export default async function ScriptureStudyPage() {
  const guides = await getStudyGuides();

  // Group by subcategory (topic), keep first-seen order.
  const groups: { topic: string; items: typeof guides }[] = [];
  const index = new Map<string, number>();
  for (const g of guides) {
    const key = g.subcategory ?? 'other';
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ topic: key, items: [] });
    }
    groups[index.get(key)!].items.push(g);
  }

  return (
    <SectionGuard sectionKey="scripture-study" label="Scripture Study Guide">
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">📖</div>
          <h1 className="text-3xl md:text-4xl font-black text-purple-900 mb-2">
            Scripture Study Guide
          </h1>
          <p className="text-purple-600 text-sm max-w-2xl mx-auto mb-4">
            Study the gospel by topic. Pick a guide and read — a good way to keep
            the Sabbath day holy.
          </p>
          <a
            href="https://www.churchofjesuschrist.org/?lang=eng"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors"
          >
            ⛪ Visit ChurchofJesusChrist.org
          </a>
        </div>

        {guides.length === 0 ? (
          <p className="text-center text-purple-700 text-sm">
            No study guides available yet.
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((grp) => (
              <section key={grp.topic}>
                <h2 className="text-xl font-black text-purple-900 mb-3 border-b-2 border-purple-100 pb-1">
                  {topicLabel(grp.topic)}
                </h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {grp.items.map((g) => (
                    <li
                      key={g.id}
                      className="bg-white rounded-xl border-2 border-purple-100 p-4 flex flex-col"
                    >
                      <span className="font-bold text-purple-900 mb-3">
                        {shortTitle(g.name)}
                      </span>
                      {g.studyGuideUrl ? (
                        <a
                          href={g.studyGuideUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto inline-flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                        >
                          📖 Read
                        </a>
                      ) : (
                        <Link
                          href={`/product/${g.id}`}
                          className="mt-auto inline-flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold py-2 rounded-lg text-sm transition-colors"
                        >
                          View
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link href="/" className="text-purple-700 underline text-sm">
            ← Back to Mamma&apos;s Place
          </Link>
        </div>
      </div>
    </div>
    </SectionGuard>
  );
}
