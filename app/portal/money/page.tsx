// Kid's MP Money page — balance hero + recent orders + recent transactions.
// Phase 5 of MP Money (see app/money/PLAN.md).
'use client';

import { useEffect, useState } from 'react';
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

export default function PortalMoneyPage() {
  const { learner, balanceCents, loading, logout } = useLearner();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [txns, setTxns] = useState<TransactionRow[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!learner) {
      setOrders(null);
      setTxns(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [oRes, tRes] = await Promise.all([
          fetch(`/api/money/orders?user=${encodeURIComponent(learner)}`),
          fetch(`/api/money/transactions?user=${encodeURIComponent(learner)}`),
        ]);
        if (cancelled) return;
        if (oRes.ok) {
          const data = (await oRes.json()) as { orders?: OrderRow[] };
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        } else {
          setOrders([]);
        }
        if (tRes.ok) {
          const data = (await tRes.json()) as { transactions?: TransactionRow[] };
          setTxns(Array.isArray(data.transactions) ? data.transactions : []);
        } else {
          setTxns([]);
        }
      } catch {
        if (!cancelled) setFetchError('Could not load your history. Try again in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learner]);

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

      {/* Recent transactions */}
      <section>
        <h2 className="text-xl font-black text-purple-900 mb-3">Recent transactions</h2>
        {txns === null ? (
          <div className="bg-white rounded-2xl border border-purple-100 p-6 text-sm text-gray-500">
            Loading...
          </div>
        ) : txns.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-6 text-center text-sm text-gray-700">
            No transactions yet
          </div>
        ) : (
          <ul className="space-y-2">
            {txns.map((t) => {
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
