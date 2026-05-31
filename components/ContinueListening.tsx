'use client';

// Homepage "Continue listening" section. Three states:
//
// - Logged in + has history: shows "Up next" (≤4 series cards) and
//   "Recently played" (≤3 cards) — fetched from /api/audiobooks/up-next.
// - Logged in + no history yet: falls back to 4 random featured audiobooks
//   with a "Press play on any to start tracking" hint.
// - Anonymous: same 4 featured audiobooks + "Sign in to track what
//   you've listened to" hint.
//
// All data is fetched client-side so the server-rendered shell stays cacheable
// per-kid the API uses the dl_user cookie to scope history.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLearner } from '@/context/LearnerContext';
import type { Product } from '@/types';

interface Props {
  // Featured audiobooks passed from the server-rendered page so the anonymous
  // / empty-history fallback doesn't need another fetch.
  featuredAudiobooks: Product[];
}

interface ApiPayload {
  upNext: Product[];
  recent: Product[];
}

export default function ContinueListening({ featuredAudiobooks }: Props) {
  const { learner, loading: learnerLoading } = useLearner();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (learnerLoading) return;
    if (!learner) { setData(null); return; }
    setLoading(true);
    fetch(`/api/audiobooks/up-next?user=${encodeURIComponent(learner)}`)
      .then((r) => r.ok ? r.json() as Promise<ApiPayload> : { upNext: [], recent: [] })
      .then((p) => setData(p))
      .catch(() => setData({ upNext: [], recent: [] }))
      .finally(() => setLoading(false));
  }, [learner, learnerLoading]);

  const hasHistory = !!(data && (data.upNext.length > 0 || data.recent.length > 0));

  // Fallback featured pool — shuffled deterministically per render so the
  // anonymous / no-history experience still feels varied.
  const fallback = featuredAudiobooks.slice(0, 4);

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-purple-900">🎧 Continue Listening</h2>
        <Link href="/shop?category=audiobooks" className="text-purple-700 hover:text-purple-500 font-semibold text-sm">
          Browse all audiobooks →
        </Link>
      </div>

      {learnerLoading || loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-purple-100 animate-pulse rounded-2xl h-44" />
          ))}
        </div>
      ) : hasHistory ? (
        <>
          {data!.upNext.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-purple-700 mb-3">Up next</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data!.upNext.map((p) => (
                  <AudioMiniCard key={p.id} product={p} badge={p.series ?? null} />
                ))}
              </div>
            </div>
          )}
          {data!.recent.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-purple-700 mb-3">Recently played</h3>
              <div className="grid grid-cols-3 gap-4">
                {data!.recent.map((p) => (
                  <AudioMiniCard key={p.id} product={p} badge={null} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
            {fallback.map((p) => (
              <AudioMiniCard key={p.id} product={p} badge={p.series ?? null} />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center mt-2">
            {learner
              ? 'Press play on any audiobook to start tracking your listens.'
              : (
                <>
                  <Link href="/shop/login" className="text-purple-700 font-bold hover:underline">Sign in</Link>
                  {' '}to track what you&apos;ve listened to.
                </>
              )}
          </p>
        </>
      )}
    </section>
  );
}

// Compact card used for both "Up next" and "Recently played". Smaller than a
// full ProductCard because the section can hold up to 7 items above the fold.
function AudioMiniCard({ product, badge }: { product: Product; badge: string | null }) {
  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden hover:shadow-md hover:border-purple-300 transition-all"
    >
      <div className="aspect-square bg-gradient-to-br from-purple-100 to-purple-200 overflow-hidden relative">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
        {badge && (
          <span className="absolute top-2 left-2 bg-purple-900/80 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-purple-700">
          {product.name}
        </p>
      </div>
    </Link>
  );
}
