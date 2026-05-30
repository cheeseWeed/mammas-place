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

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
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

    // Session-only login: clear localStorage on window close so the next
    // tab/window load matches the (already-session-only) cookie. Keeps
    // the shared family laptop honest — closing the browser = logged out.
    const onBeforeUnload = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', onBeforeUnload);
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
    try {
      // Expire the session cookie immediately. Path must match the
      // original set (login/register routes use path: '/').
      document.cookie = `${STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      // ignore
    }
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
