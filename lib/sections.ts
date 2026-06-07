// Toggleable learning-section registry — the single source of truth for the
// admin "kill switch". An admin can turn any of these OFF site-wide (stored in
// SiteConfig.disabledSections as an array of these keys); a disabled section
// shows kids a friendly "being updated" message instead of the content.
//
// Keys here MUST match the route slug (the page lives at /<key>) so the page
// guard and the admin toggle line up without a separate mapping. Scripture
// Study and Music stay open on the Sabbath but are still individually
// toggleable here (a broken/wrong section should be killable any day).
//
// Safe to import from BOTH client and server — it's plain data + a pure helper,
// no Prisma / node-only imports.

export interface LearningSection {
  key: string;   // route slug, e.g. 'geography' → page at /geography
  label: string; // human label for the admin UI + gate message
  href: string;  // canonical href ("/" + key, kept explicit for clarity)
}

// The toggleable learning sections, in a sensible display order.
export const LEARNING_SECTIONS: readonly LearningSection[] = [
  { key: 'scripture-study', label: 'Scripture Study Guide', href: '/scripture-study' },
  { key: 'letters', label: 'Letters & Sounds', href: '/letters' },
  { key: 'geography', label: 'Geography', href: '/geography' },
  { key: 'drive', label: 'Drive (Utah License)', href: '/drive' },
  { key: 'spelling', label: 'Spelling', href: '/spelling' },
  { key: 'math', label: 'Math Arena', href: '/math' },
  { key: 'language-arts', label: 'Language Arts', href: '/language-arts' },
  { key: 'chess', label: 'Chess', href: '/chess' },
  { key: 'music', label: 'Practice Studio (Music)', href: '/music' },
  { key: 'chores', label: 'Family Chores', href: '/chores' },
] as const;

// Set of valid keys, for O(1) validation of an incoming toggle request.
export const LEARNING_SECTION_KEYS: ReadonlySet<string> = new Set(
  LEARNING_SECTIONS.map((s) => s.key),
);

// Is `key` a real toggleable section? Used to reject junk POSTs.
export function isValidSectionKey(key: unknown): key is string {
  return typeof key === 'string' && LEARNING_SECTION_KEYS.has(key);
}

// Is the section with this key currently ENABLED (i.e. NOT in the disabled
// list)? Defaults to ENABLED — an unknown key or a malformed list never blocks
// a section. `disabledList` is whatever came back from the API / SiteConfig.
export function isSectionEnabled(key: string, disabledList: unknown): boolean {
  if (!Array.isArray(disabledList)) return true; // unreachable/malformed → on
  return !disabledList.includes(key);
}
