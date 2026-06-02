// Seed Shepherd's 4 cello pieces + his July "Cello Camp Sprint" challenge.
//
// Idempotent: re-running won't duplicate pieces (matched by title) and won't
// wipe any practice logs already recorded — it only fills in missing pieces
// and (re)writes the challenge config. The award-bookkeeping flags on an
// existing challenge are preserved so paid bonuses stay paid.
//
// Usage (requires DATABASE_URL in env — same Neon string Prisma uses):
//   node scripts/seed-shepherd-music.mjs
//
// Line counts are estimates from the PDFs' page counts (total = 68). Adjust
// any of them later in the parent admin (/admin/music) — they drive the daily
// plan, so getting them roughly right matters more than exact.

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// Who. Change if Shepherd's normalized username differs.
const USER = 'shepherd';

// The 4 cello pieces. estLines sum = 68 (his stated total).
// pdfHref points at /public/sheet-music (served by the app, deploys to prod).
const PIECES = [
  { title: 'Dragon Dances',     instrument: 'cello', estLines: 18, difficulty: 'medium', targetDate: '2026-06-19', pdfHref: '/sheet-music/dragon-dances-cello.pdf' },
  { title: 'Golden',            instrument: 'cello', estLines: 20, difficulty: 'hard',   targetDate: '2026-06-26', pdfHref: '/sheet-music/golden-cello.pdf' },
  { title: 'One Bow Concerto',  instrument: 'cello', estLines: 18, difficulty: 'medium', targetDate: '2026-06-26', pdfHref: '/sheet-music/one-bow-concerto-cello.pdf' },
  { title: 'Carnival Lion',     instrument: 'cello', estLines: 12, difficulty: 'easy',   targetDate: '2026-06-19', pdfHref: '/sheet-music/carnival-lion-cello.pdf' },
];

// Shepherd's stated daily goal: 3.5 lines/day, ONE song at a time (~1/week).
// Settable later in the app.
const DAILY_LINE_GOAL = 3.5;
const GOAL_MODE = 'one-at-a-time';

function newId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

async function main() {
  const user = await prisma.driveUser.findUnique({ where: { name: USER } });
  if (!user) {
    console.error(`✗ No DriveUser named "${USER}". Have Shepherd register/log in once at /drive, then re-run.`);
    process.exit(1);
  }

  const raw = (user.music && typeof user.music === 'object') ? user.music : {};
  const pieces = Array.isArray(raw.pieces) ? raw.pieces : [];

  // Add any missing pieces (match by title, case-insensitive).
  const byTitle = new Map(pieces.map((p) => [String(p.title).toLowerCase(), p]));
  for (const seed of PIECES) {
    const key = seed.title.toLowerCase();
    if (byTitle.has(key)) {
      console.log(`· "${seed.title}" already present — leaving its log intact.`);
      continue;
    }
    const piece = {
      id: newId(),
      title: seed.title,
      instrument: seed.instrument,
      estLines: seed.estLines,
      difficulty: seed.difficulty,
      targetDate: seed.targetDate,
      pdfHref: seed.pdfHref,
      addedBy: 'parent',
      createdAt: new Date().toISOString(),
      log: [],
    };
    pieces.push(piece);
    byTitle.set(key, piece);
    console.log(`+ Added "${seed.title}" (${seed.estLines} lines, target ${seed.targetDate}).`);
  }

  // Build / refresh the July challenge. Preserve award flags + id if present.
  const existing = raw.challenge ?? {};
  const challengePieceIds = PIECES.map((s) => byTitle.get(s.title.toLowerCase()).id);
  const challenge = {
    id: existing.id ?? newId(),
    name: "Shepherd's Cello Camp Sprint",
    startDate: '2026-06-01',
    endDate: '2026-07-07',            // camp day
    pieceIds: challengePieceIds,
    passOffRewardCents: 200 * 100,    // 200 MP gift card per piece passed off
    finishAllBy: '2026-07-01',        // all 4 done by July 1
    finishAllBonusCents: 500 * 100,   // → 500 MP bonus
    playAllInOneDayBy: '2026-07-07',  // play all 4 well in one day by camp
    playAllInOneDayMinScore: 8,       // "well" = 8/10 or better
    playAllInOneDayBonusCents: 250 * 100, // → 250 MP bonus
    finishAllAwardedAt: existing.finishAllAwardedAt,
    playAllInOneDayAwardedAt: existing.playAllInOneDayAwardedAt,
  };

  // Fix any stale pdfHrefs on already-present pieces (e.g. old bare filenames)
  // so the "Open sheet music" link works in the app.
  for (const seed of PIECES) {
    const pc = byTitle.get(seed.title.toLowerCase());
    if (pc && pc.pdfHref !== seed.pdfHref) {
      pc.pdfHref = seed.pdfHref;
      console.log(`· Fixed sheet-music link for "${seed.title}".`);
    }
  }

  await prisma.driveUser.update({
    where: { name: USER },
    data: { music: { pieces, challenge, dailyLineGoal: DAILY_LINE_GOAL, goalMode: GOAL_MODE } },
  });

  console.log(`\n✓ Seeded ${PIECES.length} pieces + "${challenge.name}" for ${USER}.`);
  console.log(`  Goal: ${DAILY_LINE_GOAL} lines/day, ${GOAL_MODE}.`);
  console.log(`  Per pass-off: 200 MP · All by Jul 1: 500 MP · All-in-one-day by Jul 7: 250 MP · up to 100 MP/day.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
