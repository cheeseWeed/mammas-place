'use client';

// Sitewide "who am I?" badge for the header. Shows on every page:
//   - Admin                       → purple "Admin" pill + Log out
//   - Admin impersonating a kid   → "Admin: <user>" pill (return via the amber
//                                    ImpersonationBanner; this is just a label)
//   - Logged-in kid               → "<name>" pill + Log out
//   - Anonymous                   → nothing (the header's Log in link covers it)
//
// Admin status lives in the httpOnly `mp_parent` cookie the client can't read,
// so we probe GET /api/admin/whoami once on mount. `compact` renders the
// inline desktop pill; the full variant is used in the mobile menu.

import { useEffect, useState } from 'react';

interface Who {
  isAdmin: boolean;
  impersonating: string | null;
  user: string | null;
}

function pretty(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function IdentityBadge({ compact = false }: { compact?: boolean }) {
  const [who, setWho] = useState<Who | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/whoami', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (live) setWho(d as Who); })
      .catch(() => { /* badge just stays hidden */ });
    return () => { live = false; };
  }, []);

  if (!who) return null;

  // Admin logout: clear the godmode cookie (and any impersonation), go home.
  const adminLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' }); // exit impersonation if any
      await fetch('/api/money/parent/login', { method: 'DELETE' }); // clear mp_parent
    } catch {
      // best-effort; navigate regardless
    }
    window.location.href = '/';
  };

  const textSize = compact ? 'text-xs' : 'text-sm';

  // While impersonating, godmode is suspended — greet as the kid but flag that
  // it's the admin viewing. The amber banner offers the return action.
  if (who.impersonating) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className={`font-black text-yellow-300 ${textSize}`}>
          Hello {pretty(who.impersonating)}
        </span>
        <span className={`font-bold text-amber-200/90 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          (Admin view)
        </span>
      </span>
    );
  }

  if (who.isAdmin) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className={`font-black text-yellow-300 ${textSize}`}>Hello Admin</span>
        <button
          type="button"
          onClick={adminLogout}
          disabled={busy}
          className={`font-bold underline text-yellow-200/90 hover:text-yellow-100 disabled:opacity-50 ${
            compact ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </span>
    );
  }

  // Plain logged-in kid — friendly greeting by name.
  if (who.user) {
    return (
      <span className={`font-black text-yellow-300 whitespace-nowrap ${textSize}`}>
        Hello {pretty(who.user)}
      </span>
    );
  }

  return null;
}
