'use client';

// Admin kill-switch gate. Wrap any learning-section page in this; when an admin
// has turned that section OFF (via the MP Bank "Sections" tab → SiteConfig), a
// kid sees a friendly "being updated" notice instead of the content. Mirrors
// SabbathGuard's shape.
//
// SAFETY: defaults to ENABLED. We only ever HIDE when we've affirmatively
// fetched the disabled list AND this key is in it. A failed/unreachable fetch
// leaves the section ON — a broken config must never black out a working page.
//
// ADMIN PREVIEW: an admin (detected via the client-readable mp_admin_present
// cookie, same marker lib/sabbath uses) is always let through so they can
// verify a fix, with a small "(disabled — admin preview)" banner on top.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isSectionEnabled } from '@/lib/sections';

// Client-side admin check — the real mp_parent cookie is httpOnly, so we read
// the non-httpOnly mp_admin_present marker (set alongside it on login).
function adminPresent(): boolean {
  if (typeof document === 'undefined') return false;
  return /(?:^|; )mp_admin_present=1/.test(document.cookie);
}

export default function SectionGuard({
  sectionKey,
  children,
  label = 'This activity',
}: {
  sectionKey: string;
  children: React.ReactNode;
  label?: string;
}) {
  // 'loading' until we've decided; then 'on' (render content),
  // 'off' (blocked), or 'preview' (admin viewing a disabled section).
  const [status, setStatus] = useState<'loading' | 'on' | 'off' | 'preview'>(
    'loading',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/sections', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { disabled?: unknown };
        if (cancelled) return;
        const enabled = isSectionEnabled(sectionKey, data.disabled);
        if (enabled) setStatus('on');
        else setStatus(adminPresent() ? 'preview' : 'off');
      } catch {
        // Fetch failed → fail OPEN. Never block a section on a network hiccup.
        if (!cancelled) setStatus('on');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionKey]);

  if (status === 'loading') return null; // brief blank on first paint
  if (status === 'on') return <>{children}</>;

  if (status === 'preview') {
    return (
      <>
        <div className="bg-amber-100 border-b-2 border-amber-300 text-amber-900 text-sm font-bold text-center px-4 py-2 print:hidden">
          🛠️ {label} is turned OFF for everyone — you&apos;re seeing it because
          you&apos;re an admin (disabled — admin preview).
        </div>
        {children}
      </>
    );
  }

  // status === 'off' — friendly kid-facing notice.
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-3">🛠️</div>
      <h1 className="text-3xl font-black text-purple-900 mb-2">
        This activity is being updated
      </h1>
      <p className="text-gray-700 mb-6">
        We&apos;re fixing up <span className="font-bold">{label}</span> right now
        so it works just right. Check back soon!
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
