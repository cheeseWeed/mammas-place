// Memorization aids — PURE logic only.
//
// Three ways to practice playing from memory, in the order a teacher would
// actually introduce them:
//
//   1. FADE     — some noteheads are blanked out. You still see the rhythm and
//                 the bar lines, so you know WHEN to play; you have to remember
//                 WHAT. Start at 20% hidden and work up.
//   2. COVER    — you look at a line, then it disappears and you play it back.
//                 All-or-nothing per line.
//   3. GROW     — bar 1 from memory. Then bars 1-2. Then 1-3. This is how a
//                 musician actually memorizes a piece for performance.
//
// WHY FADE COMES FIRST: hiding a whole line is a pass/fail test — a kid either
// has it or crashes on the first bar, learning nothing about WHERE the memory
// is thin. Blanking individual notes shows exactly which ones are shaky and can
// be tightened gradually. In the learning-science literature this is "fading",
// and it builds memory rather than merely measuring it. Both are forms of
// retrieval practice, which is why either beats re-reading the page.
//
// The hiding is DETERMINISTIC given a seed, so a kid can replay the exact same
// pattern to see if they improved, instead of getting a different random mask
// every attempt and never knowing whether they got better or got lucky.

import type { SongNote } from './sightread';

export type MemorizeMode = 'off' | 'fade' | 'cover' | 'grow';

export interface MemorizePlan {
  /** Indices whose PITCH is hidden — rhythm still shown. */
  hiddenNotes: Set<number>;
  /** How many bars are revealed (grow mode); Infinity when all are. */
  revealedBars: number;
  label: string;
}

/* ============================================================
   DETERMINISTIC PSEUDO-RANDOM
   ============================================================ */

/**
 * A tiny deterministic hash. Same (seed, index) always gives the same number,
 * so a fade pattern is reproducible across attempts and across devices.
 *
 * Deliberately NOT Math.random(): a kid who replays a passage needs the SAME
 * notes hidden, or "did I get better?" is unanswerable.
 */
export function hashUnit(seed: number, index: number): number {
  // Every step re-coerces to unsigned. Math.imul and ^= both yield SIGNED
  // 32-bit ints, so dropping a single >>> 0 lets h go negative — which made
  // every note compare below the fade fraction and hid the entire piece.
  let h = (Math.imul(seed, 2654435761) + Math.imul(index, 40503)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

/* ============================================================
   FADE
   ============================================================ */

/**
 * Hide roughly `fraction` of the pitches, spread through the piece.
 *
 * Rests are never hidden — there is nothing to remember about a rest, and
 * blanking one would just look like a rendering bug.
 */
export function fadeMask(notes: SongNote[], fraction: number, seed = 1): Set<number> {
  const f = Math.max(0, Math.min(1, fraction));
  const hidden = new Set<number>();
  if (f === 0) return hidden;

  notes.forEach((n, i) => {
    if (n.rest) return;
    if (hashUnit(seed, i) < f) hidden.add(i);
  });

  // At a non-zero setting on a real piece, hide at least one note. Otherwise a
  // kid moves the slider, nothing visibly changes, and the feature looks broken.
  if (hidden.size === 0) {
    const first = notes.findIndex(n => !n.rest);
    if (first >= 0) hidden.add(first);
  }
  return hidden;
}

/* ============================================================
   COVER / GROW
   ============================================================ */

/** Which note indices fall in each bar, by beats. Mirrors measureLayout. */
export function barsOf(notes: SongNote[], beatsPerBar: number): number[][] {
  const bars: number[][] = [];
  let cur: number[] = [];
  let beats = 0;

  notes.forEach((n, i) => {
    cur.push(i);
    beats += n.beats;
    if (beats >= beatsPerBar) {
      bars.push(cur);
      cur = [];
      beats = 0;
    }
  });
  if (cur.length) bars.push(cur);
  return bars;
}

/**
 * Build the plan for a mode.
 *
 * `step` means different things per mode, which keeps the UI to one control:
 *   - fade  : percent hidden, 0-100
 *   - cover : which line is currently covered (all of it, always)
 *   - grow  : how many bars you are playing from memory so far
 */
export function memorizePlan(
  notes: SongNote[],
  mode: MemorizeMode,
  step: number,
  beatsPerBar = 4,
  seed = 1,
): MemorizePlan {
  if (mode === 'off' || notes.length === 0) {
    return { hiddenNotes: new Set(), revealedBars: Infinity, label: 'Everything showing' };
  }

  if (mode === 'fade') {
    const pct = Math.max(0, Math.min(100, step));
    const hidden = fadeMask(notes, pct / 100, seed);
    return {
      hiddenNotes: hidden,
      revealedBars: Infinity,
      label: `${hidden.size} of ${notes.length} notes hidden — you still see the rhythm`,
    };
  }

  if (mode === 'cover') {
    // Everything hidden. The kid looks first, then plays it back blind.
    const hidden = new Set(notes.map((_, i) => i).filter(i => !notes[i]!.rest));
    return {
      hiddenNotes: hidden,
      revealedBars: Infinity,
      label: 'All notes covered — play it from memory',
    };
  }

  // grow: the first `step` bars are from memory, the rest still visible.
  const bars = barsOf(notes, beatsPerBar);
  const fromMemory = Math.max(0, Math.min(Math.floor(step), bars.length));
  const hidden = new Set<number>();
  for (let b = 0; b < fromMemory; b++) {
    for (const i of bars[b] ?? []) if (!notes[i]!.rest) hidden.add(i);
  }
  return {
    hiddenNotes: hidden,
    revealedBars: bars.length,
    label:
      fromMemory === 0
        ? `Nothing from memory yet — ${bars.length} bars to go`
        : fromMemory >= bars.length
          ? `The whole piece from memory (${bars.length} bars)`
          : fromMemory === 1
            ? 'Bar 1 from memory, the rest still showing'
            : `Bars 1–${fromMemory} from memory, the rest still showing`,
  };
}

/**
 * How well did that go, and should the difficulty move?
 *
 * Nudges by one step at a time. Jumping a kid from 20% hidden straight to 80%
 * because they nailed one run is how a practice tool stops being used.
 */
export function suggestNextStep(mode: MemorizeMode, step: number, accuracy: number, totalBars = 8): number {
  if (mode === 'fade') {
    if (accuracy >= 90) return Math.min(90, step + 10);
    if (accuracy < 60) return Math.max(0, step - 10);
    return step;
  }
  if (mode === 'grow') {
    if (accuracy >= 85) return Math.min(totalBars, step + 1);
    if (accuracy < 60) return Math.max(0, step - 1);
    return step;
  }
  return step;
}
