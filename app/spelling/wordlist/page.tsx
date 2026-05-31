'use client';

// Printable weekly word list — parent-facing helper page.
//
// Parents pick a level + a list size (10/15/20 words), optionally seed it
// from a date (so "Week of May 30" always shuffles the same words), and hit
// print. The print stylesheet hides everything except the list and adds a
// signature line for tracking practice at home.
//
// Two-column print layout with checkbox + writing line per word, plus the
// sentence printed beneath so the parent can dictate it. We pull from the
// full data/spelling/words.json bank but cap the per-level pool so we don't
// blow the page on L7 (300+ words).
//
// Not gated — this is a take-home artifact. Linking from the gated hub still
// requires login, so a stray bookmark to this URL leaks nothing more than
// the existing word data which is already in the JSON bundle.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import wordsData from '@/data/spelling/words.json';
import { levelLabel, type SpellingLevel } from '@/lib/spelling/engine';

// Loose type matching data/spelling/words.json. Mirrors the Word shape in
// lib/spelling/engine.ts but tolerant of optional fields like audioSpelling
// that the engine type doesn't model.
type RawWord = {
  word: string;
  level: number;
  patterns?: string[];
  syllables?: number;
  sentence?: string;
  audioSpelling?: string;
  homophones?: string[];
};

const ALL_WORDS = wordsData as unknown as RawWord[];

const LEVELS: SpellingLevel[] = [1, 2, 3, 4, 5, 6, 7];
const COUNT_OPTIONS = [10, 15, 20] as const;

// ---- Seeded shuffle ----
// Deterministic so the same date + level + count always produces the same
// list (good for "Week 1" / "Week 2" naming). Hash → mulberry32 PRNG → swap.

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPick<T>(arr: T[], n: number, seed: string): T[] {
  if (arr.length <= n) return [...arr];
  const rng = mulberry32(hashSeed(seed));
  // Fisher-Yates partial shuffle — pick n distinct items without copying the
  // full array twice.
  const indices = Array.from({ length: arr.length }, (_, i) => i);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rng() * (indices.length - i));
    const tmp = indices[i] as number;
    indices[i] = indices[j] as number;
    indices[j] = tmp;
  }
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = indices[i] as number;
    const item = arr[idx];
    if (item !== undefined) out.push(item);
  }
  return out;
}

// ---- Today helper ----

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function prettyDate(iso: string): string {
  // Parse YYYY-MM-DD as local — avoid the UTC drift you get from new Date(iso).
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---- Page ----

export default function WordListPage() {
  const [level, setLevel] = useState<SpellingLevel>(2);
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(15);
  const [weekDate, setWeekDate] = useState<string>(isoToday());
  const [studentName, setStudentName] = useState<string>('');

  const pool = useMemo(() => ALL_WORDS.filter((w) => w.level === level), [level]);

  const list = useMemo(() => {
    // Seed combines level + count + date so any change reshuffles, but
    // re-rendering with identical inputs keeps the same list.
    const seed = `${level}|${count}|${weekDate}`;
    return seededPick(pool, count, seed);
  }, [pool, count, weekDate, level]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Print styles — hide controls + nav, keep just the printable card. */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          .no-print {
            display: none !important;
          }
          .printable {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        {/* Top bar — hidden on print */}
        <div className="no-print flex items-center justify-between mb-6">
          <Link
            href="/spelling"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
          >
            ← Back to Spelling
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors"
          >
            <span aria-hidden="true">🖨️</span> Print this list
          </button>
        </div>

        {/* Controls — hidden on print */}
        <div className="no-print bg-white rounded-2xl border-2 border-amber-100 p-5 mb-6 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-black text-amber-900">
              Weekly Word List
            </h1>
            <p className="text-sm text-amber-700 mt-1">
              Build a printable word list for take-home practice.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
              Level
            </p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                    level === lvl
                      ? 'bg-amber-900 text-white border-amber-900'
                      : 'bg-white text-amber-900 border-amber-200 hover:border-amber-400'
                  }`}
                  title={levelLabel(lvl)}
                >
                  L{lvl}
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-700 mt-2">{levelLabel(level)}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                # of words
              </p>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`flex-1 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                      count === n
                        ? 'bg-amber-900 text-white border-amber-900'
                        : 'bg-white text-amber-900 border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="week-date"
                className="block text-xs font-bold uppercase tracking-wide text-amber-700 mb-2"
              >
                Week of
              </label>
              <input
                id="week-date"
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value || isoToday())}
                className="w-full rounded-xl border-2 border-amber-200 bg-white focus:outline-none focus:border-amber-500 px-3 py-1.5 text-sm text-amber-900"
              />
            </div>

            <div>
              <label
                htmlFor="student-name"
                className="block text-xs font-bold uppercase tracking-wide text-amber-700 mb-2"
              >
                Student (optional)
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Eliza"
                className="w-full rounded-xl border-2 border-amber-200 bg-white focus:outline-none focus:border-amber-500 px-3 py-1.5 text-sm text-amber-900 placeholder:text-amber-400"
              />
            </div>
          </div>

          {pool.length < count && (
            <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              Only {pool.length} words exist at this level — printing all of them.
            </p>
          )}
        </div>

        {/* Printable card */}
        <article className="printable bg-white rounded-2xl border-2 border-amber-200 shadow-md p-6 md:p-8">
          <header className="text-center border-b-2 border-amber-200 pb-3 mb-5">
            <h2 className="text-2xl font-black text-amber-900">
              Spelling Practice — Week of {prettyDate(weekDate)}
            </h2>
            <p className="text-sm text-amber-800 mt-1">
              {levelLabel(level)} · {list.length} words
              {studentName.trim() && <> · {studentName.trim()}</>}
            </p>
          </header>

          {/* Word list — two columns at print and md+ widths */}
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 list-none">
            {list.map((w, idx) => (
              <li key={`${w.word}-${idx}`} className="break-inside-avoid">
                <div className="flex items-baseline gap-2">
                  <span className="text-amber-700 font-bold w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-block w-4 h-4 border-2 border-amber-400 rounded shrink-0 mt-1"
                  />
                  <span className="font-bold text-amber-900 text-lg">
                    {w.word}
                  </span>
                </div>
                <div className="ml-8 mt-1 border-b border-dotted border-amber-300 h-6" />
                {w.sentence && (
                  <p className="ml-8 mt-1 text-xs text-amber-700 italic leading-snug">
                    {w.sentence}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {/* Footer with signature line — printed too */}
          <footer className="mt-8 pt-4 border-t-2 border-amber-200 grid grid-cols-2 gap-4 text-xs text-amber-800">
            <div>
              <div className="border-b border-amber-400 h-5 mb-1" />
              <p>Parent / coach signature</p>
            </div>
            <div>
              <div className="border-b border-amber-400 h-5 mb-1" />
              <p>Date completed</p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
