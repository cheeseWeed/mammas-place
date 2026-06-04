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
import { useLearner } from '@/context/LearnerContext';

interface Who {
  isAdmin: boolean;
  impersonating: string | null;
  user: string | null;
}

function pretty(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Read the dl_user cookie client-side for an INSTANT greeting (no wait on the
// whoami fetch). whoami then upgrades this to admin/impersonation status.
function readDlUser(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )dl_user=([^;]*)/);
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v && v !== '__anon__' ? v : null;
}

export default function IdentityBadge({ compact = false }: { compact?: boolean }) {
  const [who, setWho] = useState<Who | null>(null);
  const [busy, setBusy] = useState(false);
  // Track the LearnerContext identity so the badge re-checks whenever someone
  // logs in or out (e.g. the balance-chip "×" logout, or a fresh login). Without
  // this the greeting only updated on a full page refresh.
  const { learner } = useLearner();

  useEffect(() => {
    let live = true;

    // Authoritative check: whoami knows admin (httpOnly mp_parent) AND the kid
    // session + impersonation. We re-run this on several triggers below so any
    // auth change reflects without a manual page refresh.
    const refresh = () => {
      fetch('/api/admin/whoami', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (live) setWho(d as Who); })
        .catch(() => { /* keep whatever we have */ });
    };

    // Instant client-side seed for the kid case so the name shows on first
    // paint (admin status still needs whoami, which lands a moment later).
    const dl = readDlUser();
    if (dl) setWho({ isAdmin: false, impersonating: null, user: dl });
    refresh();

    // Re-check when the tab regains focus or becomes visible — covers logging
    // in/out in this tab (we come back to it) and admin login that happened via
    // a SPA navigation rather than a remount.
    const onFocus = () => refresh();
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    // Light poll as a backstop so a same-tab login/logout (no focus change)
    // still updates within a couple seconds.
    const poll = window.setInterval(refresh, 2500);

    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(poll);
    };
    // Also re-seed/refresh immediately when the kid identity changes.
  }, [learner]);

  if (!who) return null;

  // Admin logout: clear the godmode cookie (and any impersonation), drop the
  // "view as day" preview override, go home.
  const adminLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' }); // exit impersonation if any
      await fetch('/api/money/parent/login', { method: 'DELETE' }); // clear mp_parent
    } catch {
      // best-effort; navigate regardless
    }
    try {
      document.cookie = 'mp_sabbath_override=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  // Stop being signed in as a kid → back to a clean admin view. Drops the
  // borrowed dl_user (and impersonation marker) but KEEPS mp_parent godmode.
  // The impersonate DELETE clears dl_user + mp_admin_return server-side and,
  // if godmode was suspended for a formal impersonation, restores it. We then
  // belt-and-suspenders clear the dl_user cookie client-side for the leftover-
  // cookie case (admin who never went through the impersonate button).
  const returnToAdmin = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
    } catch {
      // best-effort
    }
    try {
      document.cookie = 'dl_user=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {
      // ignore
    }
    window.location.href = '/admin/mp-bank';
  };

  // Plain kid log out: drop the dl_user session, back to home anonymous.
  const kidLogout = () => {
    setBusy(true);
    try {
      document.cookie = 'dl_user=; Path=/; Max-Age=0; SameSite=Lax';
      localStorage.removeItem('dl_user');
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  // Vertical stack: greeting on top, action link(s) underneath. Left-aligned.
  const textSize = compact ? 'text-xs' : 'text-sm';
  const linkBtn = 'block text-left font-bold underline text-yellow-200/90 hover:text-yellow-100 disabled:opacity-50 text-[11px] leading-tight';

  // Impersonating (entered via the "Log in as" button — godmode suspended).
  if (who.impersonating) {
    return (
      <div className="flex flex-col items-start leading-tight whitespace-nowrap">
        <span className={`font-black text-yellow-300 ${textSize}`}>
          Hello {pretty(who.impersonating)}
        </span>
        <button type="button" onClick={returnToAdmin} disabled={busy} className={linkBtn}>
          {busy ? 'Returning…' : '↩ Stop impersonating'}
        </button>
      </div>
    );
  }

  if (who.isAdmin) {
    // Admin, possibly also signed in as a kid (dl_user set). Show both:
    // "Hello Admin: Dad". Plain admin with no kid session → "Hello Admin".
    const label = who.user ? `Hello Admin: ${pretty(who.user)}` : 'Hello Admin';
    return (
      <div className="flex flex-col items-start leading-tight whitespace-nowrap">
        <span className={`font-black text-yellow-300 ${textSize}`}>{label}</span>
        {/* Kid session active → drop it but stay admin. */}
        {who.user && (
          <button type="button" onClick={returnToAdmin} disabled={busy} className={linkBtn}>
            {busy ? 'Returning…' : '↩ Stop impersonating'}
          </button>
        )}
        {/* Always: quick jump back to the admin dashboard from anywhere. */}
        <a href="/admin/mp-bank" className={linkBtn}>
          ⚙ Admin dashboard
        </a>
        {/* Always: fully log out of admin (clears godmode). */}
        <button type="button" onClick={adminLogout} disabled={busy} className={linkBtn}>
          {busy ? 'Logging out…' : 'Log out of admin'}
        </button>
      </div>
    );
  }

  // Plain logged-in kid — friendly greeting by name + log out.
  if (who.user) {
    return (
      <div className="flex flex-col items-start leading-tight whitespace-nowrap">
        <span className={`font-black text-yellow-300 ${textSize}`}>
          Hello {pretty(who.user)}
        </span>
        <button type="button" onClick={kidLogout} disabled={busy} className={linkBtn}>
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    );
  }

  return null;
}
