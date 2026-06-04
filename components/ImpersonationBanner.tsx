'use client';

// Sitewide banner shown ONLY while an admin is impersonating a user (see
// /api/admin/impersonate). It reads the `mp_admin_return` cookie — set to the
// impersonated username — and offers a one-click "Return to admin" that clears
// the borrowed `dl_user` cookie and bounces back to the MP Bank dashboard.
//
// Pure client component, mounted in the root layout. When the cookie is absent
// (the normal case for kids and logged-out visitors) it renders nothing.

import { useEffect, useState } from 'react';

const RETURN_COOKIE = 'mp_admin_return';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ImpersonationBanner() {
  const [asUser, setAsUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAsUser(readCookie(RETURN_COOKIE));
  }, []);

  if (!asUser) return null;

  const returnToAdmin = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
    } catch {
      // Best-effort; navigate regardless so they aren't stuck.
    }
    setAsUser(null);
    // Hard navigate (not router.push) so the just-restored mp_parent cookie is
    // sent on the request and the server gate re-reads it cleanly — mirrors how
    // impersonation ENTERS via window.location.href.
    window.location.href = '/admin/mp-bank';
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-amber-400 text-amber-950 shadow-md print:hidden">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm font-bold">
        <span>👁 Viewing as <span className="font-black">{asUser}</span> (admin impersonation)</span>
        <button
          type="button"
          onClick={returnToAdmin}
          disabled={busy}
          className="bg-amber-950 hover:bg-amber-900 disabled:opacity-50 text-amber-50 font-bold px-3 py-1 rounded-lg whitespace-nowrap"
        >
          {busy ? 'Returning…' : '← Return to admin'}
        </button>
      </div>
    </div>
  );
}
