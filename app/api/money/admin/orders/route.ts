// GET /api/money/admin/orders
// Parent-gated. Returns the most recent orders across ALL learners — feeds the
// "All recent orders" section of the MP Bank dashboard. Default cap of 100
// matches the prompt + keeps the response small.
import { NextResponse } from 'next/server';
import { listAllOrders } from '@/lib/money/balance';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const orders = await listAllOrders(100);
  return NextResponse.json({ orders });
}
