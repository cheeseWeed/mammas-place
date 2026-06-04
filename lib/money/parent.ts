// Parent admin gate — separate from learner (kid) PINs.
// Singleton ParentConfig row holds the hash. After login a signed, timestamped
// `mp_parent` SESSION cookie is set (clears on browser close + 30-min hard cap).
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
// Admin godmode is deliberately short-lived and strict:
//   1. SESSION cookie (no maxAge) → the browser drops it when it closes, so an
//      admin who closes the tab is logged out.
//   2. HARD 30-minute server cap → even with the browser left open, godmode
//      expires 30 min after login. Enforced by stamping the login time INTO
//      the cookie value and checking it on every isParentAuthenticated().
// Shorter than the kid's 2h session on purpose — admin powers shouldn't linger.
const PARENT_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

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

// Sign a login timestamp so the client can't edit it to extend godmode.
// Value shape: "<issuedAtMs>.<hmac>". HMAC keyed on the existing parent salt.
function signStamp(issuedAtMs: number): string {
  const sig = createHash('sha256').update(`${issuedAtMs}.${PARENT_SALT}`).digest('hex').slice(0, 24);
  return `${issuedAtMs}.${sig}`;
}

function verifyStamp(value: string | undefined): boolean {
  if (!value) return false;
  // Back-compat: an old "1" cookie from before the stamping change → treat as
  // expired so the admin simply logs in again (gets a fresh stamped cookie).
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const issuedAtMs = Number(value.slice(0, dot));
  if (!Number.isFinite(issuedAtMs)) return false;
  if (value !== signStamp(issuedAtMs)) return false; // tampered
  return Date.now() - issuedAtMs <= PARENT_MAX_AGE_MS; // within 30 min
}

export async function isParentAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifyStamp(jar.get(PARENT_COOKIE)?.value);
}

export async function setParentCookie(): Promise<void> {
  const jar = await cookies();
  // No maxAge → SESSION cookie (cleared on browser close). The signed timestamp
  // inside enforces the 30-minute hard cap regardless.
  jar.set(PARENT_COOKIE, signStamp(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function clearParentCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
}
