// One-shot patcher: injects a fire-and-forget POST to /api/drive/progress
// at the end of each quiz/exam grade() function in public/drive-assets/.
// Idempotent: skips files that already contain the SYNC_MARKER.
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'public', 'drive-assets');
const SYNC_MARKER = '/* DL_SYNC_BLOCK */';

// Snippet inserted after the SR localStorage write in classic quizzes/exams.
// Reads localStorage to keep behaviour consistent with what the page just wrote.
const SYNC_SNIPPET = `
  ${SYNC_MARKER}
  try {
    var __dlUser = localStorage.getItem('dl_user');
    if (__dlUser && __dlUser !== '__anon__') {
      fetch('/api/drive/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user: __dlUser,
          attempts: JSON.parse(localStorage.getItem('dl_attempts') || '[]'),
          misses: JSON.parse(localStorage.getItem('dl_misses') || '[]'),
          unitScores: JSON.parse(localStorage.getItem('dl_unit_scores') || '{}'),
          sr: JSON.parse(localStorage.getItem('dl_sr') || '{}'),
          mode: JSON.parse(localStorage.getItem('dl_mode') || 'null')
        }),
        keepalive: true
      }).catch(function(){});
    }
  } catch (e) {}
`;

// Snippet for weak-spots.html / due-today.html which use lsSet/recordAttempt helpers.
// We hook it inside recordAttempt after the lsSet write.
const SYNC_SNIPPET_HELPER = `
  ${SYNC_MARKER}
  try {
    var __dlUser = localStorage.getItem('dl_user');
    if (__dlUser && __dlUser !== '__anon__') {
      fetch('/api/drive/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user: __dlUser,
          attempts: lsGet(LS.attempts, []),
          misses: lsGet(LS.misses, []),
          unitScores: lsGet('dl_unit_scores', {}),
          sr: lsGet(LS.sr, {}),
          mode: lsGet('dl_mode', null)
        }),
        keepalive: true
      }).catch(function(){});
    }
  } catch (e) {}
`;

// 16 classic files (one localStorage.setItem("dl_sr", ...) line each)
const CLASSIC_FILES = [
  'quizzes/unit-1-test-a.html',
  'quizzes/unit-1-test-b.html',
  'quizzes/unit-2-test-a.html',
  'quizzes/unit-2-test-b.html',
  'quizzes/unit-3-test-a.html',
  'quizzes/unit-3-test-b.html',
  'quizzes/unit-4-test-a.html',
  'quizzes/unit-4-test-b.html',
  'quizzes/unit-5-test-a.html',
  'quizzes/unit-5-test-b.html',
  'quizzes/commonly-missed-a.html',
  'quizzes/commonly-missed-b.html',
  'exams/final-a.html',
  'exams/final-b.html',
  'exams/final-c.html',
  'exams/simulator.html',
];

const HELPER_FILES = [
  'quizzes/weak-spots.html',
  'quizzes/due-today.html',
];

async function patchClassic(rel) {
  const fp = path.join(ROOT, rel);
  let src = await fs.readFile(fp, 'utf-8');
  if (src.includes(SYNC_MARKER)) {
    console.log('[skip]   ' + rel + ' (already patched)');
    return;
  }
  // Anchor: the last "localStorage.setItem(\"dl_sr\", ...)" call.
  // We insert the sync snippet right after that line.
  const re = /localStorage\.setItem\(\s*["']dl_sr["']\s*,\s*JSON\.stringify\(sr\)\s*\)\s*;/;
  const m = src.match(re);
  if (!m) {
    console.warn('[WARN]   ' + rel + ' — no dl_sr setItem anchor found, leaving alone');
    return;
  }
  const idx = m.index + m[0].length;
  src = src.slice(0, idx) + '\n' + SYNC_SNIPPET + src.slice(idx);
  await fs.writeFile(fp, src, 'utf-8');
  console.log('[patch]  ' + rel);
}

async function patchHelper(rel) {
  const fp = path.join(ROOT, rel);
  let src = await fs.readFile(fp, 'utf-8');
  if (src.includes(SYNC_MARKER)) {
    console.log('[skip]   ' + rel + ' (already patched)');
    return;
  }
  // Anchor: inside recordAttempt, after  lsSet(LS.attempts, attempts);
  const re = /lsSet\(\s*LS\.attempts\s*,\s*attempts\s*\)\s*;/;
  const m = src.match(re);
  if (!m) {
    console.warn('[WARN]   ' + rel + ' — no LS.attempts lsSet anchor found, leaving alone');
    return;
  }
  const idx = m.index + m[0].length;
  src = src.slice(0, idx) + '\n' + SYNC_SNIPPET_HELPER + src.slice(idx);
  await fs.writeFile(fp, src, 'utf-8');
  console.log('[patch]  ' + rel);
}

const main = async () => {
  for (const f of CLASSIC_FILES) await patchClassic(f);
  for (const f of HELPER_FILES) await patchHelper(f);
  console.log('Done.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
