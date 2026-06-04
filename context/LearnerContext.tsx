'use client';

// LearnerContext — the logged-in kid for the shop side.
//
// Reads the same `dl_user` localStorage key + cookie that /drive uses, so a kid
// who logs in for driving practice is automatically logged in for the shop too
// (and vice versa). One name+PIN = both worlds (TODO.md Option A).
//
// `learner` is the normalized lowercase name, or null if anonymous / not logged in.
// `balanceCents` is fetched from /api/money/balance on mount and on `refresh()`.

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

interface LearnerContextValue {
  learner: string | null;
  balanceCents: number | null;
  loading: boolean;
  setLearner: (name: string | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const LearnerContext = createContext<LearnerContextValue | null>(null);
const STORAGE_KEY = 'dl_user';
const ANON_SENTINEL = '__anon__';
// Impersonation marker (set by /api/admin/impersonate). Cleared alongside
// dl_user on every logout path so the header badge never shows a stale
// "Admin view" after the borrowed session ends.
const RETURN_COOKIE = 'mp_admin_return';

function expireCookie(name: string) {
  try {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // ignore
  }
}

// The COOKIE is the source of truth — the server sets it on login/register
// and clears it on logout. localStorage is a convenience cache that some
// older code paths still write; it can drift out of sync (e.g. /shop/login
// sets the cookie but not localStorage), so we trust the cookie first and
// only fall back to localStorage when no cookie is set (covers the legacy
// Drive HTML pages that wrote localStorage before the cookie flow existed).
function readCookieUser(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STORAGE_KEY}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(STORAGE_KEY.length + 1));
  if (!raw || raw === ANON_SENTINEL) return null;
  return raw;
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  const fromCookie = readCookieUser();
  if (fromCookie) return fromCookie;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v || v === ANON_SENTINEL) return null;
    return v;
  } catch {
    return null;
  }
}

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learner, setLearnerState] = useState<string | null>(null);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = readStored();
    setLearnerState(stored);
    if (!stored) {
      setBalanceCents(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/money/balance?user=${encodeURIComponent(stored)}`);
      if (res.ok) {
        const data = (await res.json()) as { cents?: number };
        setBalanceCents(typeof data.cents === 'number' ? data.cents : null);
      } else {
        setBalanceCents(null);
      }
    } catch {
      setBalanceCents(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Refresh when another tab updates dl_user (multi-kid handoff in
    // separate windows).
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void refresh();
    };
    window.addEventListener('storage', onStorage);

    // NOTE: we deliberately do NOT clear the session on `beforeunload`.
    // beforeunload fires on ordinary same-site navigation (clicking any link),
    // not just real tab close — so wiping dl_user there logged the user out on
    // every page change (broke /parent access, the assign-chores UI, the
    // greeting, etc.). The 2h cookie TTL + the idle-logout below already cover
    // "forget the kid when they walk away" without punishing navigation.

    // (B) Visibility change → if the tab goes hidden for >= IDLE_LOGOUT_MS,
    // log the kid out. Covers "Mom switched to another tab and came back
    // hours later." Active session timer resets every time the tab is
    // visible again.
    const IDLE_LOGOUT_MS = 15 * 60 * 1000; // 15 minutes
    let hiddenAt: number | null = null;
    let idleLogoutTimer: ReturnType<typeof setTimeout> | null = null;
    const performIdleLogout = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      expireCookie(STORAGE_KEY);
      expireCookie(RETURN_COOKIE);
      // Force a refresh so the UI flips to anonymous immediately.
      setLearnerState(null);
      setBalanceCents(null);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        idleLogoutTimer = setTimeout(performIdleLogout, IDLE_LOGOUT_MS);
      } else {
        // Tab is visible again — cancel the pending logout if any.
        if (idleLogoutTimer !== null) {
          clearTimeout(idleLogoutTimer);
          idleLogoutTimer = null;
        }
        // If the tab was hidden longer than the threshold, the timeout
        // already fired and logged us out. Just re-check state.
        if (hiddenAt !== null && Date.now() - hiddenAt >= IDLE_LOGOUT_MS) {
          void refresh();
        }
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (idleLogoutTimer !== null) clearTimeout(idleLogoutTimer);
    };
  }, [refresh]);

  const setLearner = useCallback((name: string | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (name) localStorage.setItem(STORAGE_KEY, name);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setLearnerState(name);
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    // Expire the session cookie + any impersonation marker. Path must match the
    // original set (login/register/impersonate routes all use path: '/').
    expireCookie(STORAGE_KEY);
    expireCookie(RETURN_COOKIE);
    setLearnerState(null);
    setBalanceCents(null);
  }, []);

  return (
    <LearnerContext.Provider value={{ learner, balanceCents, loading, setLearner, refresh, logout }}>
      {children}
    </LearnerContext.Provider>
  );
}

export function useLearner() {
  const ctx = useContext(LearnerContext);
  if (!ctx) throw new Error('useLearner must be used within LearnerProvider');
  return ctx;
}
