// Parent admin gate — separate from learner (kid) PINs.
// Singleton ParentConfig row holds the hash. Cookie `mp_parent=1` once verified.
//
// Initial PIN: see app/money/PLAN.md (defaults to 0000 on first setup if you
// hit /api/money/parent/setup with no current PIN).

import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '../prisma';

const PARENT_SALT = 'mp-parent-salt';
const PARENT_COOKIE = 'mp_parent';
const PARENT_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export function hashParentPin(pin: string): string {
  return createHash('sha256').update(pin + PARENT_SALT).digest('hex');
}

export function isValidParentPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// Read the ParentConfig row; returns null if never set.
export async function getParentConfig() {
  return prisma.parentConfig.findUnique({ where: { id: 1 } });
}

export async function isParentAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(PARENT_COOKIE)?.value === '1';
}

export async function setParentCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(PARENT_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PARENT_COOKIE_MAX_AGE,
  });
}

export async function clearParentCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
}
