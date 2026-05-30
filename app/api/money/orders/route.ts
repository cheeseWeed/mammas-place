// GET /api/money/orders?user=<name>&limit=<n>
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser } from '@/lib/drive-progress';
import { listOrders } from '@/lib/money/balance';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50, 200);
  const rows = await listOrders(userParam, limit);
  return NextResponse.json({ orders: rows });
}
