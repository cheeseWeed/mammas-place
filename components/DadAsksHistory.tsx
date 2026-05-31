// DadAsksHistory — collapsible "🗣️ Recent asks" panel on /portal/money.
//
// Pulls the kid's last N DadAsk rows from /api/money/dad/history (cookie-
// gated, kid can only see their own). Renders each row as a one-liner with
// the outcome icon, the kid's reason, and Dad's reply.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { centsToMP } from '@/lib/money/format';

type Outcome = 'yes_full' | 'yes_partial' | 'pickup_tab' | 'maybe_later' | 'no' | 'bad_luck';

interface AskRow {
  id: string;
  centsAsked: number;
  reason: string;
  outcome: Outcome;
  centsGranted: number;
  dadReply: string;
  context: string;
  createdAt: string;
}

interface Props {
  user: string;
  // Bump to force a refetch — used after a successful ask to refresh the list.
  refreshSignal?: number;
  limit?: number;
}

const ICON: Record<Outcome, string> = {
  yes_full: '✅',
  yes_partial: '⚖️',
  pickup_tab: '💳',
  maybe_later: '🕐',
  no: '❌',
  bad_luck: '🎲',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DadAsksHistory({ user, refreshSignal, limit = 10 }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/money/dad/history?user=${encodeURIComponent(user)}&limit=${limit}`,
      );
      if (!res.ok) {
        // 401/403 just means logged-out / mismatched cookie — render empty.
        setRows([]);
        return;
      }
      const data = (await res.json()) as { asks?: AskRow[] };
      setRows(data.asks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ask history.');
    }
  }, [user, limit]);

  useEffect(() => {
    // Lazy-load: only fetch once the kid opens the panel. Saves a request on
    // every /portal/money mount.
    if (open && rows === null) void load();
  }, [open, rows, load]);

  // External refresh trigger — bumped after a successful Ask Dad submit. Only
  // refetches if the panel has been opened before (otherwise it'll load fresh
  // when the kid opens it).
  useEffect(() => {
    if (refreshSignal === undefined) return;
    if (rows !== null) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl border border-purple-100 px-4 py-3 shadow-sm hover:bg-purple-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-black text-purple-900 text-base flex items-center gap-2">
          <span aria-hidden>🗣️</span>
          <span>My ask history</span>
        </span>
        <span className="text-xs text-purple-700">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          ) : rows === null ? (
            <div className="bg-white rounded-2xl border border-purple-100 p-4 text-sm text-gray-500">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-4 text-center text-sm text-gray-700">
              No asks yet. Hit &ldquo;🙋 Top me off&rdquo; above to try.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const icon = ICON[r.outcome] ?? '❔';
                const granted = r.centsGranted > 0;
                return (
                  <li
                    key={r.id}
                    className="bg-white rounded-xl border border-purple-100 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xl shrink-0" aria-hidden>{icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-gray-500 mb-0.5">
                          {formatDate(r.createdAt)} · asked {centsToMP(r.centsAsked)}
                          {r.context === 'checkout' ? ' at checkout' : ''}
                        </div>
                        <div className="text-sm text-gray-800 italic truncate">
                          &ldquo;{r.reason}&rdquo;
                        </div>
                        <div className="text-sm text-purple-900 mt-1">
                          <span className="font-bold">Dad:</span> {r.dadReply}
                        </div>
                      </div>
                      <div className={`text-sm font-black shrink-0 ${granted ? 'text-green-700' : 'text-gray-400'}`}>
                        {granted ? `+${centsToMP(r.centsGranted)}` : '—'}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
