'use client';

// Parent music admin. Pick a kid → see their pieces + practice progress →
// pass a piece off (mints a gift card to print) → configure the (reusable)
// challenge. Parent-gated by the same mp_parent cookie as /admin/mp-bank;
// every API call here re-checks it server-side.

import { useCallback, useEffect, useState } from 'react';
import { centsToMP } from '@/lib/money/format';
import { instrumentDisplay, PASS_OFF_BY, type MusicPiece, type MusicChallenge, type PassOffBy } from '@/lib/music/types';
import { linesLearned, bestScore } from '@/lib/music/plan';

interface Learner {
  name: string;
  displayName: string | null;
  balanceCents: number;
}

interface KidState {
  ok: true;
  user: string;
  today: string;
  profile: { pieces: MusicPiece[]; challenge?: MusicChallenge };
}

export default function MusicAdminDashboard() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [kid, setKid] = useState<KidState | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [mintedCode, setMintedCode] = useState<{ code: string; cents: number; title: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/money/admin/learners', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.learners)) setLearners(data.learners);
    })();
  }, []);

  const loadKid = useCallback(async (user: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/music/state?user=${encodeURIComponent(user)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) setKid(data as KidState);
      else setKid(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadKid(selected);
  }, [selected, loadKid]);

  const note = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 5000);
  };

  // Competition pass-off — one-time, mints a gift card. `by` = teacher/mom/dad.
  const passOff = async (piece: MusicPiece, by: PassOffBy) => {
    if (!selected) return;
    if (!confirm(`Pass off "${piece.title}" (confirmed by ${by})? This mints the gift card reward.`)) return;
    const res = await fetch('/api/music/pass-off', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: selected, pieceId: piece.id, by }),
    });
    const data = await res.json();
    if (!res.ok) { note(data.error ?? 'Failed'); return; }
    setMintedCode({ code: data.giftCode, cents: data.rewardCents, title: piece.title });
    let msg = `Passed off! Minted ${centsToMP(data.rewardCents)} gift card.`;
    if (Array.isArray(data.challengeBonuses) && data.challengeBonuses.length) {
      msg += ` Bonus(es): ${data.challengeBonuses.map((b: { name: string; cents: number }) => `${b.name} ${centsToMP(b.cents)}`).join(', ')}.`;
    }
    note(msg);
    await loadKid(selected);
  };

  // Weekly pass-off — recurring, credits 150 MP straight (no gift card).
  const weeklyPassOff = async (piece: MusicPiece, by: PassOffBy) => {
    if (!selected) return;
    if (!confirm(`Weekly pass-off for "${piece.title}" (by ${by})? Credits 150 MP.`)) return;
    const res = await fetch('/api/music/weekly-passoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: selected, pieceId: piece.id, by }),
    });
    const data = await res.json();
    if (!res.ok) { note(data.error ?? 'Failed'); return; }
    note(`Weekly pass-off recorded — credited ${centsToMP(data.centsAwarded)} (by ${by}).`);
    await loadKid(selected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <header className="bg-indigo-900 text-white px-4 py-4 shadow">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="font-black text-xl">🎻 Music Admin</h1>
          <a href="/admin/mp-bank" className="bg-yellow-400 text-purple-900 font-bold px-4 py-2 rounded-xl text-sm">
            ← MP Bank
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {flash && (
          <div className="mb-4 bg-indigo-100 border border-indigo-300 text-indigo-900 rounded-xl px-4 py-3 text-sm font-semibold">
            {flash}
          </div>
        )}

        {mintedCode && (
          <div className="mb-4 bg-white border-2 border-amber-400 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-600 mb-1">Gift card for “{mintedCode.title}” — hand or print this for the kid to redeem:</p>
            <p className="text-3xl font-black tracking-[0.2em] text-amber-700 my-2">{mintedCode.code}</p>
            <p className="text-indigo-900 font-bold">{centsToMP(mintedCode.cents)}</p>
            <button onClick={() => window.print()} className="mt-2 bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold">
              🖨️ Print
            </button>
            <button onClick={() => setMintedCode(null)} className="mt-2 ml-2 text-gray-500 underline text-sm">Dismiss</button>
          </div>
        )}

        {/* kid picker */}
        <div className="mb-6 flex flex-wrap gap-2">
          {learners.map((l) => (
            <button
              key={l.name}
              onClick={() => setSelected(l.name)}
              className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${
                selected === l.name ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              {l.displayName || l.name}
            </button>
          ))}
          {learners.length === 0 && <p className="text-gray-500 text-sm">No learners yet.</p>}
        </div>

        {loading && <p className="text-indigo-700">Loading…</p>}

        {kid && !loading && (
          <>
            <div className="mb-4">
              <a
                href={`/music/calendar?user=${encodeURIComponent(kid.user)}`}
                className="inline-flex items-center gap-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold px-4 py-2 rounded-full text-sm"
              >
                🗓️ View {kid.user}&apos;s practice calendar
              </a>
            </div>
            <PieceTable
              pieces={kid.profile.pieces}
              challenge={kid.profile.challenge}
              onPassOff={passOff}
              onWeeklyPassOff={weeklyPassOff}
            />
            <ChallengeEditor
              user={kid.user}
              pieces={kid.profile.pieces}
              challenge={kid.profile.challenge}
              onSaved={() => { note('Challenge saved.'); void loadKid(kid.user); }}
            />
          </>
        )}
      </main>
    </div>
  );
}

