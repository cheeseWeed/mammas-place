// AskDadPanel — "🙋 Top me off" inline form + Dad's animated reply.
//
// Reused on /portal/money (context='portal') and /checkout (context='checkout').
// Server picks the outcome via /api/money/dad/ask; we show a "Dad is
// thinking…" animation for ~800ms before revealing the reply so the kid feels
// like Dad is mulling it over.
//
// **Not a real human.** Dad is automated. If a parent-approval queue ever
// re-enters the conversation, push back — the user explicitly rejected it.
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { centsToMP } from '@/lib/money/format';
import {
  DAD_AMOUNT_LABELS,
  DAD_GREETINGS,
  DAD_PROMPT_LABELS,
  DAD_SUBMIT_LABELS,
  pickPrompt,
} from '@/lib/money/dad-prompts';

type Outcome = 'yes_full' | 'yes_partial' | 'pickup_tab' | 'maybe_later' | 'no' | 'bad_luck' | 'greedy';
type Context = 'portal' | 'checkout';

interface DadResponse {
  outcome: Outcome;
  centsGranted: number;
  dadReply: string;
  balanceCents: number;
}

interface AskDadPanelProps {
  context: Context;
  // Optional shortfall passed only at checkout — enables Dad's pickup-tab outcome.
  shortfallCents?: number;
  // Cart total at checkout — Dad uses it to detect "asking for way more than
  // the cart can possibly cost" (greedy outcome).
  cartTotalCents?: number;
  // Bubbled up so the parent page can refresh balance / retry the order /
  // close the panel after a granted ask.
  onResult?: (result: DadResponse) => void;
  // When the parent wants to reset the form (e.g. after retrying an order).
  // Bump this number and the panel returns to the empty-form state.
  resetSignal?: number;
  // Defaults to a rotating Dad submit label. Checkout overrides to mention the tab.
  submitLabel?: string;
  // Prefill amount — checkout passes the shortfall so the kid doesn't have
  // to retype it.
  defaultAmountCents?: number;
}

const REASON_MAX = 200;
const AMOUNT_MIN_MP = 1;
// No real upper cap on the kid side — they can ask whatever they want.
// Server has a sanity cap (100,000 MP) and Dad's reward curve naturally
// rolls fewer yes_full as the ask gets bigger.
const AMOUNT_MAX_MP = 100_000;
const THINKING_MS = 800;

