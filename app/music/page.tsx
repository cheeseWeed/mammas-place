'use client';

// Music practice hub — the kid's daily driver.
//
// Shows today's practice plan (how many lines to learn on each piece), lets
// the kid log a quality score (1-10, reviewed by a parent/ChatGPT first) and
// earn MP, tracks progress toward each piece's pass-off, and — if a challenge
// is active — shows the competition tracker with its deadline bonuses.
//
// The kid can add their own pieces. A parent passes pieces off and pays the
// gift cards from /admin/mp-bank. When a piece is polished to full points
// (best quality ≥ CERT_THRESHOLD), the kid can print their own certificate.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';
import { INSTRUMENTS, instrumentDisplay, type Instrument, type MusicPiece, type MusicChallenge } from '@/lib/music/types';
import type { DayPlan, PiecePlan } from '@/lib/music/plan';

// A piece is "certificate-worthy" once the kid has hit a great-sounding
// run-through (full / near-full points). Self-print unlocks at this score.
const CERT_THRESHOLD = 9;

interface MusicState {
  ok: true;
  user: string;
  today: string;
  profile: { pieces: MusicPiece[]; challenge?: MusicChallenge };
  plan: DayPlan;
  rewardCurve: { score: number; mp: number }[];
}

export default function MusicPage() {
  return (
    <LoginGate
      section="music"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-indigo-700">Loading…</div>
        </div>
      }
    >
      <MusicInner />
    </LoginGate>
  );
}

