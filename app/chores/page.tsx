'use client';

// Family Chores — the member chart.
//
// Shows the family's chore chart with overdue jobs pinned to the top, filtered
// by frequency (day/week/month/quarter), room, and person. Check a job off to
// earn its MP (credited immediately — no approval). A redeem button lets a kid
// spend MP on an external reward (instant debit + fun message).
//
// Invite-gated: if the logged-in user isn't in a family, we show a friendly
// "ask a parent to add you" rather than the chart.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';
import {
  frequencyLabel,
  type FamilyJob,
  type Frequency,
} from '@/lib/family/types';
import { matchesFrequencyBucket, sortRank, type JobSchedule } from '@/lib/family/schedule';

interface ChartJob { job: FamilyJob; schedule: JobSchedule }
interface Member { name: string; displayName: string | null; isParent: boolean; balanceCents: number }
interface ChartState {
  ok: true;
  today: string;
  user: string;
  isParent: boolean;
  family: { id: string; name: string } | null;
  members: Member[];
  jobs: ChartJob[];
}

type FreqBucket = 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
const FREQ_BUCKETS: { key: FreqBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: 'Day' },
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
  { key: 'quarterly', label: 'Quarter+' },
];

export default function ChoresPage() {
  return (
    <LoginGate section="chores" loadingFallback={<Shell><Loading /></Shell>}>
      <ChoresInner />
    </LoginGate>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-white py-10 px-3">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}
function Loading() { return <div className="text-center text-emerald-700 py-20">Loading the chart…</div>; }

function ChoresInner() {
  const { learner, refresh: refreshBalance } = useLearner();
  const [state, setState] = useState<ChartState | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [freq, setFreq] = useState<FreqBucket>('all');
  const [room, setRoom] = useState<string>('all');
  const [person, setPerson] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/family/chart', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) { setState(data as ChartState); setErr(null); }
      else setErr(data.error ?? 'Could not load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, learner]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 4000); };

  const jobs = state?.jobs ?? [];
  const rooms = useMemo(() => {
    const seen: string[] = [];
    for (const { job } of jobs) if (!seen.includes(job.room)) seen.push(job.room);
    return seen;
  }, [jobs]);

  const visible = useMemo(() => {
    return jobs
      .filter(({ job }) => matchesFrequencyBucket(job.frequency, freq))
      .filter(({ job }) => room === 'all' || job.room === room)
      .filter(({ job }) => person === 'all' || (job.assignedTo ?? '') === person || (person === 'unassigned' && !job.assignedTo))
      .sort((a, b) => sortRank(a.schedule) - sortRank(b.schedule));
  }, [jobs, freq, room, person]);

  const overdueCount = jobs.filter((j) => j.schedule.status === 'overdue').length;

  if (loading && !state) return <Shell><Loading /></Shell>;

  if (err) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border-2 border-emerald-100 p-8 text-center shadow mt-10">
          <div className="text-5xl mb-3">👋</div>
          <p className="text-emerald-900 font-bold mb-1">{err}</p>
          <p className="text-gray-600 text-sm mb-4">Once a parent adds you to the family, your chore chart shows up here.</p>
          <Link href="/" className="text-emerald-700 underline text-sm">← Back to Mamma&apos;s Place</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold">
          {toast}
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🧹</div>
        <h1 className="text-3xl md:text-4xl font-black text-emerald-900">{state?.family?.name ?? 'Family'} Chores</h1>
        <p className="text-emerald-700">Check off a job to earn MP. Overdue jobs jump to the top.</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
        <RedeemButton onDone={async (m) => { flash(m); await Promise.all([load(), refreshBalance()]); }} />
        {state?.isParent && (
          <Link href="/parent" className="bg-white border-2 border-emerald-200 text-emerald-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-emerald-50">
            🛠 Manage chart (parent)
          </Link>
        )}
      </div>

      {overdueCount > 0 && (
        <div className="max-w-3xl mx-auto mb-4 bg-rose-50 border-2 border-rose-200 rounded-2xl p-3 text-center text-sm text-rose-800 font-semibold">
          ⚠️ {overdueCount} overdue {overdueCount === 1 ? 'job' : 'jobs'} — let’s knock those out first!
        </div>
      )}

      {/* filters */}
      <div className="space-y-2 mb-5">
        <FilterRow label="When">
          {FREQ_BUCKETS.map((b) => <Chip key={b.key} label={b.label} active={freq === b.key} onClick={() => setFreq(b.key)} />)}
        </FilterRow>
        {rooms.length > 1 && (
          <FilterRow label="Room">
            <Chip label="All" active={room === 'all'} onClick={() => setRoom('all')} />
            {rooms.map((r) => <Chip key={r} label={r} active={room === r} onClick={() => setRoom(r)} />)}
          </FilterRow>
        )}
        {(state?.members.length ?? 0) > 1 && (
          <FilterRow label="Who">
            <Chip label="Everyone" active={person === 'all'} onClick={() => setPerson('all')} />
            <Chip label="Unassigned" active={person === 'unassigned'} onClick={() => setPerson('unassigned')} />
            {state?.members.map((m) => <Chip key={m.name} label={m.displayName || m.name} active={person === m.name} onClick={() => setPerson(m.name)} />)}
          </FilterRow>
        )}
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-emerald-100 p-6 text-center text-gray-500">No jobs match these filters.</div>
        ) : (
          visible.map(({ job, schedule }) => (
            <JobRow
              key={job.id}
              job={job}
              schedule={schedule}
              members={state?.members ?? []}
              onChanged={async (m) => { flash(m); await Promise.all([load(), refreshBalance()]); }}
            />
          ))
        )}
      </div>

      <div className="text-center mt-8">
        <Link href="/" className="inline-block bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-medium px-6 py-2 rounded-full text-sm">
          ← Back to Mamma&apos;s Place
        </Link>
      </div>
    </Shell>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide w-12">{label}</span>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        active ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
      }`}
    >
      {label}
    </button>
  );
}

function JobRow({
  job,
  schedule,
  members,
  onChanged,
}: {
  job: FamilyJob;
  schedule: JobSchedule;
  members: Member[];
  onChanged: (m: string) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const done = schedule.status === 'done' || schedule.doneToday;
  const overdue = schedule.status === 'overdue';
  const assignee = members.find((m) => m.name === job.assignedTo);

  const check = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/family/check-off', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) { await onChanged(data.error ?? 'Could not check off'); return; }
      if (data.alreadyDone) { await onChanged('Already done today ✓'); return; }
      await onChanged(`✓ ${job.name} — +${centsToMP(data.centsEarned)}!`);
    } finally { setBusy(false); }
  };

  const undo = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/family/check-off?jobId=${encodeURIComponent(job.id)}`, { method: 'DELETE' });
      const data = await res.json();
      await onChanged(res.ok ? `Undid ${job.name}` : (data.error ?? 'Could not undo'));
    } finally { setBusy(false); }
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${
      overdue ? 'bg-rose-50 border-rose-200' : done ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-200'
    }`}>
      <button
        onClick={schedule.doneToday ? undo : check}
        disabled={busy}
        className={`shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center font-black transition-colors ${
          schedule.doneToday ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 text-transparent hover:border-emerald-500'
        }`}
        title={schedule.doneToday ? 'Tap to undo' : 'Check off'}
      >
        ✓
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-bold ${done ? 'text-emerald-800 line-through' : overdue ? 'text-rose-900' : 'text-gray-900'}`}>
          {job.emoji ? `${job.emoji} ` : ''}{job.name}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          <span>{job.room}</span>
          <span>· {frequencyLabel(job.frequency)}</span>
          {assignee && <span>· {assignee.displayName || assignee.name}</span>}
          {overdue && <span className="text-rose-600 font-bold">· overdue {Math.abs(schedule.daysUntilDue)}d</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-black text-emerald-700">{job.mp} MP</div>
        {schedule.doneToday && <div className="text-[10px] text-emerald-600">done ✓</div>}
      </div>
    </div>
  );
}

