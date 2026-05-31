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

// Sum lifetime MpEarning cents per section. Sections without any earnings
// come back as 0 so the UI can render the full grid without extra checks.
// We include `chess` even though the earn API doesn't credit it yet — it's
// listed in the wallet grid for completeness so kids see it as a section.
export type PerSectionEarnings = {
  math: number;
  spelling: number;
  languageArts: number;
  geography: number;
  drive: number;
  chess: number;
};

export async function sumEarningsPerSection(rawUser: string): Promise<PerSectionEarnings> {
  const userKey = normalizeUser(rawUser);
  const rows = await prisma.mpEarning.groupBy({
    by: ['section'],
    where: { userName: userKey },
    _sum: { cents: true },
  });
  const out: PerSectionEarnings = {
    math: 0,
    spelling: 0,
    languageArts: 0,
    geography: 0,
    drive: 0,
    chess: 0,
  };
  for (const r of rows) {
    const key = r.section as keyof PerSectionEarnings;
    if (key in out) {
      out[key] = r._sum.cents ?? 0;
    }
  }
  return out;
}

// Consecutive-days streak ending today (or yesterday — we allow a one-day
// grace so a kid who hasn't earned yet today still sees their streak in the
// morning). Counts only distinct calendar dates with at least one MpEarning.
//
// Uses each row's local-date string (YYYY-MM-DD in the server's TZ) to bucket
// — server runs in UTC on Vercel, which means streaks reset at UTC midnight.
// Good enough for v1; tweak if it ever becomes user-visible misalignment.
export async function computeEarningStreak(rawUser: string): Promise<number> {
  const userKey = normalizeUser(rawUser);
  // Look back ~120 days max — way more than any realistic streak, keeps the
  // query bounded.
  const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const rows = await prisma.mpEarning.findMany({
    where: { userName: userKey, createdAt: { gte: cutoff } },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!rows.length) return 0;

  const dayKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const days = new Set<string>();
  for (const r of rows) days.add(dayKey(r.createdAt));

  // Start counting from today; if today has no earn, allow yesterday as the
  // anchor so the streak doesn't visually reset until a full day is skipped.
  const today = new Date();
  let anchor = new Date(today);
  if (!days.has(dayKey(anchor))) {
    anchor = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
    if (!days.has(dayKey(anchor))) return 0;
  }

  let streak = 0;
  const cursor = new Date(anchor);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Parent-facing helpers.

export async function listAllLearners() {
  return prisma.driveUser.findMany({
    select: {
      name: true,
      displayName: true,
      balanceCents: true,
      updatedAt: true,
      // Phase 6a — surface the MP card number to the admin so the parent can
      // see/reroll it from the dashboard.
      mpCardNumber: true,
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
