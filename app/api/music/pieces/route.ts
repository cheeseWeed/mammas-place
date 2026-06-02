// /api/music/pieces — add / edit / delete a piece.
//
// POST   { title, instrument, estLines, difficulty, targetDate?, pdfHref?, user? }
//        → adds a piece. A kid adds to their own profile (addedBy:'kid').
//          A parent (parent cookie) may add to any kid via ?user / body.user
//          (addedBy:'parent').
// PATCH  { pieceId, ...fields, user? } → edit. Parent-or-self.
// DELETE ?pieceId=&user=            → delete. Parent-or-self.
//
// "Self" = the dl_user cookie owner. "Parent" = mp_parent cookie present.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { isParentAuthenticated } from '@/lib/money/parent';
import { addPiece, updatePiece, deletePiece, type AddPieceInput } from '@/lib/music/profile';

const COOKIE_NAME = 'dl_user';
const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard']);

// Instruments are free-form (families can add any). Accept any non-empty string
// up to 30 chars, normalized to lowercase so 'Ukulele' and 'ukulele' match.
function normInstrument(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().slice(0, 30);
  return v.length > 0 ? v : null;
}

// Resolve the target user + whether the caller is a parent. Self-only unless
// the parent cookie is present (then any `user` is allowed).
async function resolveTarget(
  bodyUser: string | null,
): Promise<{ userKey: string; isParent: boolean } | { error: string; status: number }> {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  const isParent = await isParentAuthenticated();

  if (bodyUser && isParent) {
    const k = normalizeUser(bodyUser);
    if (!k) return { error: 'Bad user', status: 400 };
    return { userKey: k, isParent: true };
  }
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return { error: 'Log in first', status: 401 };
  }
  const self = normalizeUser(cookieUser);
  // A kid passing a different user is rejected.
  if (bodyUser && normalizeUser(bodyUser) !== self) {
    return { error: 'Not allowed', status: 403 };
  }
  return { userKey: self, isParent };
}

function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const target = await resolveTarget(typeof body.user === 'string' ? body.user : null);
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const instrument = normInstrument(body.instrument);
  const estLines = Number(body.estLines);
  const difficulty = body.difficulty as string;

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (!instrument) {
    return NextResponse.json({ error: 'Instrument required' }, { status: 400 });
  }
  if (!Number.isFinite(estLines) || estLines < 1) {
    return NextResponse.json({ error: 'estLines must be ≥ 1' }, { status: 400 });
  }
  if (!VALID_DIFFICULTY.has(difficulty)) {
    return NextResponse.json({ error: 'Bad difficulty' }, { status: 400 });
  }
  if (body.targetDate !== undefined && body.targetDate !== null && body.targetDate !== '' && !isISODate(body.targetDate)) {
    return NextResponse.json({ error: 'targetDate must be YYYY-MM-DD' }, { status: 400 });
  }

  const input: AddPieceInput = {
    title,
    instrument,
    estLines,
    difficulty: difficulty as 'easy' | 'medium' | 'hard',
    targetDate: isISODate(body.targetDate) ? body.targetDate : undefined,
    pdfHref: typeof body.pdfHref === 'string' ? body.pdfHref : undefined,
    addedBy: target.isParent ? 'parent' : 'kid',
  };

  try {
    const piece = await addPiece(target.userKey, input);
    return NextResponse.json({ ok: true, piece });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });

  const target = await resolveTarget(typeof body.user === 'string' ? body.user : null);
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const patch: Partial<AddPieceInput> = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if (body.instrument !== undefined) {
    const inst = normInstrument(body.instrument);
    if (inst) patch.instrument = inst;
  }
  if (body.estLines !== undefined && Number.isFinite(Number(body.estLines))) patch.estLines = Number(body.estLines);
  if (typeof body.difficulty === 'string' && VALID_DIFFICULTY.has(body.difficulty)) {
    patch.difficulty = body.difficulty as 'easy' | 'medium' | 'hard';
  }
  if (body.targetDate !== undefined) {
    if (body.targetDate === '' || body.targetDate === null) patch.targetDate = '';
    else if (isISODate(body.targetDate)) patch.targetDate = body.targetDate;
    else return NextResponse.json({ error: 'targetDate must be YYYY-MM-DD' }, { status: 400 });
  }
  if (typeof body.pdfHref === 'string') patch.pdfHref = body.pdfHref;

  const piece = await updatePiece(target.userKey, pieceId, patch);
  if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  return NextResponse.json({ ok: true, piece });
}

export async function DELETE(req: NextRequest) {
  const pieceId = req.nextUrl.searchParams.get('pieceId') ?? '';
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });

  const target = await resolveTarget(req.nextUrl.searchParams.get('user'));
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const ok = await deletePiece(target.userKey, pieceId);
  if (!ok) return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
