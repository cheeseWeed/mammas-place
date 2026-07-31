// Sabbath (Sunday) helpers — single source of truth for the whole app.
//
// On Sundays: the shop is hidden and most learning sections are closed. Only
// Scripture Study Guide, Music, and Audiobooks stay open. The home page shows
// a Sabbath note (commandment + study-the-scriptures encouragement).
//
// We compute the day in US Mountain time (the family's timezone) so the rule
// flips at local midnight, NOT at the server's UTC midnight. Using a fixed
// zone keeps client components and server components in agreement.

const FAMILY_TZ = 'America/Denver';

// Day of week (0 = Sunday .. 6 = Saturday) in the family's timezone.
export function familyDayOfWeek(now: Date = new Date()): number {
  // Intl gives us the weekday name in the target zone; map it to 0..6.
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: FAMILY_TZ,
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? now.getDay();
}

// Admin day-override cookie. Lets an admin preview the site as if it were
// Sunday (or force a weekday) for testing the Sabbath gating. Readable on both
// client and server (not httpOnly). Values: 'sun' | 'wkdy' | unset.
export const SABBATH_OVERRIDE_COOKIE = 'mp_sabbath_override';

// Read the override from a cookie string (works in both environments: pass
// document.cookie on the client, or the Cookie header value on the server).
function readOverride(cookieStr: string | undefined | null): 'sun' | 'wkdy' | null {
  if (!cookieStr) return null;
  const m = cookieStr.match(new RegExp(`(?:^|; )${SABBATH_OVERRIDE_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === 'sun' || v === 'wkdy' ? v : null;
}

// Is an admin present in this cookie string? Server sees the httpOnly
// `mp_parent`; client sees the non-httpOnly `mp_admin_present` marker. The
// "view as day" override is ONLY honored for admins, so a stray override cookie
// can never strand a logged-out kid on the wrong day.
function adminPresent(cookieStr: string): boolean {
  return /(?:^|; )mp_parent=/.test(cookieStr) || /(?:^|; )mp_admin_present=1/.test(cookieStr);
}

// Is it the Sabbath (Sunday) right now? Honors the admin "view as day" override
// ONLY when an admin is present. On the client we auto-read document.cookie; on
// the server pass the cookie header explicitly via `cookieStr`.
export function isSabbath(now: Date = new Date(), cookieStr?: string): boolean {
  const cookies = cookieStr ?? (typeof document !== 'undefined' ? document.cookie : '');
  if (adminPresent(cookies)) {
    const override = readOverride(cookies);
    if (override === 'sun') return true;
    if (override === 'wkdy') return false;
  }
  return familyDayOfWeek(now) === 0;
}

// Learning section keys that REMAIN open on the Sabbath. Everything else
// (geography, drive, spelling, math, language arts, chess, chores, shop) is
// closed until Monday.
export const SABBATH_OPEN_SECTIONS = ['scripture', 'music', 'audiobooks'] as const;

export type SabbathOpenSection = (typeof SABBATH_OPEN_SECTIONS)[number];

// Route slugs / category keys that mean the same thing as a canonical entry in
// SABBATH_OPEN_SECTIONS. Callers pass whatever key they naturally have (a route
// slug like 'scripture-study', a shop category like 'audiobooks'), and we
// normalize it here. Without this, a page passing 'scripture-study' would NOT
// match the canonical 'scripture' key and would be treated as closed.
const SECTION_ALIASES: Record<string, SabbathOpenSection> = {
  scripture: 'scripture',
  'scripture-study': 'scripture',
  'study-guides': 'scripture',
  music: 'music',
  audiobooks: 'audiobooks',
  audiobook: 'audiobooks',
};

// Resolve an arbitrary section/route/category key to its canonical Sabbath
// section, or null when the key isn't one of the Sabbath-open sections.
export function resolveSabbathSection(
  key: string | null | undefined,
): SabbathOpenSection | null {
  if (typeof key !== 'string') return null;
  const normalized = key.trim().toLowerCase().replace(/^\/+/, '');
  if (normalized.length === 0) return null;
  return SECTION_ALIASES[normalized] ?? null;
}

// Is this section allowed to stay open on the Sabbath?
//
// NOTE: this answers "is this LEARNING/LISTENING content open" — it is NOT a
// purchase check. Buying is closed on the Sabbath for EVERY section, including
// the open ones; see isPurchaseAllowed().
export function isSectionOpenOnSabbath(key: string | null | undefined): boolean {
  return resolveSabbathSection(key) !== null;
}

// Should this section's content be visible right now?
// Open sections are always visible; everything else is hidden on the Sabbath.
export function isSectionAccessible(
  key: string | null | undefined,
  sabbathNow: boolean,
): boolean {
  if (!sabbathNow) return true;
  return isSectionOpenOnSabbath(key);
}

// Buying/checkout is closed on the Sabbath — with NO section exemptions. A kid
// may LISTEN to an audiobook on Sunday, but may not purchase one. Keep this
// separate from the content check so the two can never drift together.
export function isPurchaseAllowed(sabbathNow: boolean): boolean {
  return !sabbathNow;
}

// The Sabbath note shown on the home page.
export const SABBATH_COMMANDMENT =
  'Remember the sabbath day, to keep it holy. … But the seventh day is the sabbath of the Lord thy God.';
export const SABBATH_COMMANDMENT_REF = 'Exodus 20:8–10';
export const SABBATH_ENCOURAGEMENT =
  'Today is the Lord’s day — a day to rest from work and shopping, study the scriptures, and worship. The shop and most learning are closed; Scripture Study, Music, and Audiobooks are open.';
