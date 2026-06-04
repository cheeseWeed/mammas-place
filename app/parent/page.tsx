'use client';

// Parent section — a parent (mom/dad, granted by Admin) manages THEIR family:
// build/edit the chore chart, invite members, take points, see the redeem log.
//
// Gated client-side off /api/family/chart (which tells us isParent). A non-
// parent or unfamilied user gets bounced with a friendly message. All the
// management endpoints re-check parent status server-side regardless.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';
import { FREQUENCIES, DEFAULT_MP_BY_FREQUENCY, frequencyLabel, type FamilyJob, type Frequency } from '@/lib/family/types';

interface Member { name: string; displayName: string | null; isParent: boolean; balanceCents: number }
interface FamilyView { id: string; name: string; parents: string[]; members: Member[] }
interface Redemption { id: string; userName: string; cents: number; reward: string; funMessage: string; createdAt: string }

export default function ParentPage() {
  const { learner } = useLearner();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [jobs, setJobs] = useState<FamilyJob[]>([]);
  const [view, setView] = useState<FamilyView | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  // The family being managed + whether the caller is the app Admin (godmode).
  // Admin manages whatever family the chart resolved (their own, or the first
  // family). familyId is threaded into the management calls so the server knows
  // which family an admin is acting on.
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 4500); };

  const loadAll = useCallback(async () => {
    const chart = await fetch('/api/family/chart', { cache: 'no-store' }).then((r) => r.json());
    if (!chart.ok || !chart.isParent) { setAllowed(false); return; }
    setAllowed(true);
    setIsAdmin(!!chart.isAdmin);
    setFamilyName(chart.family?.name ?? 'Family');
    setFamilyId(chart.family?.id ?? null);
    setJobs((chart.jobs as { job: FamilyJob }[]).map((x) => x.job));
    const qs = chart.family?.id ? `?familyId=${encodeURIComponent(chart.family.id)}` : '';
    const manage = await fetch(`/api/family/manage${qs}`, { cache: 'no-store' }).then((r) => r.json());
    if (manage.ok) { setView(manage.family); setRedemptions(manage.redemptions ?? []); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll, learner]);

  if (allowed === null) return <Shell><div className="text-center text-emerald-700 py-20">Loading…</div></Shell>;
  if (!allowed) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border-2 border-emerald-100 p-8 text-center shadow mt-10">
          <div className="text-5xl mb-3">🛠</div>
          <p className="text-emerald-900 font-bold mb-1">This is the parent area.</p>
          <p className="text-gray-600 text-sm mb-4">Only a parent of a family can manage the chart. Ask the Admin to set you up.</p>
          <Link href="/chores" className="text-emerald-700 underline text-sm">→ Go to the chore chart</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-5 py-3 rounded-full shadow-lg text-sm font-semibold">{toast}</div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-emerald-900">
          🛠 {familyName} — {isAdmin ? 'Admin' : 'Parent'}
        </h1>
        <Link href="/chores" className="bg-emerald-100 text-emerald-800 font-bold px-4 py-2 rounded-full text-sm">← Chart</Link>
      </div>

      <MembersPanel view={view} familyId={familyId} onChanged={async (m) => { flash(m); await loadAll(); }} />
      <JobsPanel jobs={jobs} members={view?.members ?? []} familyId={familyId} onChanged={async (m) => { flash(m); await loadAll(); }} />
      <RedemptionLog redemptions={redemptions} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-10 px-3">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

// ----- Members + take points -----

function MembersPanel({ view, familyId, onChanged }: { view: FamilyView | null; familyId: string | null; onChanged: (m: string) => void | Promise<void> }) {
  const [addName, setAddName] = useState('');
  const post = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch('/api/family/manage', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...(familyId ? { familyId } : {}), ...payload }),
    });
    const data = await res.json();
    await onChanged(res.ok ? '✓ Done' : (data.error ?? 'Failed'));
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-100 p-5 mb-6">
      <h2 className="font-black text-emerald-900 mb-3">Family members</h2>
      <div className="space-y-2 mb-4">
        {view?.members.map((m) => (
          <div key={m.name} className="flex items-center justify-between gap-2 bg-emerald-50 rounded-xl p-2.5">
            <div>
              <span className="font-bold text-emerald-900">{m.displayName || m.name}</span>
              {m.isParent && <span className="ml-2 text-[11px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">parent</span>}
              <span className="ml-2 text-xs text-gray-500">{centsToMP(m.balanceCents)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TakePoints username={m.name} familyId={familyId} onChanged={onChanged} />
              <button onClick={() => post('setParent', { username: m.name, makeParent: !m.isParent })} className="text-xs text-emerald-700 underline">
                {m.isParent ? 'remove parent' : 'make parent'}
              </button>
              <button onClick={() => post('removeMember', { username: m.name })} className="text-xs text-rose-500 underline">remove</button>
            </div>
          </div>
        ))}
        {(!view || view.members.length === 0) && <p className="text-gray-500 text-sm">No members yet.</p>}
      </div>
      <div className="flex gap-2">
        <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="username to add"
          className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-900" />
        <button
          onClick={async () => { if (addName.trim()) { await post('addMember', { username: addName.trim() }); setAddName(''); } }}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl"
        >
          + Invite
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Add an existing user by their login name. They’ll see the chart once added.</p>
    </div>
  );
}

