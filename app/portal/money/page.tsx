// Kid's MP Money page — balance hero, per-section earnings, recent orders,
// and a filterable transactions list. Phase 5 of MP Money (see app/money/PLAN.md).
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

// Server-authoritative shapes — keep loose; API returns Prisma rows as JSON.
interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  priceCents: number;
}
interface OrderRow {
  id: string;
  items: unknown; // Prisma Json — narrow at render time
  totalCents: number;
  status: string;
  createdAt: string;
}
interface TransactionRow {
  id: string;
  cents: number;
  type: string;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

interface PerSection {
  math: number;
  spelling: number;
  languageArts: number;
  geography: number;
  drive: number;
  chess: number;
}

interface WalletSummary {
  balanceCents: number;
  perSection: PerSection;
  recent: { transactions: TransactionRow[]; orders: OrderRow[] };
  streakDays: number;
}

// Coerce the Json items column into a typed array — drop anything malformed
// rather than crashing the page on a single bad row.
function parseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((i): i is OrderItem =>
    typeof i === 'object' && i !== null
      && typeof (i as OrderItem).name === 'string'
      && typeof (i as OrderItem).qty === 'number'
      && typeof (i as OrderItem).priceCents === 'number',
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Per-section grid metadata — order, label, emoji. Lives here (not in the
// API) because it's purely UI presentation.
const SECTION_TILES: ReadonlyArray<{ key: keyof PerSection; label: string; emoji: string }> = [
  { key: 'math', label: 'Math', emoji: '🧮' },
  { key: 'spelling', label: 'Spelling', emoji: '🔤' },
  { key: 'languageArts', label: 'Language Arts', emoji: '📖' },
  { key: 'geography', label: 'Geography', emoji: '🌍' },
  { key: 'drive', label: 'Drive', emoji: '🚗' },
  { key: 'chess', label: 'Chess', emoji: '♟️' },
];

type TxFilter = 'all' | 'earn' | 'spend' | 'gift';

const FILTER_CHIPS: ReadonlyArray<{ key: TxFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'earn', label: 'Earnings' },
  { key: 'spend', label: 'Purchases' },
  { key: 'gift', label: 'Gifts' },
];

export default function PortalMoneyPage() {
  const { learner, balanceCents, loading, logout } = useLearner();
  const router = useRouter();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  useEffect(() => {
    if (!learner) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/money/wallet-summary?user=${encodeURIComponent(learner)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as WalletSummary;
          setSummary(data);
        } else {
          // Treat missing record as empty wallet, not an error.
          setSummary({
            balanceCents: 0,
            perSection: {
              math: 0, spelling: 0, languageArts: 0, geography: 0, drive: 0, chess: 0,
            },
            recent: { transactions: [], orders: [] },
            streakDays: 0,
          });
        }
      } catch {
        if (!cancelled) setFetchError('Could not load your history. Try again in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learner]);

  // Filter the transactions client-side — list is capped at 50, so no need
  // to re-hit the server for each chip.
  const filteredTxns = useMemo(() => {
    if (!summary) return null;
    if (txFilter === 'all') return summary.recent.transactions;
    return summary.recent.transactions.filter((t) => t.type === txFilter);
  }, [summary, txFilter]);

  // Not-logged-in state — friendly card with login link.
  if (!loading && learner === null) {
    return (
      <div className="min-h-[calc(100vh-260px)] px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-2xl font-black text-purple-900 mb-2">Log in to see your MP Money</h1>
          <p className="text-sm text-gray-700 mb-6">
            MP Money is your closed-loop store credit. Log in to see your balance, orders, and history.
          </p>
          <Link
            href="/shop/login"
            className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  const orders = summary?.recent.orders ?? null;
  const streakDays = summary?.streakDays ?? 0;

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-3xl mx-auto">
      {/* Hero balance card */}
      <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-yellow-300 text-sm font-bold uppercase tracking-wide mb-1">
              MP Money
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">
              Hi, {learner ?? '...'}!
            </h1>
            <p className="text-purple-100 text-sm sm:text-base">Your balance is</p>
            <div className="text-4xl sm:text-5xl font-black text-yellow-300 mt-1">
              {balanceCents === null ? '—' : centsToMP(balanceCents)}
            </div>
            {streakDays >= 2 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-yellow-300/20 text-yellow-200 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300/40">
                <span>🔥</span>
                <span>Earning streak: {streakDays} days in a row</span>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs bg-purple-700 hover:bg-purple-600 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Sign out
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/shop"
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2 rounded-xl transition-colors"
          >
            🛍️ Shop
          </Link>
          <Link
            href="/drive"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            🚗 Drive
          </Link>
          <Link
            href="/portal/money/card"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            💳 My MP card
          </Link>
          <Link
            href="/portal/money/redeem"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            🎁 Redeem a gift card
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {fetchError}
        </div>
      )}

      {/* Per-section earnings grid */}
      <section className="mb-8">
        <h2 className="text-xl font-black text-purple-900 mb-3">Earned by section</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SECTION_TILES.map((tile) => {
            const cents = summary?.perSection[tile.key] ?? 0;
            const isLoading = summary === null;
            return (
              <div
                key={tile.key}
                className="bg-white rounded-xl border border-purple-100 px-3 py-3 shadow-sm flex items-center gap-3"
              >
                <div className="text-2xl shrink-0" aria-hidden>{tile.emoji}</div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase font-bold tracking-wide text-purple-700/70 truncate">
                    {tile.label}
                  </div>
                  <div className={`font-black text-base ${cents > 0 ? 'text-purple-900' : 'text-gray-400'}`}>
                    {isLoading ? '—' : centsToMP(cents)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent orders */}
      <section className="mb-8">
        <h2 className="text-xl font-black text-purple-900 mb-3">Recent orders</h2>
        {orders === null ? (
          <div className="bg-white rounded-2xl border border-purple-100 p-6 text-sm text-gray-500">
            Loading...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-6 text-center">
            <p className="text-sm text-gray-700 mb-3">No orders yet. Go shopping ✨</p>
            <Link
              href="/shop"
              className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const items = parseItems(o.items);
              const itemsLabel = items.length
                ? items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ')
                : '(no items)';
              return (
                <li
                  key={o.id}
                  className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">{formatDate(o.createdAt)}</div>
                    <div className="text-sm text-gray-900 mt-0.5 break-words">{itemsLabel}</div>
                    {o.status !== 'fulfilled' && (
                      <div className="mt-1 inline-block text-[10px] uppercase font-bold tracking-wide bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded-full">
                        {o.status}
                      </div>
                    )}
                  </div>
                  <div className="text-purple-900 font-black text-base shrink-0">
                    {centsToMP(o.totalCents)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent transactions — with type filter chips */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-black text-purple-900">Recent transactions</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map((chip) => {
              const active = txFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setTxFilter(chip.key)}
                  className={
                    `text-xs font-bold px-3 py-1 rounded-full border transition-colors ` +
                    (active
                      ? 'bg-purple-700 text-white border-purple-700'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50')
                  }
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
        {filteredTxns === null ? (
          <div className="bg-white rounded-2xl border border-purple-100 p-6 text-sm text-gray-500">
            Loading...
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-6 text-center text-sm text-gray-700">
            {txFilter === 'all'
              ? 'No transactions yet'
              : `No ${FILTER_CHIPS.find((c) => c.key === txFilter)?.label.toLowerCase()} yet`}
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredTxns.map((t) => {
              const positive = t.cents >= 0;
              const amount = `${positive ? '+' : '-'}${centsToMP(Math.abs(t.cents))}`;
              return (
                <li
                  key={t.id}
                  className="bg-white rounded-xl border border-purple-100 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                      {formatDate(t.createdAt)} · <span className="capitalize">{t.type}</span>
                    </div>
                    <div className="text-sm text-gray-900 truncate">{t.reason}</div>
                  </div>
                  <div
                    className={`font-black text-sm shrink-0 ${positive ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {amount}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
