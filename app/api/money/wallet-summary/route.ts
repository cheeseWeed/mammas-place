// GET /api/money/wallet-summary?user=<name>
//
// Aggregates everything the kid's wallet page needs in a single call:
// balance, per-section lifetime earnings, recent orders, recent transactions,
// and the current earning streak. Keeps the page from firing 4 parallel
// requests and dragging hundreds of rows over the wire.

import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import {
  readBalance,
  listOrders,
  listTransactions,
  sumEarningsPerSection,
  computeEarningStreak,
} from '@/lib/money/balance';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);

  const [balanceCents, perSection, transactions, orders, streakDays] = await Promise.all([
    readBalance(userKey),
    sumEarningsPerSection(userKey),
    listTransactions(userKey, 50),
    listOrders(userKey, 20),
    computeEarningStreak(userKey),
  ]);

  if (balanceCents === null) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  return NextResponse.json({
    balanceCents,
    perSection,
    recent: { transactions, orders },
    streakDays,
  });
}
