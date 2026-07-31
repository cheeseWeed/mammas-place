// Sabbath invariant guard.
//
// Shepherd reported he could not listen to audiobooks on Sunday even though
// audiobooks is a Sabbath-OPEN section. The root cause was key mismatch: a page
// passing a route slug like 'scripture-study' never matched the canonical
// 'scripture' entry in SABBATH_OPEN_SECTIONS, so it read as closed.
//
// These tests pin the two halves of the rule so they can never drift back
// together: LISTENING to an open section is allowed on the Sabbath, and BUYING
// is closed on the Sabbath with no exemptions at all.
import { describe, it, expect } from 'vitest';
import {
  resolveSabbathSection,
  isSectionOpenOnSabbath,
  isSectionAccessible,
  isPurchaseAllowed,
  SABBATH_OPEN_SECTIONS,
} from '../sabbath';

describe('Sabbath section resolution', () => {
  it('resolves the route slug that caused the bug', () => {
    expect(resolveSabbathSection('scripture-study')).toBe('scripture');
  });

  it('resolves every canonical section to itself', () => {
    for (const key of SABBATH_OPEN_SECTIONS) {
      expect(resolveSabbathSection(key)).toBe(key);
    }
  });

  it('is tolerant of casing, whitespace and a leading slash', () => {
    expect(resolveSabbathSection('  Audiobooks ')).toBe('audiobooks');
    expect(resolveSabbathSection('/music')).toBe('music');
  });

  it('returns null for closed sections and junk input', () => {
    for (const key of ['shop', 'math', 'chess', 'drive', '', '   ', null, undefined]) {
      expect(resolveSabbathSection(key as string)).toBeNull();
    }
  });
});

describe('what a kid can reach on Sunday', () => {
  const SUNDAY = true;

  it('lets audiobooks be listened to — the reported bug', () => {
    expect(isSectionAccessible('audiobooks', SUNDAY)).toBe(true);
  });

  it('keeps scripture and music open, by slug or canonical key', () => {
    expect(isSectionAccessible('scripture-study', SUNDAY)).toBe(true);
    expect(isSectionAccessible('scripture', SUNDAY)).toBe(true);
    expect(isSectionAccessible('music', SUNDAY)).toBe(true);
  });

  it('keeps every other section closed', () => {
    for (const key of ['shop', 'math', 'spelling', 'geography', 'drive', 'chess']) {
      expect(isSectionAccessible(key, SUNDAY)).toBe(false);
    }
  });

  it('opens everything on a weekday', () => {
    for (const key of ['shop', 'math', 'audiobooks', 'chess']) {
      expect(isSectionAccessible(key, false)).toBe(true);
    }
  });
});

describe('buying stays closed on the Sabbath', () => {
  it('blocks purchases on Sunday and allows them otherwise', () => {
    expect(isPurchaseAllowed(true)).toBe(false);
    expect(isPurchaseAllowed(false)).toBe(true);
  });

  it('grants NO purchase exemption to any Sabbath-open section', () => {
    // The whole point of splitting the two checks: an open section must never
    // imply a purchase is allowed. Listening is free; the shop is shut.
    for (const key of SABBATH_OPEN_SECTIONS) {
      expect(isSectionOpenOnSabbath(key)).toBe(true);
      expect(isPurchaseAllowed(true)).toBe(false);
    }
  });
});
