// MP Money — balance, ledger, and order helpers.
// Server-only. Every mutation runs in a Prisma transaction so balance and
// the transaction row stay consistent. See app/money/PLAN.md.

import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';

export type TransactionType = 'earn' | 'spend' | 'gift' | 'refund' | 'adjust';

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  priceCents: number;
}

export async function readBalance(rawUser: string): Promise<number | null> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return null;
  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { balanceCents: true },
  });
  return row ? row.balanceCents : null;
}

// Positive `cents` only. Type controls the ledger label. Returns new balance.
export async function credit(
  rawUser: string,
  cents: number,
  type: TransactionType,
  reason: string,
): Promise<number> {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error('credit() requires positive integer cents');
  }
  const userKey = normalizeUser(rawUser);
  return prisma.$transaction(async (tx) => {
    const user = await tx.driveUser.findUnique({ where: { name: userKey } });
    if (!user) throw new Error('User not found');
    const updated = await tx.driveUser.update({
      where: { name: userKey },
      data: { balanceCents: { increment: cents } },
      select: { balanceCents: true },
    });
    await tx.mpTransaction.create({
      data: { userName: userKey, cents, type, reason },
    });
    return updated.balanceCents;
  });
}

// Positive `cents` value, written to ledger as negative. Throws on insufficient funds.
export async function debit(
  rawUser: string,
  cents: number,
  type: TransactionType,
  reason: string,
  orderId?: string,
): Promise<number> {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error('debit() requires positive integer cents');
  }
  const userKey = normalizeUser(rawUser);
  return prisma.$transaction(async (tx) => {
    const user = await tx.driveUser.findUnique({ where: { name: userKey } });
    if (!user) throw new Error('User not found');
    if (user.balanceCents < cents) throw new InsufficientFundsError(user.balanceCents, cents);
    const updated = await tx.driveUser.update({
      where: { name: userKey },
      data: { balanceCents: { decrement: cents } },
      select: { balanceCents: true },
    });
    await tx.mpTransaction.create({
      data: { userName: userKey, cents: -cents, type, reason, orderId: orderId ?? null },
    });
    return updated.balanceCents;
  });
}

// Place an order — atomically debits the user and writes the MpOrder + ledger rows.
// Returns the created order id and new balance.
export async function placeOrder(
  rawUser: string,
  items: OrderItem[],
  totalCents: number,
): Promise<{ orderId: string; balanceCents: number }> {
  if (!items.length) throw new Error('Order has no items');
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error('Order total must be positive integer cents');
  }
  const userKey = normalizeUser(rawUser);

  return prisma.$transaction(async (tx) => {
    const user = await tx.driveUser.findUnique({ where: { name: userKey } });
    if (!user) throw new Error('User not found');
    if (user.balanceCents < totalCents) {
      throw new InsufficientFundsError(user.balanceCents, totalCents);
    }
    const order = await tx.mpOrder.create({
      data: {
        userName: userKey,
        items: items as unknown as object,
        totalCents,
        status: 'fulfilled',
      },
    });
    await tx.driveUser.update({
      where: { name: userKey },
      data: { balanceCents: { decrement: totalCents } },
    });
    await tx.mpTransaction.create({
      data: {
        userName: userKey,
        cents: -totalCents,
        type: 'spend',
        reason: `Order ${order.id}`,
        orderId: order.id,
      },
    });
    return { orderId: order.id, balanceCents: user.balanceCents - totalCents };
  });
}

export async function listTransactions(rawUser: string, limit = 50) {
  const userKey = normalizeUser(rawUser);
  return prisma.mpTransaction.findMany({
    where: { userName: userKey },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function listOrders(rawUser: string, limit = 50) {
  const userKey = normalizeUser(rawUser);
  return prisma.mpOrder.findMany({
    where: { userName: userKey },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// Parent-facing helpers.

export async function listAllLearners() {
  return prisma.driveUser.findMany({
    select: {
      name: true,
      displayName: true,
      balanceCents: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function listAllOrders(limit = 100) {
  return prisma.mpOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export class InsufficientFundsError extends Error {
  constructor(public balanceCents: number, public neededCents: number) {
    super(`Insufficient funds: have ${balanceCents}, need ${neededCents}`);
    this.name = 'InsufficientFundsError';
  }
}
