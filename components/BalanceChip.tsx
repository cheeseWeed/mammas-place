'use client';

// Header pill that shows MP Money balance for the logged-in kid, or a
// "Log in for MP" link when anonymous. Balance comes from LearnerContext
// (server-authoritative — never localStorage).

import Link from 'next/link';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

export default function BalanceChip() {
  const { learner, balanceCents, loading, logout } = useLearner();

  if (!learner) {
    return (
      <Link
        href="/shop/login"
        className="hidden sm:inline-flex items-center gap-1 bg-purple-800/60 hover:bg-purple-700 text-yellow-300 hover:text-yellow-200 font-bold text-xs px-3 py-2 rounded-full border border-yellow-300/40 transition-colors"
      >
        Log in for MP
      </Link>
    );
  }

  // Logged in but balance still loading — show name with placeholder amount.
  // centsToMP returns "X.YYMP" (e.g. "10.54MP", "10MP" for whole amounts).
  const amount = balanceCents === null ? (loading ? '…' : '—') : centsToMP(balanceCents);

  return (
    <div className="hidden sm:inline-flex items-center gap-2 bg-yellow-400 text-purple-900 font-bold text-xs px-3 py-2 rounded-full shadow">
      <span className="font-black">{amount}</span>
      <span className="opacity-70">·</span>
      <span className="capitalize max-w-[8ch] truncate" title={learner}>
        {learner}
      </span>
      <button
        type="button"
        onClick={logout}
        aria-label="Log out"
        title="Log out"
        className="ml-1 text-purple-900/70 hover:text-purple-900 font-black text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
