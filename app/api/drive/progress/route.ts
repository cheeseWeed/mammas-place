// /api/drive/progress
// GET ?user=<name>  → returns { attempts, misses, unitScores, sr, mode } (404 if no record)
// POST { user, attempts?, misses?, unitScores?, sr?, mode? }
//   concat attempts, concat misses, merge unitScores & sr by key, last-write-wins for mode.
import { NextRequest, NextResponse } from 'next/server';
import {
  QuizAttempt,
  SrRecord,
  UnitScore,
  isValidUser,
  normalizeUser,
  readStore,
  writeStore,
} from '@/lib/drive-progress';
import { awardEarn } from '@/lib/money/earn';

// Quiz IDs containing any of these substrings count as final/simulator for
// reward purposes (250c base instead of 75c). Matches /drive-assets/exams.
const FINAL_OR_SIM_TOKENS = ['final', 'simulator', 'sim-', 'mega'];
function isFinalOrSim(quizId: string): boolean {
  const lower = quizId.toLowerCase();
  return FINAL_OR_SIM_TOKENS.some((t) => lower.includes(t));
}

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);
  const store = await readStore();
  const record = store.users[userKey];
  if (!record) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }
  return NextResponse.json({
    attempts: record.attempts,
    misses: record.misses,
    unitScores: record.unitScores,
    sr: record.sr,
    mode: record.mode,
    deckCompletions: record.deckCompletions || {},
  });
}

export async function POST(req: NextRequest) {
  let body: {
    user?: unknown;
    attempts?: unknown;
    misses?: unknown;
    unitScores?: unknown;
    sr?: unknown;
    mode?: unknown;
    deckCompletions?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);
  const store = await readStore();
  const record = store.users[userKey];
  if (!record) {
    // Don't auto-create users via progress POST — that's what /register is for.
    // Anonymous progress falls back to localStorage in the browser.
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  // Attempts: concat (bounded at 500). Track NEW attempts for MP earning.
  const newAttempts: QuizAttempt[] = [];
  if (Array.isArray(body.attempts)) {
    const incoming = body.attempts as QuizAttempt[];
    // Dedupe by ts+quiz so a noisy double-fetch can't double-log.
    const seen = new Set(record.attempts.map((a) => `${a.ts}|${a.quiz}`));
    for (const a of incoming) {
      if (
        a &&
        typeof a.ts === 'number' &&
        typeof a.quiz === 'string' &&
        !seen.has(`${a.ts}|${a.quiz}`)
      ) {
        record.attempts.push(a);
        newAttempts.push(a);
        seen.add(`${a.ts}|${a.quiz}`);
      }
    }
    if (record.attempts.length > 500) {
      record.attempts = record.attempts.slice(-500);
    }
  }

  // Misses: concat (bounded at 500)
  if (Array.isArray(body.misses)) {
    for (const m of body.misses) {
      if (typeof m === 'string' && m.length > 0) record.misses.push(m);
    }
    if (record.misses.length > 500) {
      record.misses = record.misses.slice(-500);
    }
  }

  // Unit scores: last-write-wins by key
  if (body.unitScores && typeof body.unitScores === 'object') {
    for (const [k, v] of Object.entries(body.unitScores as Record<string, UnitScore>)) {
      if (v && typeof v.pct === 'number' && typeof v.ts === 'number') {
        record.unitScores[k] = { pct: v.pct, ts: v.ts };
      }
    }
  }

  // SR records: merge by fact_id (last-write-wins)
  if (body.sr && typeof body.sr === 'object') {
    for (const [k, v] of Object.entries(body.sr as Record<string, SrRecord>)) {
      if (v && typeof v.next_due_ts === 'number' && typeof v.interval_days === 'number') {
        record.sr[k] = {
          next_due_ts: v.next_due_ts,
          interval_days: v.interval_days,
          ease: typeof v.ease === 'number' ? v.ease : 2.5,
          last_seen_ts: typeof v.last_seen_ts === 'number' ? v.last_seen_ts : Date.now(),
        };
      }
    }
  }

  // Mode: last-write-wins
  if (body.mode === 'quick' || body.mode === 'deep') {
    record.mode = body.mode;
  }

  // Deck completions: merge by unit key (last-write-wins by timestamp).
  // Track decks newly completed in THIS request (no prior entry) so we
  // only award MP once per deck per user.
  const newlyCompletedDecks: string[] = [];
  if (body.deckCompletions && typeof body.deckCompletions === 'object') {
    if (!record.deckCompletions) record.deckCompletions = {};
    for (const [k, v] of Object.entries(body.deckCompletions as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) {
        const existing = record.deckCompletions[k];
        if (!existing) {
          newlyCompletedDecks.push(k);
        }
        if (!existing || v > existing) {
          record.deckCompletions[k] = v;
        }
      }
    }
  }

  record.updatedAt = Date.now();
  await writeStore(store);

  // MP earning — server-decided, idempotency-keyed. Quiz attempts pay per
  // attempt (re-takes earn too, but only if the quiz isn't a duplicate
  // ts+quiz, which we filtered above). Deck completions pay once per deck
  // per user (idempotency key has no timestamp so a second writeStore for
  // the same deck no-ops on the unique constraint).
  let totalEarnedCents = 0;
  const earnNotes: string[] = [];

  for (const a of newAttempts) {
    if (!a.quiz || typeof a.score !== 'number' || typeof a.total !== 'number' || a.total < 1) continue;
    try {
      const res = await awardEarn(userKey, {
        section: 'drive',
        kind: 'quiz',
        idempotencyKey: `drive-quiz-${userKey}-${a.ts}-${a.quiz}`,
        payload: {
          quiz: a.quiz,
          correct: a.score,
          total: a.total,
          isFinalOrSim: isFinalOrSim(a.quiz),
        },
      });
      if (res.centsEarned > 0) {
        totalEarnedCents += res.centsEarned;
        earnNotes.push(res.reason);
      }
    } catch {
      // Earn failure must not break progress save.
    }
  }

  for (const deck of newlyCompletedDecks) {
    try {
      const res = await awardEarn(userKey, {
        section: 'drive',
        kind: 'deck',
        idempotencyKey: `drive-deck-${userKey}-${deck}`,
        payload: { deck },
      });
      if (res.centsEarned > 0) {
        totalEarnedCents += res.centsEarned;
        earnNotes.push(res.reason);
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    ok: true,
    earnedCents: totalEarnedCents,
    earnReasons: earnNotes,
  });
}