function RedeemButton({ onDone }: { onDone: (m: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reward, setReward] = useState('');
  const [mp, setMp] = useState(50);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/family/redeem', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mp, reward }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Could not redeem'); return; }
      setMsg(data.funMessage ?? 'Done!');
      setReward('');
      await onDone(`Redeemed ${reward} — ${data.funMessage}`);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setMsg(null); }} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-full text-sm">
        🎁 Redeem MP
      </button>
    );
  }
  return (
    <div className="w-full max-w-md bg-white border-2 border-amber-300 rounded-2xl p-4">
      <h3 className="font-black text-amber-900 mb-2">Redeem MP for something fun</h3>
      {msg && <p className="text-sm font-semibold text-amber-700 mb-2">{msg}</p>}
      <input
        value={reward} onChange={(e) => setReward(e.target.value)} placeholder="What for? (movie night, ice cream…)"
        className="w-full border border-amber-200 rounded-lg px-3 py-2 mb-2 text-amber-900"
      />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-amber-700">How much?</span>
        <input type="number" min={1} value={mp} onChange={(e) => setMp(Number(e.target.value))} className="w-24 border border-amber-200 rounded-lg px-2 py-1.5 text-amber-900" />
        <span className="text-sm text-amber-700">MP</span>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy || !reward.trim()} className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold py-2 rounded-xl">
          {busy ? 'Redeeming…' : `Redeem ${mp} MP`}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl">Close</button>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Heads up: this spends your MP right away. Make sure a parent OK’d it in person first!</p>
    </div>
  );
}
