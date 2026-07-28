// Bumps the dl_user cookie's TTL so an active session doesn't get logged out
// by the absolute cap. Any kid-authed endpoint can call this after
// confirming the cookie matches the request — keeps the kid logged in as
// long as they're actually using the site.
//
// No-op if the cookie isn't set (anonymous request).
import { cookies } from 'next/headers';

const COOKIE_NAME = 'dl_user';
// 8-hour TTL, shared by login/register/impersonate and the sliding refresh
// below. Was 2h, but kids doing a long driver-license study session (decks +
// quizzes) were getting logged out mid-quiz (lilly, feedback 2026-07). 8h
// covers a full study day; the server-issued maxAge still logs out powered-
// off laptops / crashed browsers, and every authed API call slides the
// window forward so an ACTIVE kid never expires.
export const DL_COOKIE_MAX_AGE_SEC = 8 * 60 * 60; // 28800

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
    maxAge: DL_COOKIE_MAX_AGE_SEC,
  });
}
