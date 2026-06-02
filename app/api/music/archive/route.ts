// POST /api/music/archive
//
// Archive (retire) or unarchive a piece. Archived pieces drop out of the
// active daily plan but stay in history + the calendar. No reward (that's
// pass-off). Kid can archive their own; a parent can archive any kid's.
//
// Body: { pieceId, archived: boolean, user? }

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { isParentAuthenticated } from '@/lib/money/parent';
import { setPieceArchived } from '@/lib/music/profile';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });
  const archived = body.archived !== false; // default true

  const bodyUser = typeof body.user === 'string' ? body.user : null;
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  const isParent = await isParentAuthenticated();

  let userKey: string;
  if (bodyUser && isParent) {
    const k = normalizeUser(bodyUser);
    if (!k) return NextResponse.json({ error: 'Bad user' }, { status: 400 });
    userKey = k;
  } else if (cookieUser && cookieUser !== '__anon__' && isValidUser(cookieUser)) {
    const self = normalizeUser(cookieUser);
    if (bodyUser && normalizeUser(bodyUser) !== self) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
    userKey = self;
  } else {
    return NextResponse.json({ error: 'Log in first' }, { status: 401 });
  }

  const piece = await setPieceArchived(userKey, pieceId, archived);
  if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  return NextResponse.json({ ok: true, piece });
}
