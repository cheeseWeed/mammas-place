'use client';

// Practice calendar — "what did each day look like."
//
// Defaults to the CHALLENGE WINDOW (start → end) when a challenge is active —
// the competition view the user asked for: the whole sprint in one continuous
// calendar, with start / deadlines / camp-day milestones pinned on. Falls back
// to month navigation when there's no challenge.
//
// Each day cell is colored by that day's average quality and shows MP earned.
// Click a day to see the per-piece breakdown (scores, lines, notes, pass-offs).
//
// All data comes from /api/music/state (full profile + challenge) — no new
// endpoint. A parent can view any kid via ?user= (state route enforces that).

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { centsToMP } from '@/lib/money/format';
import type { MusicPiece, MusicChallenge } from '@/lib/music/types';
import {
  summarizeByDay,
  buildRangeGrid,
  buildMonthGrid,
  rangeTotals,
  monthTotals,
  challengeMilestones,
  scoreColor,
  type DaySummary,
  type CalendarCell,
} from '@/lib/music/calendar';

interface MusicState {
  ok: true;
  user: string;
  today: string;
  profile: { pieces: MusicPiece[]; challenge?: MusicChallenge };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  return (
    <LoginGate
      section="music"
      loadingFallback={<Shell><div className="text-center text-indigo-700 py-20">Loading…</div></Shell>}
    >
      <Suspense fallback={<Shell><div className="text-center text-indigo-700 py-20">Loading…</div></Shell>}>
        <CalendarInner />
      </Suspense>
    </LoginGate>
  );
}

function CalendarInner() {
  const params = useSearchParams();
  const userParam = params.get('user');
  const [state, setState] = useState<MusicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DaySummary | null>(null);
  // 'challenge' = full sprint window; otherwise a YYYY-MM month string.
  const [view, setView] = useState<'challenge' | string>('challenge');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = userParam ? `?user=${encodeURIComponent(userParam)}` : '';
      const res = await fetch(`/api/music/state${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) setState(data as MusicState);
    } finally {
      setLoading(false);
    }
  }, [userParam]);

  useEffect(() => { void load(); }, [load]);

  const pieces = state?.profile.pieces ?? [];
  const challenge = state?.profile.challenge;
  const today = state?.today ?? '';
  const byDay = useMemo(() => summarizeByDay(pieces), [pieces]);

  // Default to challenge view if one exists; otherwise this month.
  useEffect(() => {
    if (state && !challenge && view === 'challenge') {
      setView((today || '2026-06-01').slice(0, 7));
    }
  }, [state, challenge, today, view]);

  if (loading && !state) {
    return <Shell><div className="text-center text-indigo-700 py-20">Loading your calendar…</div></Shell>;
  }

  const useChallengeView = view === 'challenge' && !!challenge;

  const grid = useChallengeView
    ? buildRangeGrid(challenge!.startDate, challenge!.endDate, byDay)
    : buildMonthGrid(view === 'challenge' ? (today || '2026-06-01').slice(0, 7) : view, byDay);
  const weeks = grid.weeks;
  const label = 'rangeLabel' in grid ? grid.rangeLabel : grid.monthLabel;

  const totals = useChallengeView
    ? rangeTotals(challenge!.startDate, challenge!.endDate, byDay)
    : monthTotals(view === 'challenge' ? (today || '2026-06-01').slice(0, 7) : view, byDay);

  const milestones = challenge ? challengeMilestones(challenge) : {};

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🗓️</div>
        <h1 className="text-3xl md:text-4xl font-black text-indigo-900 mb-1">Practice Calendar</h1>
        <p className="text-indigo-700">
          {useChallengeView ? 'Your whole competition window — day by day.' : 'How each day looked.'}
        </p>
      </div>

      {/* view toggle */}
      {challenge && (
        <div className="flex justify-center gap-2 mb-5">
          <button
            onClick={() => setView('challenge')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              useChallengeView ? 'bg-violet-700 text-white' : 'bg-white text-violet-700 border border-violet-200'
            }`}
          >
            🏆 Competition window
          </button>
          <button
            onClick={() => setView((today || '2026-06-01').slice(0, 7))}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              !useChallengeView ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200'
            }`}
          >
            By month
          </button>
        </div>
      )}

      {/* header strip */}
      <div className="max-w-4xl mx-auto mb-4 bg-white rounded-2xl border border-indigo-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-xl font-black text-indigo-900">{label}</h2>
          {!useChallengeView && <MonthNav view={view} today={today} onChange={setView} />}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          <Totl label="Practice days" value={`${totals.practiceDays}`} />
          <Totl label="MP earned" value={centsToMP(totals.totalCents)} />
          <Totl label="Pass-offs" value={`${totals.passOffs}`} />
          <Totl label="Avg quality" value={totals.avgScore ? `${totals.avgScore}/10` : '—'} />
        </div>
      </div>

      {/* the grid */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-indigo-100 p-3 md:p-4">
        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[11px] md:text-xs font-bold text-gray-400 uppercase">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 md:gap-2 mb-1 md:mb-2">
            {week.map((cell) => (
              <DayCell
                key={cell.date}
                cell={cell}
                isToday={cell.date === today}
                milestones={milestones[cell.date]}
                onClick={() => cell.summary && setSelected(cell.summary)}
              />
            ))}
          </div>
        ))}
        <Legend />
      </div>

      <div className="max-w-4xl mx-auto mt-6 text-center">
        <Link href={userParam ? `/admin/music` : '/music'} className="inline-block bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-medium px-6 py-2 rounded-full text-sm">
          ← Back to {userParam ? 'Music Admin' : 'Practice Studio'}
        </Link>
      </div>

      {selected && <DayDetail summary={selected} onClose={() => setSelected(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white py-10 px-3">
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}

function Totl({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl md:text-2xl font-black text-indigo-900">{value}</div>
      <div className="text-[10px] md:text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function DayCell({
  cell,
  isToday,
  milestones,
  onClick,
}: {
  cell: CalendarCell;
  isToday: boolean;
  milestones?: string[];
  onClick: () => void;
}) {
  const s = cell.summary;
  const color = scoreColor(s?.avgScore ?? 0);
  const dim = !cell.inMonth;
  const clickable = !!s;

  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={[
        'relative aspect-square rounded-lg p-1 md:p-1.5 text-left transition-all',
        dim ? 'opacity-30' : '',
        s ? `${color.bg} hover:ring-2 hover:ring-indigo-400 cursor-pointer` : cell.isWeekend ? 'bg-amber-50' : 'bg-gray-50',
        isToday ? 'ring-2 ring-indigo-600' : '',
        clickable ? '' : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <span className={`text-[10px] md:text-xs font-bold ${s ? color.text : 'text-gray-400'}`}>{cell.day}</span>
        {cell.isWeekend && !s && <span className="text-[8px] md:text-[9px]" title="Performance day">🎼</span>}
      </div>
      {s && (
        <div className="mt-0.5 md:mt-1">
          <div className={`text-sm md:text-lg font-black leading-none ${color.text}`}>{s.avgScore || ''}</div>
          <div className="text-[8px] md:text-[10px] text-gray-600 leading-tight">{centsToMP(s.totalCents)}</div>
          <div className="text-[9px] md:text-xs leading-none">
            {s.passOffs.length > 0 && '🏆'}
            {s.weeklyPassOffs.length > 0 && '🎓'}
          </div>
        </div>
      )}
      {milestones && milestones.length > 0 && (
        <div className="absolute bottom-0.5 right-0.5 text-[9px] md:text-[11px]" title={milestones.join(' · ')}>
          {milestones.map((m) => m.split(' ')[0]).join('')}
        </div>
      )}
    </button>
  );
}

function Legend() {
  const bands = [
    { c: 'bg-rose-100', t: 'rough' },
    { c: 'bg-amber-100', t: 'okay' },
    { c: 'bg-lime-100', t: 'good' },
    { c: 'bg-green-200', t: 'great!' },
  ];
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-100 text-[10px] md:text-xs text-gray-500">
      {bands.map((b) => (
        <span key={b.t} className="flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded ${b.c}`} /> {b.t}
        </span>
      ))}
      <span className="flex items-center gap-1">✅ passed off</span>
      <span className="flex items-center gap-1">🎼 perform day</span>
    </div>
  );
}

