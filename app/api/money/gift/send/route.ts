// POST /api/money/gift/send
// Send MP to another kid — a NEW flow distinct from printable gift cards.
//
// Sender identity:
//   - An admin (mp_parent cookie) sends as a FREE top-up source — no one is
//     debited. Detected via isParentAuthenticated().
//   - Otherwise the sender is the logged-in kid (dl_user cookie); their balance
//     is debited immediately (insufficient funds → 400 with a clear message).
//
// Body: { toUser, cents, note?, deliverAt? }
//   deliverAt: ISO string. Omitted / now / past → deliver immediately.
//              Future → scheduled (held until that date, credited on arrival).
// Returns: { ok, scheduled, deliverAt }
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { isParentAuthenticated } from '@/lib/money/parent';
import { GiftError, sendGift } from '@/lib/money/gift';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  // Admin (free top-up) takes precedence; otherwise the logged-in kid is the
  // sender and gets debited.
  const isAdmin = await isParentAuthenticated();

  let senderUser: string | null = null;
  if (!isAdmin) {
    const jar = await cookies();
    const cookieUser = jar.get(COOKIE_NAME)?.value;
    if (!cookieUser || cookieUser === '__anon__') {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }
    if (!isValidUser(cookieUser)) {
      return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
    }
    senderUser = normalizeUser(cookieUser);
  }

  let body: { toUser?: unknown; cents?: unknown; note?: unknown; deliverAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const toUser = typeof body.toUser === 'string' ? body.toUser : '';
  if (!isValidUser(toUser)) {
    return NextResponse.json({ error: 'Pick someone to send to' }, { status: 400 });
  }

  const cents = Number(body.cents);
  if (!Number.isInteger(cents) || cents <= 0) {
    return NextResponse.json(
      { error: 'Amount must be a positive whole number of cents' },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note : undefined;

  let deliverAt: Date | null = null;
  if (typeof body.deliverAt === 'string' && body.deliverAt.trim()) {
    const parsed = new Date(body.deliverAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Bad deliver date' }, { status: 400 });
    }
    deliverAt = parsed;
  }

  try {
    const { gift, scheduled } = await sendGift({
      senderUser,
      toUser,
      cents,
      note,
      deliverAt,
    });
    return NextResponse.json({ ok: true, scheduled, deliverAt: gift.deliverAt });
  } catch (err) {
    if (err instanceof GiftError) {
      const status = err.kind === 'recipient_not_found' ? 404 : 400;
      return NextResponse.json({ error: err.message, kind: err.kind }, { status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
