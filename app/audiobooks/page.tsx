// Audiobooks — the LISTENING surface. Deliberately separate from the shop.
//
// WHY THIS PAGE EXISTS: audiobooks are also shop products, and the shop is
// closed on the Sabbath. Before this page, every audiobook entry point went
// through /shop?category=audiobooks (Header.tsx + ContinueListening.tsx), so on
// Sundays the shop gate hid the ONLY route to listening — even though
// SABBATH_OPEN_SECTIONS has always listed 'audiobooks' as open.
//
// This route carries NO shop gate and NO buy controls. It lists audiobooks the
// kid can play and links to /product/<id>, where the player renders and the
// purchase buttons are separately hidden on the Sabbath.

import Link from 'next/link';
import SectionGuard from '@/components/SectionGuard';
import { getAudiobooks } from '@/lib/products';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audiobooks',
  description: 'Listen to audiobooks — open every day, including Sunday.',
};

// Group items by their series so a kid sees "Rock Hunters", "Bedtime
// Explorers", etc. rather than one long undifferentiated list.
function groupBySeries(items: Awaited<ReturnType<typeof getAudiobooks>>) {
  const groups: { series: string; items: typeof items }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const key = item.series ?? 'More Audiobooks';
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ series: key, items: [] });
    }
    groups[index.get(key)!].items.push(item);
  }
  return groups;
}

export default async function AudiobooksPage() {
  const audiobooks = await getAudiobooks();
  const groups = groupBySeries(audiobooks);

  return (
    <SectionGuard sectionKey="audiobooks" label="Audiobooks">
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">🎧</div>
            <h1 className="text-3xl md:text-4xl font-black text-purple-900 mb-2">
              Audiobooks
            </h1>
            <p className="text-purple-600 text-sm max-w-2xl mx-auto">
              Pick something to listen to. Audiobooks are open every day —
              including Sunday.
            </p>
          </div>

          {audiobooks.length === 0 ? (
            <p className="text-center text-purple-700 text-sm">
              No audiobooks available yet.
            </p>
          ) : (
            <div className="space-y-8">
              {groups.map((grp) => (
                <section key={grp.series}>
                  <h2 className="text-xl font-black text-purple-900 mb-3 border-b-2 border-purple-100 pb-1">
                    {grp.series}
                  </h2>
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {grp.items.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/product/${a.id}`}
                          className="h-full bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 p-4 flex items-center gap-3 transition-colors group"
                        >
                          <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-purple-100">
                            <img
                              src={a.imageUrl}
                              alt={a.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <span className="font-bold text-purple-900 group-hover:text-purple-700 leading-tight">
                            {a.name}
                          </span>
                          <span className="ml-auto text-2xl shrink-0">🎧</span>
                        </Link>
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
