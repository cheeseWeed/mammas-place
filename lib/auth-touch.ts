// Bumps the dl_user cookie's TTL so an active session doesn't get logged out
// by the 2-hour absolute cap. Any kid-authed endpoint can call this after
// confirming the cookie matches the request — keeps the kid logged in as
// long as they're actually using the site.
//
// No-op if the cookie isn't set (anonymous request).
import { cookies } from 'next/headers';

const COOKIE_NAME = 'dl_user';
const COOKIE_MAX_AGE_SEC = 2 * 60 * 60; // 7200 — must match login/register

export async function touchSession(): Promise<void> {
  const jar = await cookies();
  const current = jar.get(COOKIE_NAME);
  if (!current || !current.value || current.value === '__anon__') return;
  // Re-set with the same value but a fresh max-age. Path + samesite must
  // match the original set or the browser may keep both copies.
  jar.set(COOKIE_NAME, current.value, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}
