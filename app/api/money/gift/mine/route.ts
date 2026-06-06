// GET /api/money/gift/mine
// Kid-authed (dl_user cookie). Runs deliverDueGifts(me) first so any gift whose
// deliverAt has passed is credited + moved into "received" before we read.
//
// Returns:
//   { received: [...gifts delivered TO me], sentPending: [...my scheduled
//     gifts not yet delivered], justArrived: [...gifts THIS read delivered] }
// `justArrived` lets the portal show a "you got a gift!" surprise on first
// check on/after the deliver date.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { deliverDueGifts, getMyGifts } from '@/lib/money/gift';

const COOKIE_NAME = 'dl_user';

export async function GET() {
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
    const justArrived = await deliverDueGifts(userKey);
    const { received, sentPending } = await getMyGifts(userKey);
    return NextResponse.json({ received, sentPending, justArrived });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
