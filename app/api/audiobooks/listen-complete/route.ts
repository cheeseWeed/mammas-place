// POST /api/audiobooks/listen-complete
// Kid-cookie authed (dl_user). Body: { productId: string }
// Flips audioHistory[productId].completed = true and advances
// seriesProgress[series] to the next un-completed item in that series.
//
// Pulls the audiobook catalog (lib/products.ts) at request time so the
// series-walk has fresh data even if the catalog changes between deploys.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { markListenComplete } from '@/lib/audiobooks';
import { getAudiobooks } from '@/lib/products';
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
    const audiobooks = await getAudiobooks();
    await markListenComplete(userKey, productId, audiobooks);
  } catch (err) {
    console.error('markListenComplete failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  await touchSession();
  return NextResponse.json({ ok: true });
}