function PieceTable({
  pieces,
  challenge,
  onPassOff,
  onWeeklyPassOff,
}: {
  pieces: MusicPiece[];
  challenge?: MusicChallenge;
  onPassOff: (p: MusicPiece, by: PassOffBy) => void;
  onWeeklyPassOff: (p: MusicPiece, by: PassOffBy) => void;
}) {
  // Who's confirming the pass-off (teacher / mom / dad) — applies to either
  // pass-off type. Defaults to teacher.
  const [by, setBy] = useState<PassOffBy>('teacher');

  if (!pieces.length) return <p className="text-gray-500 mb-6">This kid has no pieces yet.</p>;
  const compIds = new Set(challenge?.pieceIds ?? []);
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="font-bold text-indigo-700">Pass-off confirmed by:</span>
        {PASS_OFF_BY.map((o) => (
          <button
            key={o.value}
            onClick={() => setBy(o.value)}
            className={`px-3 py-1 rounded-full font-semibold text-xs ${by === o.value ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-indigo-50 text-indigo-800">
          <tr>
            <th className="text-left px-4 py-2">Piece</th>
            <th className="text-left px-4 py-2">Type</th>
            <th className="text-left px-4 py-2">Progress</th>
            <th className="text-left px-4 py-2">Weekly</th>
            <th className="text-right px-4 py-2">Pass off</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) => {
            const learned = linesLearned(p);
            const best = bestScore(p);
            const d = instrumentDisplay(p.instrument);
            const isComp = compIds.has(p.id);
            const weeklyCount = p.teacherPassOffs?.length ?? 0;
            return (
              <tr key={p.id} className={`border-t border-indigo-50 ${p.archived ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-semibold text-indigo-900">
                  {d.emoji} {p.title} {p.archived && <span className="text-[10px] text-gray-400">(archived)</span>}
                </td>
                <td className="px-4 py-3">
                  {isComp ? (
                    <span className="bg-violet-100 text-violet-700 text-[11px] font-bold px-2 py-0.5 rounded-full">🏆 Competition</span>
                  ) : (
                    <span className="bg-sky-100 text-sky-700 text-[11px] font-bold px-2 py-0.5 rounded-full">🎓 Weekly</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{learned}/{p.estLines} · best {best || '—'}/10</td>
                <td className="px-4 py-3">
                  <button onClick={() => onWeeklyPassOff(p, by)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs">
                    +150 MP {weeklyCount > 0 && <span className="opacity-80">({weeklyCount})</span>}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.passedOffAt ? (
                    <span className="text-green-700 font-bold text-xs">✓ {p.passOffGiftCode}</span>
                  ) : (
                    <button onClick={() => onPassOff(p, by)} className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs">
                      🏆 Pass off
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Challenge editor — reusable for any kid. Amounts entered in MP, converted to
// cents on save.
function ChallengeEditor({
  user,
  pieces,
  challenge,
  onSaved,
}: {
  user: string;
  pieces: MusicPiece[];
  challenge?: MusicChallenge;
  onSaved: () => void;
}) {
  const [name, setName] = useState(challenge?.name ?? '');
  const [startDate, setStartDate] = useState(challenge?.startDate ?? '');
  const [endDate, setEndDate] = useState(challenge?.endDate ?? '');
  const [pieceIds, setPieceIds] = useState<string[]>(challenge?.pieceIds ?? []);
  const [passOffMp, setPassOffMp] = useState(String((challenge?.passOffRewardCents ?? 20000) / 100));
  const [finishAllBy, setFinishAllBy] = useState(challenge?.finishAllBy ?? '');
  const [finishAllMp, setFinishAllMp] = useState(String((challenge?.finishAllBonusCents ?? 0) / 100));
  const [oneDayBy, setOneDayBy] = useState(challenge?.playAllInOneDayBy ?? '');
  const [oneDayMin, setOneDayMin] = useState(String(challenge?.playAllInOneDayMinScore ?? 8));
  const [oneDayMp, setOneDayMp] = useState(String((challenge?.playAllInOneDayBonusCents ?? 0) / 100));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPieceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setErr(null);
    if (!name.trim() || !startDate || !endDate) { setErr('Name, start, and end dates are required.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/music/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user,
          challenge: {
            name, startDate, endDate, pieceIds,
            passOffRewardCents: Math.round(Number(passOffMp) * 100),
            finishAllBy: finishAllBy || undefined,
            finishAllBonusCents: Number(finishAllMp) > 0 ? Math.round(Number(finishAllMp) * 100) : undefined,
            playAllInOneDayBy: oneDayBy || undefined,
            playAllInOneDayMinScore: Number(oneDayMin) || undefined,
            playAllInOneDayBonusCents: Number(oneDayMp) > 0 ? Math.round(Number(oneDayMp) * 100) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Failed'); return; }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm('Remove this challenge? Awarded bonuses stay paid.')) return;
    setBusy(true);
    try {
      await fetch('/api/music/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user, challenge: null }),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 p-5">
      <h2 className="font-black text-violet-900 text-lg mb-1">🏆 Challenge (optional, reusable)</h2>
      <p className="text-xs text-gray-500 mb-4">
        A competition wrapper for any kid — deadline bonuses + per-pass-off gift card.
        Leave a bonus amount at 0 to turn it off.
      </p>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Challenge name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Cello Camp Sprint" /></Field>
        <Field label="Per pass-off (MP)"><input type="number" value={passOffMp} onChange={(e) => setPassOffMp(e.target.value)} className={inputCls} /></Field>
        <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
        <Field label="End date (event day)"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Finish all by"><input type="date" value={finishAllBy} onChange={(e) => setFinishAllBy(e.target.value)} className={inputCls} /></Field>
        <Field label="Finish-all bonus (MP)"><input type="number" value={finishAllMp} onChange={(e) => setFinishAllMp(e.target.value)} className={inputCls} /></Field>
        <Field label="Play-all-in-one-day by"><input type="date" value={oneDayBy} onChange={(e) => setOneDayBy(e.target.value)} className={inputCls} /></Field>
        <Field label="One-day bonus (MP)"><input type="number" value={oneDayMp} onChange={(e) => setOneDayMp(e.target.value)} className={inputCls} /></Field>
        <Field label="One-day min score (1-10)"><input type="number" min={1} max={10} value={oneDayMin} onChange={(e) => setOneDayMin(e.target.value)} className={inputCls} /></Field>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold text-violet-700 mb-2">Pieces in this challenge:</p>
        <div className="flex flex-wrap gap-2">
          {pieces.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                pieceIds.includes(p.id) ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p.title}
            </button>
          ))}
          {pieces.length === 0 && <span className="text-gray-400 text-xs">Add pieces first.</span>}
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button onClick={save} disabled={busy} className="bg-violet-700 hover:bg-violet-800 disabled:bg-violet-300 text-white font-bold px-5 py-2 rounded-xl">
          {busy ? 'Saving…' : challenge ? 'Update challenge' : 'Create challenge'}
        </button>
        {challenge && (
          <button onClick={clear} disabled={busy} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-violet-200 rounded-lg px-2 py-1.5 text-sm text-violet-900';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-bold text-violet-700 block">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
