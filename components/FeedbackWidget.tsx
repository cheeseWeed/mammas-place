'use client';

// Floating feedback widget — small button rendered in the global Header next
// to the Cart pill. Tapping opens a modal with an optional name + body box
// (max 2000 chars). Submits to POST /api/feedback (rate-limited per IP).
// Tracks current pathname so the admin sees which page the kid was on when
// they wrote it.

import { useEffect, useState } from 'react';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Lock background scroll while the modal is open — looks nicer on mobile
  // where the iOS rubber-band can otherwise drag the page underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-clear the success toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Type something first!');
      return;
    }
    if (trimmed.length > 2000) {
      setError(`Too long — keep it under 2000 chars (${trimmed.length} now).`);
      return;
    }
    setBusy(true);
    try {
      const page =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : null;
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: trimmed,
          authorName: name.trim() || undefined,
          page: page || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setBody('');
      setName('');
      setOpen(false);
      setToast('Thanks! Sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Trigger — compact button that fits in the existing header right cluster.
          Yellow accent so it pops without expanding the header height. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback"
        aria-label="Send feedback"
        className="hidden sm:inline-flex items-center gap-1 bg-yellow-300 hover:bg-yellow-200 active:bg-yellow-400 text-purple-900 font-bold px-3 py-2 rounded-full text-sm transition-colors shadow-sm"
      >
        <span aria-hidden="true">💬</span>
        <span className="hidden md:inline">Feedback</span>
      </button>
      {/* Mobile version — icon only so it doesn't crowd the cart. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback"
        aria-label="Send feedback"
        className="sm:hidden flex items-center justify-center bg-yellow-300 hover:bg-yellow-200 active:bg-yellow-400 text-purple-900 font-bold w-9 h-9 rounded-full text-sm transition-colors shadow-sm"
      >
        💬
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 id="feedback-title" className="font-black text-purple-900 text-lg">
                💬 Send feedback
              </h2>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
                className="text-purple-400 hover:text-purple-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Tell us what&apos;s working, what&apos;s broken, or what you wish was here.
            </p>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label
                  htmlFor="fb-name"
                  className="block text-xs font-semibold text-purple-900 mb-1"
                >
                  Your name (optional)
                </label>
                <input
                  id="fb-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Leave blank to send anonymously"
                  maxLength={60}
                  disabled={busy}
                  className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50 text-purple-900 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="fb-body"
                  className="block text-xs font-semibold text-purple-900 mb-1"
                >
                  Message ({body.length}/2000)
                </label>
                <textarea
                  id="fb-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={2000}
                  rows={5}
                  disabled={busy}
                  autoFocus
                  className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 text-sm resize-y"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !busy && setOpen(false)}
                  disabled={busy}
                  className="text-purple-700 hover:text-purple-900 underline text-sm px-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[201] max-w-sm bg-green-100 border-2 border-green-300 text-green-900 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm"
        >
          {toast}
        </div>
      )}
    </>
  );
}