function MonthNav({ view, today, onChange }: { view: string; today: string; onChange: (m: string) => void }) {
  const month = view === 'challenge' ? (today || '2026-06-01').slice(0, 7) : view;
  const shift = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="flex gap-2">
      <button onClick={() => shift(-1)} className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">←</button>
      <button onClick={() => shift(1)} className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">→</button>
    </div>
  );
}

function DayDetail({ summary, onClose }: { summary: DaySummary; onClose: () => void }) {
  const pretty = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(summary.date + 'T00:00:00Z'));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-indigo-900 text-lg">{pretty}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="flex gap-4 mb-4 text-sm">
          <span className="font-bold text-indigo-900">{centsToMP(summary.totalCents)} earned</span>
          <span className="text-gray-600">avg {summary.avgScore}/10</span>
        </div>
        <div className="space-y-2">
          {summary.entries.map((e, i) => (
            <div key={i} className="bg-indigo-50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 text-sm">{e.title}{e.passedOff && ' ✅'}</span>
                <span className="text-indigo-700 font-black">{e.qualityScore}/10</span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {e.linesPracticed} lines · {centsToMP(e.centsEarned)}{e.reviewedBy && ` · reviewed by ${e.reviewedBy}`}
              </div>
              {e.note && <div className="text-xs text-gray-500 italic mt-1">“{e.note}”</div>}
            </div>
          ))}
          {summary.passOffs.length > 0 && (
            <div className="text-sm text-green-700 font-semibold">🏆 Competition pass-off: {summary.passOffs.join(', ')}</div>
          )}
          {summary.weeklyPassOffs.length > 0 && (
            <div className="text-sm text-sky-700 font-semibold">🎓 Weekly pass-off: {summary.weeklyPassOffs.join(', ')}</div>
          )}
          {summary.entries.length === 0 && summary.passOffs.length === 0 && summary.weeklyPassOffs.length === 0 && (
            <div className="text-sm text-gray-500">No activity logged.</div>
          )}
        </div>
      </div>
    </div>
  );
}