function MusicInner() {
  const { learner, refresh: refreshBalance } = useLearner();
  const [state, setState] = useState<MusicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [instFilter, setInstFilter] = useState<string>('all'); // 'all' | instrument value
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'in-progress'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/music/state', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) setState(data as MusicState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, learner]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  if (loading && !state) {
    return (
      <Shell>
        <div className="text-center text-indigo-700 py-20">Loading your music…</div>
      </Shell>
    );
  }

  const pieces = state?.profile.pieces ?? [];
  const plan = state?.plan;
  const challenge = state?.profile.challenge;
  const today = state?.today ?? '';

  // Distinct instruments across all pieces, for the filter chips.
  const instruments = Array.from(new Set(pieces.map((p) => p.instrument)));

  // A piece is "ready to perform" once it's passed off OR has hit a high-
  // quality run (best score ≥ CERT_THRESHOLD).
  const isPerformanceReady = (p: MusicPiece) =>
    !!p.passedOffAt || p.log.reduce((m, e) => Math.max(m, e.qualityScore), 0) >= CERT_THRESHOLD;

  const matchesStatus = (p: MusicPiece) =>
    statusFilter === 'all' ||
    (statusFilter === 'ready' ? isPerformanceReady(p) : !isPerformanceReady(p));

  // The plan only contains LIVE (non-archived) pieces. Apply instrument +
  // status filters on top for what the kid sees in the active list.
  const visiblePlanPieces = (plan?.pieces ?? []).filter((pp) => {
    const piece = pieces.find((p) => p.id === pp.pieceId);
    if (!piece) return false;
    if (instFilter !== 'all' && piece.instrument !== instFilter) return false;
    return matchesStatus(piece);
  });

  // Archived pieces (not in the plan), filtered the same way.
  const archivedVisible = pieces.filter(
    (p) => p.archived && (instFilter === 'all' || p.instrument === instFilter) && matchesStatus(p),
  );

  return (
    <Shell>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-900 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold">
          {toast}
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-6xl mb-3">🎻</div>
        <h1 className="text-4xl md:text-5xl font-black text-indigo-900 mb-2">Practice Studio</h1>
        <p className="text-lg text-indigo-700 max-w-2xl mx-auto">
          Follow your plan, play it through, then score how it sounded.
          The better it sounds, the more MP you earn — up to 100 MP a day per piece.
        </p>
      </div>

      <div className="text-center mb-8">
        <Link
          href="/music/calendar"
          className="inline-flex items-center gap-2 bg-white hover:bg-indigo-50 border-2 border-indigo-200 text-indigo-800 font-bold px-5 py-2 rounded-full text-sm transition-colors"
        >
          🗓️ See your practice calendar
        </Link>
      </div>

      {plan && pieces.length > 0 && (
        <DailyGoalBanner
          goal={plan.dailyLineGoal}
          source={plan.goalSource}
          mode={plan.goalMode}
          totalToday={plan.totalNewLinesToday}
          onSaved={async (msg) => { flash(msg); await load(); }}
        />
      )}

      {plan?.isPerformDay && (
        <div className="max-w-3xl mx-auto mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
          <span className="text-2xl">🎼</span>{' '}
          <span className="font-bold text-amber-900">It’s a performance day!</span>{' '}
          <span className="text-amber-800 text-sm">
            Play your finished pieces for family &amp; friends — and you can still log a score.
          </span>
        </div>
      )}

      {challenge && (
        <ChallengeCard challenge={challenge} pieces={pieces} today={today} />
      )}

      {pieces.length === 0 ? (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border-2 border-indigo-100 p-8 text-center shadow">
          <p className="text-indigo-800 font-semibold mb-2">No pieces yet.</p>
          <p className="text-gray-600 text-sm mb-4">Add the first song you’re learning to get started.</p>
        </div>
      ) : (
        <>
          {instruments.length > 1 && (
            <InstrumentFilter
              instruments={instruments}
              value={instFilter}
              onChange={setInstFilter}
            />
          )}

          <StatusFilter value={statusFilter} onChange={setStatusFilter} />

          <div className="max-w-3xl mx-auto space-y-5">
            {visiblePlanPieces.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-indigo-100 p-6 text-center text-gray-500">
                No active {instFilter !== 'all' ? instrumentDisplay(instFilter).label + ' ' : ''}songs right now.
              </div>
            ) : (
              visiblePlanPieces.map((pp) => {
                const piece = pieces.find((p) => p.id === pp.pieceId)!;
                return (
                  <PieceCard
                    key={pp.pieceId}
                    piece={piece}
                    plan={pp}
                    isCompetition={!!challenge?.pieceIds.includes(piece.id)}
                    rewardCurve={state!.rewardCurve}
                    onChanged={async (msg) => {
                      flash(msg);
                      await Promise.all([load(), refreshBalance()]);
                    }}
                  />
                );
              })
            )}
          </div>

          {archivedVisible.length > 0 && (
            <ArchivedSection
              pieces={archivedVisible}
              onChanged={async (msg) => { flash(msg); await load(); }}
            />
          )}
        </>
      )}

      <div className="max-w-3xl mx-auto mt-8">
        <AddPieceForm onAdded={async () => { await load(); flash('Piece added! 🎵'); }} />
      </div>

      <RewardCurveLegend curve={state?.rewardCurve ?? []} />

      <div className="max-w-3xl mx-auto mt-8 text-center">
        <Link
          href="/"
          className="inline-block bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-medium px-6 py-2 rounded-full transition-colors text-sm"
        >
          ← Back to Mamma&apos;s Place
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white py-12 px-4">
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}

// ----- Daily line goal -----

