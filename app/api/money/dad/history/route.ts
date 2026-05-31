// GET /api/money/dad/history?user=<name>&limit=<n>
// Kid-authed (cookie). Returns the kid's recent DadAsk rows newest-first.
// Matches the read pattern of /api/money/transactions — pass user in the
// query string and we cross-check it against the dl_user cookie so one kid
// can't fetch another kid's ask history just by typing their name.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'dl_user';

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const cookieKey = normalizeUser(cookieUser);

  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);
  if (userKey !== cookieKey) {
    return NextResponse.json({ error: 'Cannot read another user\'s history' }, { status: 403 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20, 100);

  const rows = await prisma.dadAsk.findMany({
    where: { userName: userKey },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      centsAsked: true,
      reason: true,
      outcome: true,
      centsGranted: true,
      dadReply: true,
      context: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ asks: rows });
}
