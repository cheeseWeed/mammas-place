// GET /api/money/balance?user=<name> → { cents: number }
// 404 if user not registered.
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { readBalance } from '@/lib/money/balance';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const cents = await readBalance(normalizeUser(userParam));
  if (cents === null) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }
  return NextResponse.json({ cents });
}