const OUTCOME_BADGE: Record<Outcome, { icon: string; label: string; tone: string }> = {
  yes_full:     { icon: '✅', label: 'Granted',            tone: 'bg-green-50 text-green-800 border-green-200' },
  yes_partial:  { icon: '⚖️', label: 'Partial',            tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  pickup_tab:   { icon: '💳', label: 'Tab covered',        tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  maybe_later:  { icon: '🕐', label: 'Try again later',    tone: 'bg-slate-50 text-slate-700 border-slate-200' },
  no:           { icon: '❌', label: 'No',                 tone: 'bg-rose-50 text-rose-800 border-rose-200' },
  bad_luck:     { icon: '🎲', label: 'Better luck later',  tone: 'bg-purple-50 text-purple-800 border-purple-200' },
  greedy:       { icon: '👀', label: 'Nice try',           tone: 'bg-orange-50 text-orange-800 border-orange-200' },
};

export function AskDadPanel({
  context,
  shortfallCents,
  cartTotalCents,
  onResult,
  resetSignal,
  submitLabel,
  defaultAmountCents,
}: AskDadPanelProps) {
  const [reason, setReason] = useState('');
  const [amountMp, setAmountMp] = useState<string>(() => {
    if (defaultAmountCents && defaultAmountCents > 0) {
      // Use the exact shortfall in MP (2 decimals). No round-up needed —
      // input supports decimals so a 7.50 shortfall prefills as "7.50".
      const mp = Math.min(AMOUNT_MAX_MP, Math.max(AMOUNT_MIN_MP, defaultAmountCents / 100));
      return mp.toFixed(2);
    }
    return '5';
  });
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DadResponse | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  // Rotating prompts — picked once per mount so the kid sees a different
  // form each time they open the panel. Defaults to first item on the
  // server (so SSR is deterministic), then re-rolls after hydration.
  const [greeting, setGreeting] = useState<string>(DAD_GREETINGS[0]);
  const [promptLabel, setPromptLabel] = useState<string>(DAD_PROMPT_LABELS[0]);
  const [amountLabel, setAmountLabel] = useState<string>(DAD_AMOUNT_LABELS[0]);
  const [rotatedSubmit, setRotatedSubmit] = useState<string>(DAD_SUBMIT_LABELS[0]);
  useEffect(() => {
    setGreeting(pickPrompt(DAD_GREETINGS));
    setPromptLabel(pickPrompt(DAD_PROMPT_LABELS));
    setAmountLabel(pickPrompt(DAD_AMOUNT_LABELS));
    setRotatedSubmit(pickPrompt(DAD_SUBMIT_LABELS));
    // Re-roll only on mount (and resetSignal below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when the parent bumps resetSignal (e.g. after a retried order).
  // Also re-roll the rotating prompts so the kid sees a fresh form.
  useEffect(() => {
    if (resetSignal === undefined) return;
    setReason('');
    setError(null);
    setResult(null);
    setThinking(false);
    setBusy(false);
    setGreeting(pickPrompt(DAD_GREETINGS));
    setPromptLabel(pickPrompt(DAD_PROMPT_LABELS));
    setAmountLabel(pickPrompt(DAD_AMOUNT_LABELS));
    setRotatedSubmit(pickPrompt(DAD_SUBMIT_LABELS));
  }, [resetSignal]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Tell Dad what you need it for.');
      reasonRef.current?.focus();
      return;
    }
    const mp = Number(amountMp);
    if (!Number.isFinite(mp) || mp < AMOUNT_MIN_MP || mp > AMOUNT_MAX_MP) {
      setError(`Pick an amount between ${AMOUNT_MIN_MP} and ${AMOUNT_MAX_MP} MP.`);
      return;
    }
    // Round to 2 decimal places (cents precision) so an input like 24.327
    // becomes 24.33, and 24.3 becomes 24.30. Math.round on cents handles
    // floating-point drift.
    const centsAsked = Math.round(mp * 100);

    setBusy(true);
    setThinking(true);

    // Fire the request and the 800ms "thinking" delay in parallel — reveal
    // the result whenever both have finished, so a slow API doesn't make the
    // animation feel laggy and a fast API doesn't skip the suspense.
    const startedAt = Date.now();
    try {
      const res = await fetch('/api/money/dad/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          centsAsked,
          reason: trimmed,
          context,
          shortfallCents: context === 'checkout' ? shortfallCents : undefined,
          cartTotalCents: context === 'checkout' ? cartTotalCents : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<DadResponse> & { error?: string };

      const elapsed = Date.now() - startedAt;
      if (elapsed < THINKING_MS) {
        await new Promise((r) => setTimeout(r, THINKING_MS - elapsed));
      }

      if (!res.ok || !data.outcome || !data.dadReply) {
        setThinking(false);
        setError(data.error || `Something went wrong (HTTP ${res.status}).`);
        return;
      }
      const finalResult: DadResponse = {
        outcome: data.outcome,
        centsGranted: data.centsGranted ?? 0,
        dadReply: data.dadReply,
        balanceCents: data.balanceCents ?? 0,
      };
      setThinking(false);
      setResult(finalResult);
      onResult?.(finalResult);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  // After-result view — show Dad's reply card with the amount + outcome.
  if (result) {
    const badge = OUTCOME_BADGE[result.outcome];
    const granted = result.centsGranted > 0;
    return (
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl shrink-0"
            aria-hidden
          >
            👨
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-purple-700/70 mb-1">
              Dad says
            </div>
            <div className="relative bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-md px-4 py-3 text-purple-950 text-sm sm:text-base font-medium">
              {result.dadReply}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] uppercase font-bold tracking-wide px-2.5 py-1 rounded-full border ${badge.tone}`}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </span>
              {granted ? (
                <span className="inline-flex items-center gap-1 text-sm font-black text-green-700">
                  +{centsToMP(result.centsGranted)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-500">
                  0 MP this time
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setReason('');
              setError(null);
              setResult(null);
            }}
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            Ask again
          </button>
          {granted && (
            <span className="self-center text-xs text-gray-500">
              Your balance is now{' '}
              <span className="font-black text-purple-900">{centsToMP(result.balanceCents)}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl shrink-0"
          aria-hidden
        >
          👨
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-purple-700/70">
            {context === 'checkout' ? 'Ask Dad to pick up the tab' : 'Ask Dad for MP'}
          </div>
          <p className="text-sm text-gray-700">
            <span className="font-bold italic text-purple-900">&ldquo;{greeting}&rdquo;</span>{' '}
            <span className="text-gray-500">— Dad</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="dad-reason" className="block text-xs font-bold uppercase tracking-wide text-purple-900 mb-1">
            {promptLabel}
          </label>
          <textarea
            id="dad-reason"
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder="e.g. saving for the unicorn plush, finished my chores today"
            rows={2}
            maxLength={REASON_MAX}
            disabled={busy || thinking}
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50/50 text-purple-950 text-sm"
          />
          <div className="text-[11px] text-gray-500 text-right">
            {reason.length}/{REASON_MAX}
          </div>
        </div>

        <div>
          <label htmlFor="dad-amount" className="block text-xs font-bold uppercase tracking-wide text-purple-900 mb-1">
            {amountLabel} ({AMOUNT_MIN_MP}–{AMOUNT_MAX_MP} MP)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="dad-amount"
              type="number"
              inputMode="numeric"
              min={AMOUNT_MIN_MP}
              max={AMOUNT_MAX_MP}
              step="0.01"
              value={amountMp}
              onChange={(e) => setAmountMp(e.target.value)}
              disabled={busy || thinking}
              className="w-28 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-3 py-2 bg-purple-50/50 text-purple-950 text-base font-black text-center"
            />
            <span className="text-sm text-gray-600 font-bold">MP</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || thinking}
          className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-black px-5 py-2.5 rounded-xl transition-colors"
        >
          {thinking ? 'Asking Dad…' : busy ? 'Sending…' : (submitLabel || rotatedSubmit)}
        </button>
        {thinking && (
          <div className="flex items-center gap-1.5 text-sm text-purple-700" aria-live="polite">
            <span className="text-lg" aria-hidden>👨</span>
            <span className="italic">Dad is thinking</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-700 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-700 animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-700 animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
          </div>
        )}
      </div>
    </form>
  );
}
