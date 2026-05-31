// Parent admin gate — separate from learner (kid) PINs.
// Singleton ParentConfig row holds the hash. Cookie `mp_parent=1` once verified.
//
// PIN format: 4-12 alphanumeric chars (loosened from 4-digit so the parent
// can use a real password like `mp2186`). First-time seed PIN is `mp2186`
// (see app/api/money/parent/login/route.ts). If a stale `0000` seed already
// exists in the ParentConfig row, the parent must log in with `0000` once
// and rotate to `mp2186` via the Settings panel.

import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '../prisma';

const PARENT_SALT = 'mp-parent-salt';
const PARENT_COOKIE = 'mp_parent';
const PARENT_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

// The well-known seed PIN used for first-time setup. Anyone can seed the row
// to this value (so a kid can't lock mom out by picking something custom).
// After first login mom rotates from here via the Settings panel.
export const SEED_PARENT_PIN = 'mp2186';

export function hashParentPin(pin: string): string {
  return createHash('sha256').update(pin + PARENT_SALT).digest('hex');
}

// 4-12 alphanumeric chars (loosened from `\d{4}`). Lets the parent use a real
// short password like `mp2186` instead of a numeric PIN.
const PARENT_PIN_RE = /^[A-Za-z0-9]{4,12}$/;
export function isValidParentPin(pin: unknown): pin is string {
  return typeof pin === 'string' && PARENT_PIN_RE.test(pin);
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
