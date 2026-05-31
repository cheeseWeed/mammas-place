// GET /api/money/card?user=<name>
// Kid-authed: the dl_user cookie must match the `user` query param. Returns
// { cardNumber, formatted } if the kid has a card, 404 if not. Use POST
// /api/money/card/issue to mint one.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { formatCard, readCardForUser } from '@/lib/money/card';

const COOKIE_NAME = 'dl_user';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);

  // Kid-auth: cookie must match the requested user. Prevents one kid from
  // probing another's card number through this endpoint.
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (normalizeUser(cookieUser) !== userKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cardNumber = await readCardForUser(userKey);
  if (!cardNumber) {
    return NextResponse.json({ error: 'No card issued' }, { status: 404 });
  }
  return NextResponse.json({ cardNumber, formatted: formatCard(cardNumber) });
}
