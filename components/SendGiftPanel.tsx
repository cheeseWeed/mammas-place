// SendGiftPanel — kid-facing "🎁 Send a gift" panel for the MP Money portal.
//
// Lets a logged-in kid send MP to another learner. Picks a recipient from the
// family roster (/api/money/gift/recipients), an amount, an optional note, and
// "Send now" vs "Send on a date" (a future date the gift arrives). The sender's
// balance is shown and overspend is blocked client-side too (the server is the
// real guard). Posts to /api/money/gift/send.
//
// Also renders the sender's own state below the form:
//   - "Gifts you've received" (delivered gifts to me, with a fresh-arrival pop)
//   - "Scheduled gifts you've sent" (my future gifts not yet delivered)
// pulled from /api/money/gift/mine.
'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { centsToMP, dollarsInputToCents } from '@/lib/money/format';

interface Recipient {
  name: string;
  displayName: string;
}

interface GiftRow {
  id: string;
  senderUser: string | null;
  recipientUser: string;
  cents: number;
  note: string | null;
  deliverAt: string;
  delivered: boolean;
  deliveredAt: string | null;
  createdAt: string;
}

interface MineResponse {
  received: GiftRow[];
  sentPending: GiftRow[];
  justArrived: GiftRow[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function senderLabel(g: GiftRow): string {
  return g.senderUser ?? 'Mamma';
}

// `YYYY-MM-DD` for tomorrow — the min/default for the date picker so a kid can't
// "schedule" something in the past.
function tomorrowYMD(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function SendGiftPanel({
  balanceCents,
  onSent,
}: {
  balanceCents: number | null;
  onSent?: () => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [toUser, setToUser] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'now' | 'date'>('now');
  const [deliverDate, setDeliverDate] = useState(tomorrowYMD());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mine, setMine] = useState<MineResponse | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch('/api/money/gift/mine');
      if (res.ok) {
        const data = (await res.json()) as MineResponse;
        setMine(data);
      }
    } catch {
      // non-fatal — the panel still works for sending
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/money/gift/recipients');
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { recipients: Recipient[] };
          setRecipients(data.recipients ?? []);
        }
      } catch {
        // ignore — kid can still type a username
      }
    })();
    void loadMine();
    return () => {
      cancelled = true;
    };
  }, [loadMine]);

  const amountCents = useMemo(() => dollarsInputToCents(amountText), [amountText]);
  const overspend =
    balanceCents !== null && amountCents !== null && amountCents > balanceCents;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!toUser) {
      setError('Pick who to send to.');
      return;
    }
    if (amountCents === null || amountCents <= 0) {
      setError('Enter how much MP to send.');
      return;
    }
    if (overspend) {
      setError("That's more MP than you have.");
      return;
    }

    let deliverAt: string | undefined;
    if (mode === 'date') {
      // Deliver at the start of the chosen local day.
      const d = new Date(`${deliverDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) {
        setError('Pick a valid date.');
        return;
      }
      deliverAt = d.toISOString();
    }

    setBusy(true);
    try {
      const res = await fetch('/api/money/gift/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toUser,
          cents: amountCents,
          note: note.trim() || undefined,
          deliverAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        scheduled?: boolean;
        deliverAt?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        const who = recipients.find((r) => r.name === toUser)?.displayName ?? toUser;
        setSuccess(
          data.scheduled
            ? `🎁 ${centsToMP(amountCents)} will arrive for ${who} on ${data.deliverAt ? formatDate(data.deliverAt) : 'the chosen day'}!`
            : `🎁 Sent ${centsToMP(amountCents)} to ${who}!`,
        );
        setAmountText('');
        setNote('');
        setToUser('');
        setMode('now');
        void loadMine();
        onSent?.();
      } else {
        setError(data.error || `Something went wrong (HTTP ${res.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8">
      <div className="bg-white rounded-2xl border-2 border-purple-100 shadow-sm p-5 sm:p-6">
        <h2 className="text-xl font-black text-purple-900 mb-1">🎁 Send a gift</h2>
        <p className="text-sm text-gray-600 mb-4">
          Share some MP with someone. It leaves your balance right away.
          {balanceCents !== null && (
            <>
              {' '}
              You have{' '}
              <span className="font-black text-purple-900">{centsToMP(balanceCents)}</span>.
            </>
          )}
        </p>

        {/* Just-arrived surprise */}
        {mine?.justArrived && mine.justArrived.length > 0 && (
          <div className="mb-4 bg-gradient-to-br from-yellow-50 to-purple-50 border-2 border-yellow-300 rounded-xl p-4 text-center">
            <div className="text-3xl mb-1">🎉</div>
            <div className="font-black text-purple-900">
              You got{' '}
              {mine.justArrived.length === 1
                ? `a gift of ${centsToMP(mine.justArrived[0].cents)}`
                : `${mine.justArrived.length} gifts`}
              !
            </div>
            {mine.justArrived.length === 1 && mine.justArrived[0].note && (
              <p className="text-purple-800 italic text-sm mt-1">
                &ldquo;{mine.justArrived[0].note}&rdquo;
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              From {senderLabel(mine.justArrived[0])}
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label htmlFor="gift-to" className="block text-sm font-medium text-purple-900 mb-1">
              Send to
            </label>
            {recipients.length > 0 ? (
              <select
                id="gift-to"
                value={toUser}
                onChange={(e) => setToUser(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2.5 bg-purple-50 text-purple-900"
              >
                <option value="">Pick someone…</option>
                {recipients.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="gift-to"
                type="text"
                value={toUser}
                onChange={(e) => setToUser(e.target.value)}
                placeholder="Their username"
                autoComplete="off"
                disabled={busy}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2.5 bg-purple-50 text-purple-900"
              />
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="gift-amount" className="block text-sm font-medium text-purple-900 mb-1">
              Amount (MP)
            </label>
            <input
              id="gift-amount"
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="e.g. 5 or 5.50"
              autoComplete="off"
              disabled={busy}
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2.5 bg-purple-50 text-purple-900 font-mono"
            />
            {overspend && (
              <p className="text-xs text-red-600 mt-1">
                That&apos;s more than your balance of {centsToMP(balanceCents ?? 0)}.
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label htmlFor="gift-note" className="block text-sm font-medium text-purple-900 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="gift-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Happy birthday!"
              maxLength={200}
              autoComplete="off"
              disabled={busy}
              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2.5 bg-purple-50 text-purple-900"
            />
          </div>

          {/* When */}
          <div>
            <span className="block text-sm font-medium text-purple-900 mb-1">When</span>
            <div className="flex flex-wrap gap-2">
              {(['now', 'date'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={busy}
                  className={
                    'text-sm font-bold px-3 py-1.5 rounded-full border transition-colors ' +
                    (mode === m
                      ? 'bg-purple-700 text-white border-purple-700'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50')
                  }
                >
                  {m === 'now' ? 'Send now' : 'Send on a date'}
                </button>
              ))}
            </div>
            {mode === 'date' && (
              <input
                type="date"
                value={deliverDate}
                min={tomorrowYMD()}
                onChange={(e) => setDeliverDate(e.target.value)}
                disabled={busy}
                className="mt-2 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900"
              />
            )}
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || overspend}
            className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-black px-6 py-3 rounded-xl transition-colors"
          >
            {busy ? 'Sending…' : '🎁 Send gift'}
          </button>
        </form>
      </div>

      {/* Received gifts */}
      {mine && mine.received.length > 0 && (
        <div className="mt-5">
          <h3 className="text-lg font-black text-purple-900 mb-2">Gifts you&apos;ve received</h3>
          <ul className="space-y-2">
            {mine.received.map((g) => (
              <li
                key={g.id}
                className="bg-white rounded-xl border border-purple-100 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    {formatDate(g.deliveredAt ?? g.deliverAt)} · from {senderLabel(g)}
                  </div>
                  {g.note && <div className="text-sm text-gray-900 truncate">&ldquo;{g.note}&rdquo;</div>}
                </div>
                <div className="font-black text-sm text-green-700 shrink-0">
                  +{centsToMP(g.cents)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scheduled gifts I've sent */}
      {mine && mine.sentPending.length > 0 && (
        <div className="mt-5">
          <h3 className="text-lg font-black text-purple-900 mb-2">Scheduled gifts you&apos;ve sent</h3>
          <ul className="space-y-2">
            {mine.sentPending.map((g) => (
              <li
                key={g.id}
                className="bg-white rounded-xl border border-dashed border-purple-200 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    Arrives {formatDate(g.deliverAt)} · to {g.recipientUser}
                  </div>
                  {g.note && <div className="text-sm text-gray-900 truncate">&ldquo;{g.note}&rdquo;</div>}
                </div>
                <div className="font-black text-sm text-purple-700 shrink-0">
                  {centsToMP(g.cents)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