function TakePoints({ username, familyId, onChanged }: { username: string; familyId: string | null; onChanged: (m: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [mp, setMp] = useState(10);
  const [reason, setReason] = useState('Job done poorly');
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-amber-700 underline">take pts</button>;
  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" min={1} value={mp} onChange={(e) => setMp(Number(e.target.value))} className="w-14 border border-amber-200 rounded px-1 py-0.5 text-xs" />
      <button
        onClick={async () => {
          const res = await fetch('/api/family/manage', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'takePoints', username, mp, reason, ...(familyId ? { familyId } : {}) }),
          });
          const data = await res.json();
          await onChanged(res.ok ? `Took ${centsToMP(data.tookCents ?? 0)} from ${username}` : (data.error ?? 'Failed'));
          setOpen(false);
        }}
        className="text-xs bg-amber-600 text-white font-bold px-2 py-0.5 rounded"
      >
        take
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400">×</button>
    </span>
  );
}

// ----- Jobs (build/edit the chart) -----

function JobsPanel({ jobs, members, familyId, onChanged }: { jobs: FamilyJob[]; members: Member[]; familyId: string | null; onChanged: (m: string) => void | Promise<void> }) {
  const active = jobs.filter((j) => !j.archived);

  const loadCatalog = async () => {
    const res = await fetch('/api/family/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'loadCatalog', ...(familyId ? { familyId } : {}) }),
    });
    const data = await res.json();
    await onChanged(res.ok ? `Loaded ${data.added} jobs (skipped ${data.skipped} dupes).` : (data.error ?? 'Failed'));
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-black text-emerald-900">Chore chart ({active.length} jobs)</h2>
        {active.length === 0 && (
          <button onClick={loadCatalog} className="bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm">
            ⚡ Load starter chores
          </button>
        )}
      </div>

      <AddJobForm members={members} familyId={familyId} onChanged={onChanged} />

      {active.length > 0 && (
        <div className="mt-4 max-h-96 overflow-y-auto space-y-1">
          {active.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 py-1.5">
              <span className="text-gray-900 flex-1 min-w-0 truncate">{j.emoji ? `${j.emoji} ` : ''}{j.name}</span>
              <span className="text-gray-400 text-xs shrink-0 hidden sm:inline">{j.room} · {frequencyLabel(j.frequency)} · {j.mp}MP</span>
              <AssignJob job={j} members={members} familyId={familyId} onChanged={onChanged} />
              <button
                onClick={async () => {
                  const qs = familyId ? `&familyId=${encodeURIComponent(familyId)}` : '';
                  const res = await fetch(`/api/family/jobs?jobId=${encodeURIComponent(j.id)}${qs}`, { method: 'DELETE' });
                  await onChanged(res.ok ? `Deleted ${j.name}` : 'Failed');
                }}
                className="text-rose-400 text-xs shrink-0"
              >🗑</button>
            </div>
          ))}
        </div>
      )}
      {active.length > 0 && (
        <button onClick={loadCatalog} className="mt-3 text-xs text-emerald-700 underline">+ top up from starter catalog</button>
      )}
    </div>
  );
}