function DailyGoalBanner({
  goal,
  source,
  mode,
  totalToday,
  onSaved,
}: {
  goal?: number;
  source: 'set' | 'auto';
  mode: 'spread' | 'one-at-a-time';
  totalToday: number;
  onSaved: (msg: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal ?? totalToday ?? 4));
  const [pickMode, setPickMode] = useState<'spread' | 'one-at-a-time'>(mode);
  const [busy, setBusy] = useState(false);

  const save = async (g: number | null, m: 'spread' | 'one-at-a-time') => {
    setBusy(true);
    try {
      const res = await fetch('/api/music/goal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal: g, mode: m }),
      });
      const data = await res.json();
      if (!res.ok) { await onSaved(data.error ?? 'Could not save goal'); return; }
      setEditing(false);
      const modeWord = m === 'one-at-a-time' ? 'one song at a time' : 'all songs each day';
      await onSaved(g === null ? 'Goal cleared — back to auto pace.' : `Goal: ${data.dailyLineGoal} lines/day, ${modeWord}. 🎯`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mb-6 bg-white border-2 border-indigo-200 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <div>
            <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Daily goal</div>
            <div className="text-lg font-black text-indigo-900">
              {goal ? `${goal} lines a day` : `${totalToday} lines today`}
              <span className="ml-2 text-xs font-semibold text-gray-400">
                {source === 'set'
                  ? mode === 'one-at-a-time' ? '· one song at a time' : '· all songs each day'
                  : '(auto pace)'}
              </span>
            </div>
          </div>
        </div>
        {!editing ? (
          <button
            onClick={() => { setValue(String(goal ?? totalToday ?? 4)); setPickMode(mode); setEditing(true); }}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-4 py-2 rounded-full text-sm"
          >
            {goal ? 'Change goal' : 'Set a goal'}
          </button>
        ) : null}
      </div>

      {editing && (
        <div className="mt-4 border-t border-indigo-100 pt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-indigo-700">Lines per day:</span>
            <input
              type="number" step="0.5" min="0.5" value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 border border-indigo-200 rounded-lg px-2 py-1.5 text-indigo-900 text-sm"
            />
          </div>
          <div>
            <span className="text-sm font-bold text-indigo-700 block mb-1.5">How to spread it:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPickMode('one-at-a-time')}
                className={`px-3 py-2 rounded-xl text-sm font-bold text-left ${pickMode === 'one-at-a-time' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                🎯 One song at a time
                <span className="block text-[11px] font-normal opacity-80">Focus one piece until it&apos;s passed off</span>
              </button>
              <button
                onClick={() => setPickMode('spread')}
                className={`px-3 py-2 rounded-xl text-sm font-bold text-left ${pickMode === 'spread' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                🎼 All songs each day
                <span className="block text-[11px] font-normal opacity-80">A little of every piece daily</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => save(Number(value), pickMode)} disabled={busy} className="bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-300 text-white font-bold px-4 py-2 rounded-xl text-sm">
              {busy ? 'Saving…' : 'Save goal'}
            </button>
            {goal && (
              <button onClick={() => save(null, pickMode)} disabled={busy} className="text-gray-500 underline text-xs">
                Clear goal
              </button>
            )}
            <button onClick={() => setEditing(false)} className="text-gray-400 underline text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Challenge tracker -----

function ChallengeCard({
  challenge,
  pieces,
  today,
}: {
  challenge: MusicChallenge;
  pieces: MusicPiece[];
  today: string;
}) {
  const inChallenge = pieces.filter((p) => challenge.pieceIds.includes(p.id));
  const passed = inChallenge.filter((p) => p.passedOffAt).length;
  const total = inChallenge.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto mb-6 bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-xl md:text-2xl font-black">🏆 {challenge.name}</h2>
        <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
          ends {challenge.endDate}
        </span>
      </div>
      <div className="mb-2 text-sm text-violet-100">
        {passed} of {total} pieces passed off
      </div>
      <div className="w-full bg-white/20 rounded-full h-3 mb-4">
        <div className="bg-yellow-300 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <Bonus
          label="Each pass-off"
          value={centsToMP(challenge.passOffRewardCents)}
          met={passed > 0}
          sub="gift card per piece"
        />
        {challenge.finishAllBonusCents && (
          <Bonus
            label={`All done by ${challenge.finishAllBy}`}
            value={centsToMP(challenge.finishAllBonusCents)}
            met={!!challenge.finishAllAwardedAt}
            sub={challenge.finishAllAwardedAt ? 'earned! 🎉' : 'bonus'}
          />
        )}
        {challenge.playAllInOneDayBonusCents && (
          <Bonus
            label={`Play all well by ${challenge.playAllInOneDayBy}`}
            value={centsToMP(challenge.playAllInOneDayBonusCents)}
            met={!!challenge.playAllInOneDayAwardedAt}
            sub={
              challenge.playAllInOneDayAwardedAt
                ? 'earned! 🌟'
                : `all ≥ ${challenge.playAllInOneDayMinScore}/10 same day`
            }
          />
        )}
      </div>
      {today && today > challenge.endDate && (
        <p className="mt-3 text-xs text-violet-200">Challenge window has ended.</p>
      )}
    </div>
  );
}

function Bonus({ label, value, met, sub }: { label: string; value: string; met: boolean; sub: string }) {
  return (
    <div className={`rounded-xl p-3 ${met ? 'bg-yellow-300 text-indigo-900' : 'bg-white/10'}`}>
      <div className="font-black text-lg">{value}</div>
      <div className="text-xs font-semibold leading-tight">{label}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </div>
  );
}

// ----- One piece -----

function PieceCard({
  piece,
  plan,
  rewardCurve,
  isCompetition,
  onChanged,
}: {
  piece: MusicPiece;
  plan: PiecePlan;
  rewardCurve: { score: number; mp: number }[];
  isCompetition: boolean;
  onChanged: (msg: string) => void | Promise<void>;
}) {
  const [score, setScore] = useState(7);
  const [lines, setLines] = useState(plan.learned + Math.max(1, plan.linesPerDayTarget));
  const [reviewedBy, setReviewedBy] = useState('dad');
  const [busy, setBusy] = useState(false);

  const instrument = instrumentDisplay(piece.instrument);
  const progressPct = piece.estLines > 0 ? Math.round((plan.learned / piece.estLines) * 100) : 0;
  const wouldEarn = rewardCurve.find((r) => r.score === score)?.mp ?? 0;
  const certReady = plan.bestScore >= CERT_THRESHOLD;

  const log = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/music/practice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pieceId: piece.id,
          qualityScore: score,
          linesPracticed: lines,
          reviewedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await onChanged(data.error ?? 'Could not log practice');
        return;
      }
      if (data.reason === 'duplicate') {
        await onChanged('Already logged today — come back tomorrow! 🎵');
        return;
      }
      let msg = `+${centsToMP(data.centsEarned)} for ${piece.title}! ⭐`;
      if (Array.isArray(data.challengeBonuses) && data.challengeBonuses.length) {
        const bonus = data.challengeBonuses[0];
        msg += `  Plus ${centsToMP(bonus.cents)} bonus — ${bonus.name}! 🏆`;
      }
      await onChanged(msg);
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!confirm(`Archive "${piece.title}"? It moves to your Done list and leaves your daily plan (you keep the history).`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/music/archive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pieceId: piece.id, archived: true }),
      });
      const data = await res.json();
      await onChanged(res.ok ? `Archived "${piece.title}". 📥` : (data.error ?? 'Could not archive'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${piece.title}" completely? This removes it and its practice history. Use Archive instead if you just finished it.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/music/pieces?pieceId=${encodeURIComponent(piece.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      await onChanged(res.ok ? `Deleted "${piece.title}".` : (data.error ?? 'Could not delete'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-black text-indigo-900 leading-tight">
              {instrument.emoji} {piece.title}
            </h3>
            {isCompetition && (
              <span className="bg-violet-100 text-violet-700 text-[11px] font-bold px-2 py-0.5 rounded-full" title="Part of the competition">
                🏆 Competition
              </span>
            )}
            {(piece.passedOffAt || plan.bestScore >= CERT_THRESHOLD) && (
              <span className="bg-green-100 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full" title="Sounds performance-ready">
                🎤 Ready to perform
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {instrument.label} · {piece.difficulty} · {piece.estLines} lines
            {piece.targetDate && ` · target ${piece.targetDate}`}
          </p>
        </div>
        {piece.passedOffAt ? (
          <span className="shrink-0 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
            ✓ Passed off
          </span>
        ) : plan.onTrack ? (
          <span className="shrink-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            On track
          </span>
        ) : (
          <span className="shrink-0 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
            Push hard
          </span>
        )}
      </div>

      {/* progress bar */}
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>{plan.learned}/{piece.estLines} lines learned</span>
        <span>best {plan.bestScore || '—'}/10</span>
      </div>
      <div className="w-full bg-indigo-50 rounded-full h-2.5 mb-4">
        <div className="bg-indigo-500 h-2.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* today's focus */}
      <div className="bg-indigo-50 rounded-xl p-3 mb-4">
        <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1">Today’s plan</div>
        <div className="text-sm text-indigo-900 font-medium">{plan.todaysFocus}</div>
        {piece.pdfHref && (
          <a href={piece.pdfHref} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline mt-1 inline-block">
            Open sheet music ↗
          </a>
        )}
      </div>

      {/* score entry */}
      {plan.practicedToday ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-800 font-semibold">
          ✓ Logged today. Nice work — see you tomorrow!
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-indigo-700 mb-1">
              How did it sound today? <span className="font-black text-lg text-indigo-900">{score}/10</span>
            </label>
            <input
              type="range" min={1} max={10} step={1} value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
              <span>rough</span><span>okay</span><span>great!</span>
            </div>
            <p className="text-xs text-indigo-600 mt-1">
              That’s worth <span className="font-bold">{wouldEarn} MP</span> today.
            </p>
          </div>
          <div className="flex gap-3">
            <label className="flex-1 text-xs font-bold text-indigo-700">
              Lines reached today
              <input
                type="number" min={0} max={piece.estLines} value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm text-indigo-900"
              />
            </label>
            <label className="flex-1 text-xs font-bold text-indigo-700">
              Reviewed by
              <select
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm text-indigo-900"
              >
                <option value="dad">Dad</option>
                <option value="mom">Mom</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="self">Myself</option>
              </select>
            </label>
          </div>
          <button
            onClick={log}
            disabled={busy}
            className="w-full bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-300 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {busy ? 'Saving…' : `Log practice & earn ${wouldEarn} MP`}
          </button>
        </div>
      )}

      {/* certificate self-print when quality is high */}
      {certReady && (
        <Link
          href={`/music/certificate?piece=${encodeURIComponent(piece.id)}`}
          className="mt-3 block text-center bg-yellow-100 hover:bg-yellow-200 text-amber-900 font-bold py-2 rounded-xl transition-colors text-sm border border-yellow-300"
        >
          🏅 Print your certificate for “{piece.title}”
        </Link>
      )}

      {/* manage: archive (done) / delete */}
      <div className="mt-3 pt-3 border-t border-indigo-50 flex items-center justify-end gap-3 text-xs">
        <button onClick={archive} disabled={busy} className="text-indigo-600 hover:text-indigo-800 font-semibold">
          📥 Archive (done)
        </button>
        <button onClick={remove} disabled={busy} className="text-rose-500 hover:text-rose-700 font-semibold">
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ----- Instrument filter -----

function InstrumentFilter({
  instruments,
  value,
  onChange,
}: {
  instruments: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto mb-5 flex items-center gap-2 flex-wrap justify-center">
      <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Instrument:</span>
      <Chip label="All" active={value === 'all'} onClick={() => onChange('all')} />
      {instruments.map((inst) => {
        const d = instrumentDisplay(inst);
        return <Chip key={inst} label={`${d.emoji} ${d.label}`} active={value === inst} onClick={() => onChange(inst)} />;
      })}
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: 'all' | 'ready' | 'in-progress';
  onChange: (v: 'all' | 'ready' | 'in-progress') => void;
}) {
  return (
    <div className="max-w-3xl mx-auto mb-5 flex items-center gap-2 flex-wrap justify-center">
      <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Show:</span>
      <Chip label="All" active={value === 'all'} onClick={() => onChange('all')} />
      <Chip label="🎤 Ready to perform" active={value === 'ready'} onClick={() => onChange('ready')} />
      <Chip label="🎯 Still learning" active={value === 'in-progress'} onClick={() => onChange('in-progress')} />
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        active ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
      }`}
    >
      {label}
    </button>
  );
}

// ----- Archived / Done list -----

function ArchivedSection({
  pieces,
  onChanged,
}: {
  pieces: MusicPiece[];
  onChanged: (msg: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const unarchive = async (p: MusicPiece) => {
    const res = await fetch('/api/music/archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pieceId: p.id, archived: false }),
    });
    const data = await res.json().catch(() => ({}));
    await onChanged(res.ok ? `Brought "${p.title}" back. 🎵` : (data.error ?? 'Could not unarchive'));
  };

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-600 flex items-center justify-between"
      >
        <span>📥 Done / Archived ({pieces.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {pieces.map((p) => {
            const d = instrumentDisplay(p.instrument);
            const best = p.log.reduce((m, e) => Math.max(m, e.qualityScore), 0);
            return (
              <div key={p.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-700 text-sm">
                    {d.emoji} {p.title} {p.passedOffAt && '✅'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {d.label} · best {best || '—'}/10 · {p.log.length} practice day{p.log.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  {best >= CERT_THRESHOLD || p.passedOffAt ? (
                    <Link href={`/music/certificate?piece=${encodeURIComponent(p.id)}`} className="text-amber-700 font-semibold">🏅 Cert</Link>
                  ) : null}
                  <button onClick={() => unarchive(p)} className="text-indigo-600 font-semibold">↩ Restore</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- Add piece -----

const CUSTOM_INSTRUMENT = '__custom__';

function AddPieceForm({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instrument, setInstrument] = useState<Instrument>('cello');
  const [customInstrument, setCustomInstrument] = useState('');
  const [estLines, setEstLines] = useState(16);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!title.trim()) { setErr('Give it a title.'); return; }
    const resolvedInstrument = instrument === CUSTOM_INSTRUMENT ? customInstrument.trim() : instrument;
    if (!resolvedInstrument) { setErr('Name the instrument.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/music/pieces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, instrument: resolvedInstrument, estLines, difficulty, targetDate: targetDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Could not add'); return; }
      setTitle(''); setTargetDate(''); setCustomInstrument(''); setOpen(false);
      await onAdded();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white hover:bg-indigo-50 border-2 border-dashed border-indigo-300 text-indigo-700 font-bold py-3 rounded-2xl transition-colors"
      >
        + Add a piece I’m learning
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 p-5 shadow">
      <h3 className="font-black text-indigo-900 mb-3">Add a piece</h3>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="space-y-3">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title"
          className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-indigo-900"
        />
        <div className="grid grid-cols-2 gap-3">
          <select value={instrument} onChange={(e) => setInstrument(e.target.value as Instrument)} className="border border-indigo-200 rounded-lg px-2 py-2 text-indigo-900">
            {INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.emoji} {i.label}</option>)}
            <option value={CUSTOM_INSTRUMENT}>➕ Add new instrument…</option>
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} className="border border-indigo-200 rounded-lg px-2 py-2 text-indigo-900">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          {instrument === CUSTOM_INSTRUMENT && (
            <input
              value={customInstrument}
              onChange={(e) => setCustomInstrument(e.target.value)}
              placeholder="e.g. Ukulele, Harp…"
              className="col-span-2 border border-indigo-200 rounded-lg px-3 py-2 text-indigo-900"
            />
          )}
          <label className="text-xs font-bold text-indigo-700">
            Total lines
            <input type="number" min={1} value={estLines} onChange={(e) => setEstLines(Number(e.target.value))} className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-2 text-indigo-900" />
          </label>
          <label className="text-xs font-bold text-indigo-700">
            Pass off by (optional)
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-2 text-indigo-900" />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="flex-1 bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-300 text-white font-bold py-2 rounded-xl">
            {busy ? 'Adding…' : 'Add piece'}
          </button>
          <button onClick={() => setOpen(false)} className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardCurveLegend({ curve }: { curve: { score: number; mp: number }[] }) {
  if (!curve.length) return null;
  return (
    <div className="max-w-3xl mx-auto mt-8 bg-white rounded-2xl border border-indigo-100 p-4">
      <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-3 text-center">
        The better it sounds, the more you earn
      </div>
      <div className="flex items-end justify-between gap-1 h-24">
        {curve.map((c) => (
          <div key={c.score} className="flex-1 flex flex-col items-center justify-end">
            <div className="text-[9px] text-indigo-700 font-bold">{c.mp}</div>
            <div
              className="w-full bg-indigo-400 rounded-t"
              style={{ height: `${(c.mp / 100) * 100}%` }}
            />
            <div className="text-[9px] text-gray-400 mt-0.5">{c.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
