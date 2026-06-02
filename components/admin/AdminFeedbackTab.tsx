'use client';

// MP Bank → Feedback tab. Lists submissions from /api/feedback (parent-gated),
// filterable by status (new / read / archived / all). Each row supports a
// "Mark read" + "Archive" action that PUTs to /api/feedback/[id].

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FeedbackRow {
  id: string;
  authorName: string | null;
  body: string;
  page: string | null;
  userAgent: string | null;
  status: string;
  createdAt: string;
}

type StatusFilter = 'new' | 'read' | 'archived' | 'all';

interface Props {
  // Parent passes a callback so the dashboard header badge can update when
  // a row's status changes (no need for a global event bus).
  onCountChange?: (newCount: number) => void;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function AdminFeedbackTab({ onCountChange }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleUnauth = useCallback(() => {
    router.push('/admin/mp-bank/login');
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        statusFilter === 'all'
          ? '/api/feedback'
          : `/api/feedback?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        feedback?: FeedbackRow[];
        newCount?: number;
      };
      setRows(Array.isArray(data.feedback) ? data.feedback : []);
      if (typeof data.newCount === 'number' && onCountChange) {
        onCountChange(data.newCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, handleUnauth, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: 'read' | 'archived' | 'new') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusyId(null);
    }
  };

  const deleteFeedback = async (id: string) => {
    // Hard delete — distinct from Archive (which just hides). No undo.
    if (!window.confirm('Permanently delete this feedback? This cannot be undone.')) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusyId(null);
    }
  };

  const FILTERS: { key: StatusFilter; label: string; pill: string }[] = [
    { key: 'new', label: 'New', pill: 'bg-purple-100 text-purple-900' },
    { key: 'read', label: 'Read', pill: 'bg-blue-100 text-blue-900' },
    { key: 'archived', label: 'Archived', pill: 'bg-gray-100 text-gray-700' },
    { key: 'all', label: 'All', pill: 'bg-yellow-100 text-yellow-900' },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Feedback inbox</h2>
          <p className="text-xs text-purple-600 mt-1">
            What kids (and curious visitors) sent via the header chat bubble.
            Rate-limited to 5 messages per IP per hour.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === f.key
                ? 'bg-purple-900 text-white border-purple-900'
                : `${f.pill} border-transparent hover:border-purple-300`
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-purple-700 text-sm">Loading feedback…</p>
      ) : rows.length === 0 ? (
        <p className="text-purple-700 text-sm">
          No feedback in this filter. Try a different status above.
        </p>
      ) : (
        <ul className="divide-y divide-purple-100">
          {rows.map((r) => {
            const isBusy = busyId === r.id;
            const statusClass =
              r.status === 'new'
                ? 'bg-purple-100 text-purple-900'
                : r.status === 'read'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-100 text-gray-700';
            return (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusClass}`}
                  >
                    {r.status}
                  </span>
                  <span className="font-bold text-purple-900 text-sm">
                    {r.authorName || 'Anonymous'}
                  </span>
                  <span className="text-xs text-purple-500">
                    · {relativeTime(r.createdAt)}
                  </span>
                  {r.page && (
                    <span
                      className="text-[10px] font-mono bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full"
                      title={r.page}
                    >
                      📍 {r.page.length > 40 ? `${r.page.slice(0, 40)}…` : r.page}
                    </span>
                  )}
                </div>
                <p className="text-sm text-purple-900 whitespace-pre-wrap break-words">
                  {r.body}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {r.status !== 'read' && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, 'read')}
                      disabled={isBusy}
                      className="text-blue-700 hover:text-blue-900 underline disabled:opacity-50"
                    >
                      Mark read
                    </button>
                  )}
                  {r.status !== 'new' && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, 'new')}
                      disabled={isBusy}
                      className="text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
                    >
                      Mark new
                    </button>
                  )}
                  {r.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, 'archived')}
                      disabled={isBusy}
                      className="text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteFeedback(r.id)}
                    disabled={isBusy}
                    className="text-red-600 hover:text-red-800 underline disabled:opacity-50 ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
