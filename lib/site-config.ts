// Server-side accessor for the SiteConfig singleton (id=1) — same one-row
// pattern as ParentConfig. Holds the admin "kill switch" disabled-section list.
//
// server-only: pulls in Prisma, must never land in a client bundle.
import 'server-only';
import { prisma } from './prisma';
import { LEARNING_SECTION_KEYS } from './sections';

// Read the current disabled-section keys. Returns [] when the row is missing
// (first run) or the column holds anything unexpected — empty = everything on,
// which is the safe default (never block a section because config is absent).
export async function getDisabledSections(): Promise<string[]> {
  const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  return normalizeDisabled(row?.disabledSections);
}

// Coerce the loosely-typed JSON column into a clean string[] of KNOWN keys.
// Drops anything that isn't a recognized section so a stale key can't strand a
// page that no longer exists.
function normalizeDisabled(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (k): k is string => typeof k === 'string' && LEARNING_SECTION_KEYS.has(k),
  );
}

// Add or remove a single section key, upserting the singleton row. `enabled`
// true → remove from the disabled list (turn ON); false → add (turn OFF).
// Returns the new disabled list. Caller must have validated the key.
export async function setSectionEnabled(
  key: string,
  enabled: boolean,
): Promise<string[]> {
  const current = await getDisabledSections();
  const set = new Set(current);
  if (enabled) set.delete(key);
  else set.add(key);
  const next = [...set];

  await prisma.siteConfig.upsert({
    where: { id: 1 },
    create: { id: 1, disabledSections: next },
    update: { disabledSections: next },
  });
  return next;
}
