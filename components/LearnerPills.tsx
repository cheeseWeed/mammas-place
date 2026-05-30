'use client';

// Homepage hero pills under the main CTAs.
//
// Three states:
// - Anonymous: "Log in for MP" + "See my MP"
// - Logged in: "Hi [name] · See my MP · Switch user"
//
// Switch user wipes the auth so the next kid can hop on (shared family
// laptop pattern, per user 2026-05-30).

import Link from 'next/link';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

const COOKIE_NAME = 'dl_user';

export default function LearnerPills() {
  const { learner, balanceCents, logout } = useLearner();

  const handleSwitchUser = () => {
    try {
      // Expire the cookie immediately (server set httpOnly:false so we can
      // overwrite it from JS).
      document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      // ignore
    }
    logout();
  };

  if (!learner) {
    return (
      <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 text-sm text-purple-100">
        <span>Earn MP by learning →</span>
        <Link
          href="/shop/login"
          className="bg-purple-900/40 hover:bg-purple-900/60 text-yellow-300 hover:text-yellow-200 font-bold px-3 py-1.5 rounded-full border border-yellow-300/50 transition-colors"
        >
          Log in for MP
        </Link>
        <Link
          href="/portal/money"
          className="bg-purple-900/40 hover:bg-purple-900/60 text-yellow-300 hover:text-yellow-200 font-bold px-3 py-1.5 rounded-full border border-yellow-300/50 transition-colors"
        >
          See my MP
        </Link>
      </div>
    );
  }

  const prettyName = learner.charAt(0).toUpperCase() + learner.slice(1);
  const balanceText = balanceCents === null ? '…' : centsToMP(balanceCents);

  return (
    <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 text-sm text-purple-100">
      <span className="bg-purple-900/40 text-yellow-200 font-bold px-3 py-1.5 rounded-full border border-yellow-300/50">
        👋 Hi {prettyName} · {balanceText}
      </span>
      <Link
        href="/portal/money"
        className="bg-purple-900/40 hover:bg-purple-900/60 text-yellow-300 hover:text-yellow-200 font-bold px-3 py-1.5 rounded-full border border-yellow-300/50 transition-colors"
      >
        See my MP
      </Link>
      <button
        type="button"
        onClick={handleSwitchUser}
        className="bg-purple-900/40 hover:bg-purple-900/60 text-yellow-300 hover:text-yellow-200 font-bold px-3 py-1.5 rounded-full border border-yellow-300/50 transition-colors"
      >
        Not you? Switch →
      </button>
    </div>
  );
}