// Inline assignee picker on an existing job row. PATCHes assignedTo — empty
// string means "Anyone" (server clears it). Reassign or unassign in one click.
function AssignJob({ job, members, familyId, onChanged }: { job: FamilyJob; members: Member[]; familyId: string | null; onChanged: (m: string) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const current = job.assignedTo ?? '';
  const setAssignee = async (username: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/family/jobs', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, assignedTo: username, ...(familyId ? { familyId } : {}) }),
      });
      const data = await res.json();
      const who = members.find((m) => m.name === username);
      await onChanged(
        res.ok
          ? (username ? `Assigned "${job.name}" to ${who?.displayName || username}` : `"${job.name}" is now anyone’s`)
          : (data.error ?? 'Failed'),
      );
    } finally { setBusy(false); }
  };
  return (
    <select
      value={current}
      disabled={busy}
      onChange={(e) => setAssignee(e.target.value)}
      title="Assign this chore to someone (or Anyone)"
      className={`shrink-0 border rounded-lg px-1.5 py-1 text-xs max-w-[7.5rem] ${
        current ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold' : 'border-gray-200 text-gray-500'
      }`}
    >
      <option value="">Anyone</option>
      {members.map((m) => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}
    </select>
  );
}

function AddJobForm({ members, familyId, onChanged }: { members: Member[]; familyId: string | null; onChanged: (m: string) => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('Kitchen');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [mp, setMp] = useState<number>(DEFAULT_MP_BY_FREQUENCY.weekly);
  const [assignedTo, setAssignedTo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { await onChanged('Job needs a name.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/family/jobs', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, room, frequency, mp, assignedTo: assignedTo || undefined, ...(familyId ? { familyId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) { await onChanged(data.error ?? 'Failed'); return; }
      setName('');
      await onChanged(`Added ${name}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-emerald-50 rounded-xl p-3 grid grid-cols-2 gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New job (e.g. Oil change - car)"
        className="col-span-2 border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-emerald-900" />
      <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room"
        className="border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-emerald-900" />
      <select value={frequency} onChange={(e) => { const f = e.target.value as Frequency; setFrequency(f); setMp(DEFAULT_MP_BY_FREQUENCY[f]); }}
        className="border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-emerald-900">
        {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <label className="text-xs font-bold text-emerald-700 flex items-center gap-1">
        MP <input type="number" min={0} value={mp} onChange={(e) => setMp(Number(e.target.value))} className="w-16 border border-emerald-200 rounded px-1 py-0.5 text-emerald-900" />
        <span className="text-gray-400 font-normal">(bigger jobs = more)</span>
      </label>
      <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-emerald-900">
        <option value="">Anyone</option>
        {members.map((m) => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}
      </select>
      <button onClick={submit} disabled={busy} className="col-span-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white font-bold py-2 rounded-xl text-sm">
        {busy ? 'Adding…' : '+ Add job'}
      </button>
    </div>
  );
}

function RedemptionLog({ redemptions }: { redemptions: Redemption[] }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-100 p-5">
      <h2 className="font-black text-emerald-900 mb-3">🎁 Redemption log</h2>
      <p className="text-xs text-gray-500 mb-3">What the kids have spent MP on (already debited — no approval needed).</p>
      {redemptions.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing redeemed yet.</p>
      ) : (
        <div className="space-y-1">
          {redemptions.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1.5">
              <span className="text-gray-900"><span className="font-bold">{r.userName}</span> — {r.reward}</span>
              <span className="text-gray-400 text-xs">{centsToMP(r.cents)} · {new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
