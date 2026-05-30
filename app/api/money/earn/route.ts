// POST /api/money/earn
//
// Kid-authenticated (must be logged in via `dl_user` cookie). The CLIENT
// sends what happened — section, kind, and a payload describing the round.
// The SERVER decides the reward in cents. Kids cannot self-credit by
// hand-crafting requests; the worst they can do is replay a round they
// already submitted, which the idempotency key rejects as a no-op.
//
// Body:
//   {
//     section: 'math'|'spelling'|'languageArts'|'geography'|'drive',
//     kind: 'round'|'quiz'|'drill'|'deck',
//     payload: <section-specific>,
//     idempotencyKey: string  (client supplies — UUID is fine)
//   }
//
// Response:
//   { ok: true, centsEarned, balanceCents, reason, capped?, capCents? }

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { awardEarn, type EarnRequest } from '@/lib/money/earn';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';

const COOKIE_NAME = 'dl_user';

// Type guards — keep validation cheap and explicit. The Earn library does
// the heavy lifting on reward math; this layer just makes sure the shape
// is sane before handing off.
function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function asPlainObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function buildEarnRequest(body: Record<string, unknown>): EarnRequest | { error: string } {
  const section = asString(body.section);
  const kind = asString(body.kind);
  const idempotencyKey = asString(body.idempotencyKey);
  const payload = asPlainObject(body.payload);
  if (!section || !kind || !idempotencyKey || !payload) {
    return { error: 'section, kind, payload, idempotencyKey required' };
  }
  if (idempotencyKey.length > 100) {
    return { error: 'idempotencyKey too long' };
  }

  switch (section) {
    case 'math': {
      if (kind !== 'round') return { error: 'math only supports kind=round' };
      const correct = asNumber(payload.correct);
      const total = asNumber(payload.total);
      const difficulty = asString(payload.difficulty);
      const perQuestionSeconds = asNumber(payload.perQuestionSeconds);
      const avgAnswerMs = asNumber(payload.avgAnswerMs);
      const bestStreak = asNumber(payload.bestStreak);
      const operations = asString(payload.operations);
      if (
        correct === null || total === null || total < 1 || correct < 0 || correct > total ||
        !difficulty || !['easy', 'medium', 'hard'].includes(difficulty) ||
        perQuestionSeconds === null || perQuestionSeconds < 1 ||
        avgAnswerMs === null || avgAnswerMs < 0 ||
        bestStreak === null || bestStreak < 0 ||
        !operations
      ) {
        return { error: 'math payload invalid' };
      }
      return {
        section: 'math',
        kind: 'round',
        idempotencyKey,
        payload: {
          correct,
          total,
          difficulty: difficulty as 'easy' | 'medium' | 'hard',
          perQuestionSeconds,
          avgAnswerMs,
          bestStreak,
          operations,
        },
      };
    }
    case 'spelling': {
      if (kind !== 'quiz') return { error: 'spelling only supports kind=quiz' };
      const correct = asNumber(payload.correct);
      const total = asNumber(payload.total);
      const level = asNumber(payload.level);
      if (correct === null || total === null || total < 1 || correct < 0 || correct > total ||
          level === null || level < 1 || level > 7) {
        return { error: 'spelling payload invalid' };
      }
      return { section: 'spelling', kind: 'quiz', idempotencyKey, payload: { correct, total, level } };
    }
    case 'languageArts': {
      if (kind !== 'drill') return { error: 'languageArts only supports kind=drill' };
      const correct = asNumber(payload.correct);
      const total = asNumber(payload.total);
      const tier = asString(payload.tier);
      if (correct === null || total === null || total < 1 || correct < 0 || correct > total ||
          !tier || !['easy', 'medium', 'hard'].includes(tier)) {
        return { error: 'languageArts payload invalid' };
      }
      return {
        section: 'languageArts',
        kind: 'drill',
        idempotencyKey,
        payload: { correct, total, tier: tier as 'easy' | 'medium' | 'hard' },
      };
    }
    case 'geography': {
      if (kind !== 'quiz') return { error: 'geography only supports kind=quiz' };
      const correct = asNumber(payload.correct);
      const total = asNumber(payload.total);
      const quiz = asString(payload.quiz) ?? undefined;
      if (correct === null || total === null || total < 1 || correct < 0 || correct > total) {
        return { error: 'geography payload invalid' };
      }
      return { section: 'geography', kind: 'quiz', idempotencyKey, payload: { correct, total, quiz } };
    }
    case 'drive': {
      if (kind === 'deck') {
        const deck = asString(payload.deck);
        if (!deck) return { error: 'drive deck payload invalid' };
        return { section: 'drive', kind: 'deck', idempotencyKey, payload: { deck } };
      }
      if (kind === 'quiz') {
        const quiz = asString(payload.quiz);
        const correct = asNumber(payload.correct);
        const total = asNumber(payload.total);
        const isFinalOrSim = payload.isFinalOrSim === true;
        if (!quiz || correct === null || total === null || total < 1 ||
            correct < 0 || correct > total) {
          return { error: 'drive quiz payload invalid' };
        }
        return {
          section: 'drive',
          kind: 'quiz',
          idempotencyKey,
          payload: { quiz, correct, total, isFinalOrSim },
        };
      }
      return { error: 'drive only supports kind=deck|quiz' };
    }
    default:
      return { error: `unknown section: ${section}` };
  }
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Log in to earn MP' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const built = buildEarnRequest(body);
  if ('error' in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  try {
    const result = await awardEarn(userKey, built);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
