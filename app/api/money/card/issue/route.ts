// POST /api/money/card/issue
// Kid-authed. Issues an MP account card number to the logged-in kid (uses the
// dl_user cookie — no body needed). Idempotent: if the kid already has a
// card, returns the existing number unchanged.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { formatCard, issueCardForUser } from '@/lib/money/card';

const COOKIE_NAME = 'dl_user';

export async function POST() {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  try {
    const cardNumber = await issueCardForUser(userKey);
    return NextResponse.json({ cardNumber, formatted: formatCard(cardNumber) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
