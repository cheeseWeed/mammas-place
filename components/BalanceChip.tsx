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

  // Chip is the link to the kid's own account page. Tap the chip → see balance,
  // orders, and earnings detail. Logout is a separate button so a tap won't sign
  // them out by accident.
  return (
    <div className="hidden sm:inline-flex items-center gap-2 bg-yellow-400 text-purple-900 font-bold text-xs rounded-full shadow">
      <Link
        href="/portal/money"
        className="flex items-center gap-2 pl-3 py-2 hover:text-purple-700 transition-colors"
        title="See my MP"
      >
        <span className="font-black">{amount}</span>
        <span className="opacity-70">·</span>
        <span className="capitalize max-w-[8ch] truncate">{learner}</span>
      </Link>
      <button
        type="button"
        onClick={logout}
        aria-label="Log out"
        title="Log out"
        className="pr-3 py-2 text-purple-900/70 hover:text-purple-900 font-black text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
