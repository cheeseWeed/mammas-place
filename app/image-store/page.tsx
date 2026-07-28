// /image-store — this week's drop of original artwork.
//
// SERVER component on purpose:
//   * the 170-entry catalog (which carries the server-only `originalPath` of
//     every gated file) never ships to the browser,
//   * ownership comes from the DB in ONE query instead of a fetch per card.
//
// The drop is a pure function of the ISO week (lib/image-store/rotation.ts) —
// no cron, nothing stored. Everyone sees the same pieces Monday through Sunday,
// and it changes by itself at midnight Monday.
//
// Sabbath: the store is SHOPPING, so it is closed Sunday like the rest of the
// shop. A kid can still see and re-download what they already own — that lives
// at /portal/collection, which is open every day.

import Link from 'next/link';
import SabbathGuard from '@/components/SabbathGuard';
import ImageCard from '@/components/image-store/ImageCard';
import MisprintBadge from '@/components/image-store/MisprintBadge';
import { currentUser } from '@/lib/family/auth';
import { IMAGE_CATALOG, groupBySet, setSize } from '@/lib/image-store/catalog';
import { ownedImageIds } from '@/lib/image-store/purchase';
import { getWeeklyDrop, nextDropStart } from '@/lib/image-store/rotation';

export const metadata = {
  title: "Image Store · Mamma's Place",
  description: 'A new drop of original artwork every Monday. Buy with MP.',
};

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export default async function ImageStorePage() {
  const drop = getWeeklyDrop(IMAGE_CATALOG, new Date());

  // One query for the whole grid. Anonymous visitors just get an empty set.
  const user = await currentUser();
  const owned = user ? await ownedImageIds(user) : new Set<string>();

  const groups = groupBySet(drop.allItems);
  const ownedCount = drop.allItems.filter((i) => owned.has(i.id)).length;

  return (
    <SabbathGuard label="The image store">
      <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-8">
          <div className="text-yellow-300 text-sm font-bold uppercase tracking-wide mb-1">
            This week&apos;s drop
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2">🖼️ The Image Store</h1>
          <p className="text-purple-100 text-sm sm:text-base max-w-2xl">
            Original artwork you can buy with your own MP and keep forever. New pieces land every
            Monday — next drop {formatDay(nextDropStart(new Date()))}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/portal/collection"
              className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              🗂️ My Collection
            </Link>
            <Link
              href="/portal/money"
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              💰 My MP Money
            </Link>
          </div>
          {ownedCount > 0 && (
            <p className="mt-4 text-xs text-yellow-200 font-bold">
              You already own {ownedCount} of this week&apos;s {drop.allItems.length} pieces.
            </p>
          )}
        </div>

        {/* Rare reveal — a misprint only surfaces on a rare week, so say so loudly. */}
        {drop.rareItem && (
          <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <MisprintBadge size="lg" />
              <span className="text-amber-900 font-black text-sm uppercase tracking-wide">
                Rare reveal this week
              </span>
            </div>
            <p className="text-amber-950 text-sm sm:text-base">
              <strong>{drop.rareItem.title}</strong> came off the press wrong — and that is the
              whole point. Misprints are one-of-a-kind mistakes: smudges, crooked colours, happy
              accidents. They hide from the normal drop and only show up on a rare week like this
              one.
            </p>
          </div>
        )}

        {drop.bonusItem && !drop.rareItem && (
          <div className="mb-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5 text-purple-900 text-sm sm:text-base">
            🎁 <strong>Bonus piece this week!</strong> An extra original snuck into the drop.
          </div>
        )}

        {/* The drop, grouped by set */}
        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center text-gray-700">
            The gallery is empty right now. Check back Monday!
          </div>
        ) : (
          groups.map((group) => {
            const total = setSize(group.setName);
            const ownedInSet = group.items.filter((i) => owned.has(i.id)).length;
            return (
              <section key={group.setName} className="mb-10">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h2 className="text-xl sm:text-2xl font-black text-purple-900">
                    {group.setName}
                  </h2>
                  <span className="text-xs font-bold text-purple-700/70 uppercase tracking-wide">
                    {group.items.length} of {total} in the set this week
                    {ownedInSet > 0 && ` · ${ownedInSet} yours`}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((item) => (
                    <ImageCard key={item.id} item={item} owned={owned.has(item.id)} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <p className="text-center text-xs text-gray-500 mt-10">
          Previews are watermarked. When you buy a piece, the clean original is yours to download —
          forever, for free, as many times as you like.
        </p>
      </div>
    </SabbathGuard>
  );
}
