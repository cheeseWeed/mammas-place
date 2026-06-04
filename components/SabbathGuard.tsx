'use client';

// Drop into any page that should be CLOSED on the Sabbath (shop, checkout, the
// non-faith learning sections). On Sundays it renders a "closed" notice and
// redirects home; on other days it renders its children normally. Honors the
// admin day-override cookie via lib/sabbath.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isSabbath } from '@/lib/sabbath';

export default function SabbathGuard({
  children,
  label = 'This',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  // null = not yet checked (avoid SSR/client mismatch); true/false after mount.
  const [closed, setClosed] = useState<boolean | null>(null);

  useEffect(() => {
    setClosed(isSabbath());
  }, []);

  if (closed === null) return null; // brief blank on first paint
  if (!closed) return <>{children}</>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-3">🕊️</div>
      <h1 className="text-3xl font-black text-purple-900 mb-2">
        {label} is closed on the Sabbath
      </h1>
      <p className="text-gray-700 mb-6">
        We keep the Sabbath day holy. Come back tomorrow! Today is a good day to
        rest and study the scriptures.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/scripture-study"
          className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-full transition-colors"
        >
          📖 Study the Scriptures
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-6 py-3 rounded-full transition-colors"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}
