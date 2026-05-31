// POST /api/audiobooks/listen-start
// Kid-cookie authed (dl_user). Body: { productId: string }
// Stamps audioHistory[productId].lastListenedAt = now. Does NOT change
// the completed flag (call /listen-complete for that).
//
// 401 if no cookie / anonymous. 400 on bad body. 404 if the user row doesn't
// exist (kid signed up after cookie was set? rare, but covered).
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { markListenStart } from '@/lib/audiobooks';
import { touchSession } from '@/lib/auth-touch';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: { productId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId || productId.length > 80) {
    return NextResponse.json({ error: 'Bad productId' }, { status: 400 });
  }

  try {
    await markListenStart(userKey, productId);
  } catch (err) {
    console.error('markListenStart failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  await touchSession();
  return NextResponse.json({ ok: true });
}
