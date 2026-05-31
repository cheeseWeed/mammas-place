// MP Account Card helpers — Phase 6a.
//
// Each kid gets a short 4-digit "card number" they can put on a laminated
// card. The number is RECEIVE-ONLY: knowing it lets you credit the kid (Phase
// 6b /give endpoint) but never debit them. The PIN remains the credential
// for spending. See app/money/PLAN-Phase6-Cards.md.
//
// Number space: 0100-9999 (~9900 slots — reserves 0000-0099 for parent/system
// use). With <10 kids, collision odds are vanishing, but we still retry up to
// 5 times to be safe against the unique-constraint race.

import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';

const RESERVED_FLOOR = 100;   // 0000-0099 reserved
const SPACE_CEILING = 10000;  // exclusive upper bound — gives 0100..9999
const MAX_RETRIES = 5;

/**
 * Returns a fresh 4-digit card number string (e.g. "7821"). NOT checked for
 * collisions here — that's the caller's job inside the DB transaction (we
 * rely on the @unique constraint to catch races).
 */
export function generateCardNumber(): string {
  // randomInt(min, max) returns [min, max). We want [100, 10000).
  const n = randomInt(RESERVED_FLOOR, SPACE_CEILING);
  return n.toString().padStart(4, '0');
}

/** Display format — "MP·7821" with the middle-dot bullet separator. */
export function formatCard(number: string): string {
  return `MP·${number}`;
}

// Prisma's P2002 = unique constraint failure. We re-roll on that exact code
// only; any other Prisma error bubbles up.
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Ensures the kid has a card number. If they already have one, returns it
 * unchanged (idempotent). If they don't, mints a new one with collision
 * retry. Throws "User not found" if the kid isn't registered.
 */
export async function issueCardForUser(rawUser: string): Promise<string> {
  const userKey = normalizeUser(rawUser);
  const existing = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { mpCardNumber: true },
  });
  if (!existing) throw new Error('User not found');
  if (existing.mpCardNumber) return existing.mpCardNumber;

  // Retry loop — generate, attempt update, swallow P2002 and try again.
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generateCardNumber();
    try {
      const updated = await prisma.driveUser.update({
        where: { name: userKey },
        data: { mpCardNumber: candidate, mpCardCreatedAt: new Date() },
        select: { mpCardNumber: true },
      });
      if (updated.mpCardNumber) return updated.mpCardNumber;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Collision — loop and try a new number.
    }
  }
  throw new Error('Could not allocate a unique card number; please retry');
}

/**
 * Replaces an existing card number with a fresh one. Used when a card leaks
 * and the parent wants to rotate it. Same retry-on-collision logic.
 */
export async function rerollCardForUser(rawUser: string): Promise<string> {
  const userKey = normalizeUser(rawUser);
  const existing = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { name: true },
  });
  if (!existing) throw new Error('User not found');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generateCardNumber();
    try {
      const updated = await prisma.driveUser.update({
        where: { name: userKey },
        data: { mpCardNumber: candidate, mpCardCreatedAt: new Date() },
        select: { mpCardNumber: true },
      });
      if (updated.mpCardNumber) return updated.mpCardNumber;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Could not allocate a unique card number; please retry');
}

/**
 * Look up a kid's card number without minting one. Returns null if no card
 * has been issued yet (or the user doesn't exist).
 */
export async function readCardForUser(rawUser: string): Promise<string | null> {
  const userKey = normalizeUser(rawUser);
  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { mpCardNumber: true },
  });
  return row?.mpCardNumber ?? null;
}
