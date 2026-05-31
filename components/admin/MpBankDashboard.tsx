'use client';

// Parent / MP Bank admin dashboard. Three sections:
//   1. Learner balances — top-up / deduct inline forms per kid
//   2. All recent orders — global feed
//   3. Per-kid transaction log — dropdown + table
//
// Auth is enforced server-side in app/admin/mp-bank/page.tsx. The endpoints
// this component calls are ALSO parent-gated, so any cookie expiry mid-session
// surfaces as a 401 (we redirect to /admin/mp-bank/login on that).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { centsToMP, dollarsInputToCents } from '@/lib/money/format';

// Inline display formatter — lib/money/card.ts is server-only (uses node:crypto)
// so we can't import it into this client component.
function formatCardLocal(n: string): string {
  return `MP·${n}`;
}

interface Learner {
  name: string;
  displayName: string | null;
  balanceCents: number;
  updatedAt: string;
  // Phase 6a — kid's MP account card number ("7821"). Null until first issued.
  mpCardNumber?: string | null;
}

interface OrderRow {
  id: string;
  userName: string;
  // items is JSON in DB — we only render a count summary, so accept unknown.
  items: unknown;
  totalCents: number;
  status: string;
  createdAt: string;
}

interface TransactionRow {
  id: string;
  userName: string;
  cents: number;
  type: string;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

type FormMode = 'topup' | 'deduct';

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function displayLabel(l: Learner): string {
  return l.displayName?.trim() || l.name;
}

// Best-effort items summary — works whether items is an array or a JSON value.
function itemsSummary(items: unknown): string {
  if (Array.isArray(items)) {
    const totalQty = items.reduce<number>((sum, it) => {
      if (it && typeof it === 'object' && 'qty' in it) {
        const q = (it as { qty?: unknown }).qty;
        return sum + (typeof q === 'number' ? q : 0);
      }
      return sum + 1;
    }, 0);
    const count = items.length;
    return totalQty && totalQty !== count
      ? `${count} line${count === 1 ? '' : 's'} · ${totalQty} item${totalQty === 1 ? '' : 's'}`
      : `${count} item${count === 1 ? '' : 's'}`;
  }
  return '—';
}

export default function MpBankDashboard() {
  const router = useRouter();

  const [learners, setLearners] = useState<Learner[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [learnersError, setLearnersError] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Inline form state — only one open at a time keeps the page calm.
  const [openForm, setOpenForm] = useState<{ user: string; mode: FormMode } | null>(
    null,
  );
  const [formAmount, setFormAmount] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Card reroll — track which learner is currently being rerolled so we can
  // disable just that row's button while the request is in flight. Errors
  // surface in the same pinToast (renamed conceptually to "admin toast" but
  // kept under the existing state to avoid more boilerplate).
  const [rerollBusy, setRerollBusy] = useState<string | null>(null);

  // Settings panel (collapsible) — change parent PIN.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  // Toast: ephemeral feedback for the PIN rotation. Auto-dismisses after ~3s.
  const [pinToast, setPinToast] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);

  useEffect(() => {
    if (!pinToast) return;
    const t = window.setTimeout(() => setPinToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [pinToast]);

  // Centralised 401 handling: any parent-gated endpoint that comes back 401
  // means the cookie expired or was cleared — bounce to login.
  const handleUnauth = useCallback(() => {
    router.push('/admin/mp-bank/login');
  }, [router]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    setLearnersError(null);
    try {
      const res = await fetch('/api/money/admin/learners', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { learners?: Learner[] };
      setLearners(Array.isArray(data.learners) ? data.learners : []);
    } catch (err) {
      setLearnersError(err instanceof Error ? err.message : 'Failed to load learners');
    } finally {
      setLearnersLoading(false);
    }
  }, [handleUnauth]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch('/api/money/admin/orders', { cache: 'no-store' });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders?: OrderRow[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [handleUnauth]);

  const loadTransactions = useCallback(
    async (user: string) => {
      if (!user) {
        setTransactions([]);
        return;
      }
      setTxLoading(true);
      setTxError(null);
      try {
        const res = await fetch(
          `/api/money/transactions?user=${encodeURIComponent(user)}&limit=100`,
          { cache: 'no-store' },
        );
        if (res.status === 401) {
          handleUnauth();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { transactions?: TransactionRow[] };
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } catch (err) {
        setTxError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setTxLoading(false);
      }
    },
    [handleUnauth],
  );

  useEffect(() => {
    loadLearners();
    loadOrders();
  }, [loadLearners, loadOrders]);

  useEffect(() => {
    loadTransactions(selectedUser);
  }, [selectedUser, loadTransactions]);

  const learnerLookup = useMemo(() => {
    const m = new Map<string, Learner>();
    for (const l of learners) m.set(l.name, l);
    return m;
  }, [learners]);

  const openTopUp = (user: string) => {
    setOpenForm({ user, mode: 'topup' });
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };
  const openDeduct = (user: string) => {
    setOpenForm({ user, mode: 'deduct' });
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };
  const closeForm = () => {
    setOpenForm(null);
    setFormAmount('');
    setFormReason('');
    setFormError(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openForm) return;
    const cents = dollarsInputToCents(formAmount);
    if (cents === null || cents <= 0) {
      setFormError('Enter a valid amount (e.g. 2.50).');
      return;
    }
    const reason = formReason.trim();
    if (!reason) {
      setFormError('Reason required.');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const endpoint = openForm.mode === 'topup' ? '/api/money/credit' : '/api/money/debit';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: openForm.user, cents, reason }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        balanceCents?: unknown;
      };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setFormError(msg);
        return;
      }
      // Refresh the learner row's balance + any transaction view that's open.
      closeForm();
      await loadLearners();
      if (selectedUser === openForm.user) {
        await loadTransactions(selectedUser);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setFormBusy(false);
    }
  };

  const rerollCard = async (userName: string, label: string) => {
    // Two-step confirm so a stray click can't silently nuke a kid's printed
    // card. window.confirm is fine here — the dashboard is parent-only and
    // the action's reversible (just print a new card).
    if (!window.confirm(
      `Reroll ${label}'s MP card number? Any printed cards with the old number stop working as identifiers.`,
    )) {
      return;
    }
    setRerollBusy(userName);
    try {
      const res = await fetch('/api/money/card/reroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userName }),
      });
      if (res.status === 401) {
        handleUnauth();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        formatted?: unknown;
      };
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: `Reroll failed: ${msg}` });
        return;
      }
      const formatted = typeof data.formatted === 'string' ? data.formatted : '';
      setPinToast({
        kind: 'success',
        message: `${label}'s new card: ${formatted}`,
      });
      // Refresh so the row shows the new number.
      await loadLearners();
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setRerollBusy(null);
    }
  };

  const submitPinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinCurrent)) {
      setPinToast({ kind: 'error', message: 'Current PIN must be exactly 4 digits.' });
      return;
    }
    if (!/^\d{4}$/.test(pinNew)) {
      setPinToast({ kind: 'error', message: 'New PIN must be exactly 4 digits.' });
      return;
    }
    if (pinNew !== pinConfirm) {
      setPinToast({ kind: 'error', message: 'New PIN and confirmation do not match.' });
      return;
    }
    if (pinNew === pinCurrent) {
      setPinToast({ kind: 'error', message: 'New PIN must be different from current PIN.' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch('/api/money/parent/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPin: pinCurrent, newPin: pinNew }),
      });
      if (res.status === 401) {
        // Could be wrong current PIN OR cookie expired. The route returns
        // 'Parent login required' for the latter; bounce to login in that case.
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof data.error === 'string' ? data.error : 'Unauthorized.';
        if (msg === 'Parent login required') {
          handleUnauth();
          return;
        }
        setPinToast({ kind: 'error', message: msg });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
        setPinToast({ kind: 'error', message: msg });
        return;
      }
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
      setPinToast({ kind: 'success', message: 'PIN updated.' });
    } catch (err) {
      setPinToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setPinBusy(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/money/parent/login', { method: 'DELETE' });
    } catch {
      // Cookie clear is best-effort; redirect regardless so they can't keep
      // poking the dashboard from a stale tab.
    }
    router.push('/admin/mp-bank/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-yellow-50">
      <header className="bg-purple-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-yellow-300">
              <span className="text-purple-900 font-black text-sm">MP</span>
            </div>
            <div>
              <h1 className="font-black text-xl leading-tight">Parent / MP Bank</h1>
              <p className="text-yellow-200 text-xs">
                Family store-credit admin (separate from staff portal)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Section 1: Learner balances */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-purple-900">Learner balances</h2>
            <button
              type="button"
              onClick={loadLearners}
              disabled={learnersLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {learnersError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {learnersError}
            </div>
          )}

          {learnersLoading ? (
            <p className="text-purple-700 text-sm">Loading learners…</p>
          ) : learners.length === 0 ? (
            <p className="text-purple-700 text-sm">
              No learners yet. They&apos;ll show up here after first login.
            </p>
          ) : (
            <ul className="divide-y divide-purple-100">
              {learners.map((l) => {
                const isOpen = openForm?.user === l.name;
                const isRerolling = rerollBusy === l.name;
                const cardLabel = l.mpCardNumber
                  ? formatCardLocal(l.mpCardNumber)
                  : 'No card yet';
                return (
                  <li key={l.name} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-purple-900 text-lg">
                          {displayLabel(l)}
                        </div>
                        <div className="text-xs text-purple-600">
                          @{l.name} · updated {formatShortDateTime(l.updatedAt)}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-block text-xs font-mono px-2 py-0.5 rounded-full ${
                              l.mpCardNumber
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-gray-100 text-gray-600 italic'
                            }`}
                          >
                            {cardLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => rerollCard(l.name, displayLabel(l))}
                            disabled={isRerolling}
                            className="text-xs text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
                            title="Generate a new card number — use if the old one leaked"
                          >
                            {isRerolling ? 'Rerolling…' : '🎲 Reroll card'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-black text-2xl text-purple-900 tabular-nums">
                          {centsToMP(l.balanceCents)}
                        </div>
                        <button
                          type="button"
                          onClick={() => openTopUp(l.name)}
                          className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors"
                        >
                          Top up
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeduct(l.name)}
                          className="bg-yellow-100 hover:bg-yellow-200 text-purple-900 font-bold px-3 py-2 rounded-xl text-sm border-2 border-yellow-300 transition-colors"
                        >
                          Deduct
                        </button>
                      </div>
                    </div>

                    {isOpen && openForm && (
                      <form
                        onSubmit={submitForm}
                        className="mt-4 bg-purple-50 rounded-xl p-4 border border-purple-200"
                      >
                        <div className="font-semibold text-purple-900 mb-3 text-sm">
                          {openForm.mode === 'topup'
                            ? `Top up ${displayLabel(l)}`
                            : `Deduct from ${displayLabel(l)}`}
                        </div>
                        <div className="grid sm:grid-cols-[140px_1fr_auto] gap-3 items-start">
                          <div>
                            <label className="block text-xs font-medium text-purple-900 mb-1">
                              Amount ($)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formAmount}
                              onChange={(e) => setFormAmount(e.target.value)}
                              placeholder="2.50"
                              disabled={formBusy}
                              autoFocus
                              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-purple-900 mb-1">
                              Reason
                            </label>
                            <input
                              type="text"
                              value={formReason}
                              onChange={(e) => setFormReason(e.target.value)}
                              placeholder="Chores, birthday gift, correction…"
                              maxLength={200}
                              disabled={formBusy}
                              className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900"
                            />
                          </div>
                          <div className="flex gap-2 sm:pt-5">
                            <button
                              type="submit"
                              disabled={formBusy}
                              className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                            >
                              {formBusy
                                ? 'Saving…'
                                : openForm.mode === 'topup'
                                  ? 'Add'
                                  : 'Deduct'}
                            </button>
                            <button
                              type="button"
                              onClick={closeForm}
                              disabled={formBusy}
                              className="text-purple-700 hover:text-purple-900 underline text-sm px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {formError && (
                          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {formError}
                          </div>
                        )}
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Section 2: All recent orders */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-purple-900">All recent orders</h2>
            <button
              type="button"
              onClick={loadOrders}
              disabled={ordersLoading}
              className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {ordersError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {ordersError}
            </div>
          )}

          {ordersLoading ? (
            <p className="text-purple-700 text-sm">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="text-purple-700 text-sm">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-purple-700 border-b border-purple-100">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Kid</th>
                    <th className="py-2 pr-4 font-semibold">Items</th>
                    <th className="py-2 pr-4 font-semibold">Total</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {orders.map((o) => {
                    const kid = learnerLookup.get(o.userName);
                    const kidLabel = kid ? displayLabel(kid) : o.userName;
                    return (
                      <tr key={o.id} className="text-purple-900">
                        <td className="py-2 pr-4 font-medium">{kidLabel}</td>
                        <td className="py-2 pr-4">{itemsSummary(o.items)}</td>
                        <td className="py-2 pr-4 tabular-nums font-semibold">
                          {centsToMP(o.totalCents)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              o.status === 'cancelled'
                                ? 'inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800'
                                : o.status === 'pending'
                                  ? 'inline-block px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-900'
                                  : 'inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800'
                            }
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-purple-700">
                          {formatShortDateTime(o.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 3: Per-kid transaction log */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <h2 className="text-2xl font-bold text-purple-900 mb-4">
            Per-kid transaction log
          </h2>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label
                htmlFor="mp-tx-user"
                className="block text-xs font-medium text-purple-900 mb-1"
              >
                Pick a kid
              </label>
              <select
                id="mp-tx-user"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50 text-purple-900 min-w-[12rem]"
              >
                <option value="">— select a learner —</option>
                {learners.map((l) => (
                  <option key={l.name} value={l.name}>
                    {displayLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            {selectedUser && (
              <button
                type="button"
                onClick={() => loadTransactions(selectedUser)}
                disabled={txLoading}
                className="text-sm text-purple-700 hover:text-purple-900 underline disabled:opacity-50 pb-2"
              >
                Refresh
              </button>
            )}
          </div>

          {txError && (
            <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3 mb-4">
              {txError}
            </div>
          )}

          {!selectedUser ? (
            <p className="text-purple-700 text-sm">
              Pick a learner above to see their ledger.
            </p>
          ) : txLoading ? (
            <p className="text-purple-700 text-sm">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <p className="text-purple-700 text-sm">No transactions for this learner.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-purple-700 border-b border-purple-100">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {transactions.map((t) => {
                    const isCredit = t.cents >= 0;
                    return (
                      <tr key={t.id} className="text-purple-900">
                        <td className="py-2 pr-4 text-purple-700 whitespace-nowrap">
                          {formatShortDateTime(t.createdAt)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-900">
                            {t.type}
                          </span>
                        </td>
                        <td
                          className={`py-2 pr-4 tabular-nums font-bold ${
                            isCredit ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {isCredit ? '+' : '−'}
                          {centsToMP(Math.abs(t.cents))}
                        </td>
                        <td className="py-2 pr-4">{t.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 4: Settings — change parent PIN (collapsible) */}
        <section className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={settingsOpen}
          >
            <div>
              <h2 className="text-2xl font-bold text-purple-900">Settings</h2>
              <p className="text-xs text-purple-600 mt-1">
                Change the parent PIN that unlocks this dashboard.
              </p>
            </div>
            <span
              className={`text-purple-700 text-2xl leading-none transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              ⌃
            </span>
          </button>

          {settingsOpen && (
            <form
              onSubmit={submitPinChange}
              className="mt-5 bg-purple-50 rounded-xl p-4 border border-purple-200 max-w-xl"
            >
              <div className="font-semibold text-purple-900 mb-3 text-sm">
                Change parent PIN
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="pin-current"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    Current PIN
                  </label>
                  <input
                    id="pin-current"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    autoComplete="current-password"
                    value={pinCurrent}
                    onChange={(e) =>
                      setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    maxLength={4}
                    placeholder="• • • •"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.4em] text-center"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pin-new"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    New PIN
                  </label>
                  <input
                    id="pin-new"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    autoComplete="new-password"
                    value={pinNew}
                    onChange={(e) =>
                      setPinNew(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    maxLength={4}
                    placeholder="• • • •"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.4em] text-center"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pin-confirm"
                    className="block text-xs font-medium text-purple-900 mb-1"
                  >
                    Confirm new PIN
                  </label>
                  <input
                    id="pin-confirm"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    autoComplete="new-password"
                    value={pinConfirm}
                    onChange={(e) =>
                      setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    maxLength={4}
                    placeholder="• • • •"
                    disabled={pinBusy}
                    className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-white text-purple-900 tracking-[0.4em] text-center"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {pinBusy ? 'Saving…' : 'Update PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinCurrent('');
                    setPinNew('');
                    setPinConfirm('');
                  }}
                  disabled={pinBusy}
                  className="text-purple-700 hover:text-purple-900 underline text-sm"
                >
                  Clear
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      {/* Toast — fixed bottom-right, ephemeral feedback for PIN rotation */}
      {pinToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border-2 font-semibold text-sm ${
            pinToast.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-900'
              : 'bg-red-100 border-red-300 text-red-900'
          }`}
        >
          {pinToast.message}
        </div>
      )}
    </div>
  );
}
