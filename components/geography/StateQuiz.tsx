// StateQuiz — interactive per-state multiple-choice quiz.
//
// Three modes:
//   'picker'  — checkboxes per category, "Start Quiz (N questions)" button
//   'quiz'    — one MC question at a time, green/red flash, auto-advance
//   'results' — score + missed questions + replay options
//
// Question generation
// -------------------
// Wrong answers come from REAL data on other states. For "what's Utah's state
// bird?" we sample 3 other states' stateBird values, dedupe, shuffle in the
// correct answer, then shuffle again. Same idea for capital/nickname/motto/
// flower/tree/animal/region/largest city.
//
// "Year admitted" uses ±10/±25/±50 year decoys (real years are noisier than
// other states' admission years would be — too easy to recognize patterns).
//
// "physicalFeatures" / "parks" / "funFacts": each item in the target's array
// becomes ONE question of the form "which of these is X about <State>?",
// with 3 decoys pulled from OTHER states' arrays of the same kind. Capped at
// 5 to keep a fully-checked quiz from running ~30+ questions.
//
// "Major cities": optional. If states.json includes a `majorCities: string[]`,
// we ask "Is <X> a major city in <State>?" with 4 options (1 real, 3 cities
// pulled from other states). If the field is absent we silently skip — the
// "Largest city" category still covers cities.
//
// Null handling: stateAnimal and quarter are optional. DC/IN/IA/MN/RI lack a
// quarter; some states lack a stateAnimal. We just don't generate a question
// (the checkbox row also hides for these so the kid can't pick "0 questions").

'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// -------- Types (exported for the page wrapper) --------

export type PhysicalFeature = {
  name: string;
  type: string;
  description: string;
  fact?: string;
};

export type Park = {
  name: string;
  type: string;
  description: string;
  yearEstablished?: number;
};

export type Quarter = {
  year: number;
  design: string;
};

// `majorCities` is typed optional — a sibling agent added it. We accept TWO
// shapes for forward-compat: an array of strings (the spec's original
// suggestion) OR an array of `{name, population, isCapital}` objects (what
// shipped). At read time we normalize both into a plain string[] of city
// names. If `majorCities` is absent entirely, the "Major cities" category
// checkbox doesn't appear.
export type MajorCity = { name: string; population?: number; isCapital?: boolean };

export type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  region: string;
  admittedYear?: number;
  nickname?: string;
  motto?: string;
  stateBird?: string;
  stateFlower?: string;
  stateTree?: string;
  // states.json uses `null` for "no state animal" (DC and a couple others),
  // so this is `string | null | undefined` to cover both JSON shape and absence.
  stateAnimal?: string | null;
  quarter?: Quarter | null;
  population?: number;
  populationYear?: number;
  areaSqMi?: number;
  largestCity?: string;
  majorCities?: Array<MajorCity | string>;
  funFacts?: string[];
  physicalFeatures?: PhysicalFeature[];
  parks?: Park[];
};

// Normalize majorCities to a string[] of city names regardless of the
// JSON shape (objects vs raw strings). Returns an empty array if absent.
function majorCityNames(s: StateRecord): string[] {
  if (!Array.isArray(s.majorCities)) return [];
  return s.majorCities
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

// -------- Category registry --------

type CategoryId =
  | 'capital'
  | 'nickname'
  | 'motto'
  | 'bird'
  | 'flower'
  | 'tree'
  | 'animal'
  | 'admitted'
  | 'region'
  | 'largestCity'
  | 'majorCities'
  | 'funFacts'
  | 'physicalFeatures'
  | 'parks'
  | 'quarter';

type CategoryDef = {
  id: CategoryId;
  label: string;
  // How many questions this category contributes for the GIVEN target state.
  // Zero means "not applicable for this state" — the row is omitted entirely.
  count: number;
};

// Cap the per-list categories so all-checked stays manageable.
const MAX_PHYSICAL_QS = 5;
const MAX_PARK_QS = 5;
const MAX_FUNFACT_QS = 3;
const MAX_MAJORCITY_QS = 3;

// -------- Question shape --------

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  // Plain-text explanation shown on incorrect answer.
  explanation: string;
  // Category for grouping in results, if we want to later.
  category: CategoryId;
};

// -------- Pure helpers --------

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Pull up to `n` unique values from `pool` that aren't equal to any of `exclude`.
// String equality is case-sensitive — we never want to dedupe "Tennessee River"
// against "Tennessee river" since they shouldn't both appear in source data.
function pickDecoys(pool: string[], exclude: string[], n: number): string[] {
  const excludeSet = new Set(exclude.map((s) => s.trim()));
  const dedup: string[] = [];
  for (const v of shuffle(pool)) {
    const trimmed = v.trim();
    if (excludeSet.has(trimmed)) continue;
    if (dedup.includes(trimmed)) continue;
    dedup.push(trimmed);
    if (dedup.length >= n) break;
  }
  return dedup;
}

// Build the 4-option array from a correct answer + decoy pool, then shuffle.
// If the decoy pool is too thin (rare — only happens if every other state
// shares the same value), we backfill with "(none)" so we still have 4 options.
function buildOptions(correct: string, decoyPool: string[]): {
  options: string[];
  correctIndex: number;
} {
  const decoys = pickDecoys(decoyPool, [correct], 3);
  while (decoys.length < 3) decoys.push('(none)');
  const all = shuffle([correct, ...decoys]);
  return { options: all, correctIndex: all.indexOf(correct) };
}

// -------- Question generators --------

function generateQuestions(
  target: StateRecord,
  others: StateRecord[],
  enabled: Set<CategoryId>,
): Question[] {
  const out: Question[] = [];

  // Simple single-string field questions. Reads the field via a getter so we
  // can support both direct keys (e.g. capital) and computed fields without
  // tripping over the strict `keyof StateRecord` types (stateAnimal is
  // string|null in the JSON; the typed lookup would surface the null branch).
  const simpleField = (
    id: CategoryId,
    label: string,
    getter: (s: StateRecord) => string | null | undefined,
    prompt: string,
  ) => {
    if (!enabled.has(id)) return;
    const correct = getter(target);
    if (typeof correct !== 'string' || !correct) return;
    const pool = others
      .map(getter)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const { options, correctIndex } = buildOptions(correct, pool);
    out.push({
      id: `${id}-${target.postal}`,
      prompt,
      options,
      correctIndex,
      explanation: `${target.name}'s ${label} is ${correct}.`,
      category: id,
    });
  };

  simpleField('capital', 'capital', (s) => s.capital, `What's the capital of ${target.name}?`);
  simpleField('nickname', 'nickname', (s) => s.nickname, `What's ${target.name}'s nickname?`);
  simpleField('motto', 'motto', (s) => s.motto, `What's ${target.name}'s state motto?`);
  simpleField('bird', 'state bird', (s) => s.stateBird, `What's ${target.name}'s state bird?`);
  simpleField('flower', 'state flower', (s) => s.stateFlower, `What's ${target.name}'s state flower?`);
  simpleField('tree', 'state tree', (s) => s.stateTree, `What's ${target.name}'s state tree?`);
  simpleField('animal', 'state animal', (s) => s.stateAnimal, `What's ${target.name}'s state animal?`);
  simpleField('region', 'region', (s) => s.region, `What region is ${target.name} in?`);
  simpleField('largestCity', 'largest city', (s) => s.largestCity, `What's the largest city in ${target.name}?`);

  // Year admitted: ±10/±25/±50 decoys around the real year — easier to fool
  // than just sampling other states' years (which clusters around 1788 or 1912).
  if (enabled.has('admitted') && typeof target.admittedYear === 'number') {
    const year = target.admittedYear;
    const offsets = [-50, -25, -10, 10, 25, 50];
    const candidateDecoys = shuffle(offsets).map((o) => String(year + o));
    const { options, correctIndex } = buildOptions(String(year), candidateDecoys);
    out.push({
      id: `admitted-${target.postal}`,
      prompt: `When was ${target.name} admitted to the union?`,
      options,
      correctIndex,
      explanation: `${target.name} was admitted in ${year}.`,
      category: 'admitted',
    });
  }

  // Quarter year: simple string field with year decoys from other states'
  // quarter years (skipping nulls and DC). Falls back gracefully if none.
  if (enabled.has('quarter') && target.quarter && typeof target.quarter.year === 'number') {
    const year = target.quarter.year;
    const pool = others
      .map((s) => (s.quarter ? String(s.quarter.year) : undefined))
      .filter((v): v is string => typeof v === 'string');
    const { options, correctIndex } = buildOptions(String(year), pool);
    out.push({
      id: `quarter-${target.postal}`,
      prompt: `What year was ${target.name}'s state quarter released?`,
      options,
      correctIndex,
      explanation: `${target.name}'s quarter was released in ${year}.`,
      category: 'quarter',
    });
  }

  // Major cities (sibling-agent field). Each city becomes one yes-style
  // multiple-choice question — kid picks the real major city from 3 decoys
  // sampled from OTHER states' majorCities arrays (so all 4 options are
  // plausible real cities, just only 1 is in this state). We normalize
  // through majorCityNames() so it works whether the JSON uses strings or
  // {name, population, isCapital} objects.
  if (enabled.has('majorCities')) {
    const targetCities = majorCityNames(target);
    if (targetCities.length > 0) {
      const cities = targetCities.slice(0, MAX_MAJORCITY_QS);
      const decoyPool = others.flatMap((s) => majorCityNames(s));
      const targetSet = new Set(targetCities);
      for (const city of cities) {
        const { options, correctIndex } = buildOptions(
          city,
          decoyPool.filter((c) => !targetSet.has(c)),
        );
        out.push({
          id: `majorCity-${target.postal}-${city}`,
          prompt: `Which of these is a major city in ${target.name}?`,
          options,
          correctIndex,
          explanation: `${city} is a major city in ${target.name}.`,
          category: 'majorCities',
        });
      }
    }
  }

  // Fun facts: each fact is the right answer; decoys = other states' fun facts.
  // Capped at 3 so an all-checked quiz doesn't get fact-heavy.
  if (enabled.has('funFacts') && Array.isArray(target.funFacts) && target.funFacts.length > 0) {
    const facts = shuffle(target.funFacts).slice(0, MAX_FUNFACT_QS);
    const decoyPool = others.flatMap((s) => s.funFacts ?? []);
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const { options, correctIndex } = buildOptions(fact, decoyPool);
      out.push({
        id: `funFact-${target.postal}-${i}`,
        prompt: `Which of these is true about ${target.name}?`,
        options,
        correctIndex,
        explanation: `True about ${target.name}: ${fact}`,
        category: 'funFacts',
      });
    }
  }

  // Physical features: each feature is the right answer; decoys = other states'
  // physical features by name. We display just the NAME in options (the
  // descriptions get long).
  if (enabled.has('physicalFeatures') && Array.isArray(target.physicalFeatures) && target.physicalFeatures.length > 0) {
    const features = shuffle(target.physicalFeatures).slice(0, MAX_PHYSICAL_QS);
    const decoyPool = others.flatMap((s) =>
      Array.isArray(s.physicalFeatures) ? s.physicalFeatures.map((f) => f.name) : [],
    );
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const { options, correctIndex } = buildOptions(feature.name, decoyPool);
      out.push({
        id: `phys-${target.postal}-${i}`,
        prompt: `Which of these natural features is in ${target.name}?`,
        options,
        correctIndex,
        explanation: `${feature.name} is in ${target.name}. ${feature.description}`,
        category: 'physicalFeatures',
      });
    }
  }

  // Parks: same pattern as physical features.
  if (enabled.has('parks') && Array.isArray(target.parks) && target.parks.length > 0) {
    const parks = shuffle(target.parks).slice(0, MAX_PARK_QS);
    const decoyPool = others.flatMap((s) =>
      Array.isArray(s.parks) ? s.parks.map((p) => p.name) : [],
    );
    for (let i = 0; i < parks.length; i++) {
      const park = parks[i];
      const { options, correctIndex } = buildOptions(park.name, decoyPool);
      out.push({
        id: `park-${target.postal}-${i}`,
        prompt: `Which of these parks or protected places is in ${target.name}?`,
        options,
        correctIndex,
        explanation: `${park.name} is in ${target.name}. ${park.description}`,
        category: 'parks',
      });
    }
  }

  return shuffle(out);
}

// Count what a fully-checked quiz would produce, used to drive the picker
// row labels ("adds 1", "adds up to 3"). We compute against the target's own
// data so a state with no quarter shows 0 for that row and we hide the row.
function countForCategory(id: CategoryId, target: StateRecord): number {
  switch (id) {
    case 'capital': return target.capital ? 1 : 0;
    case 'nickname': return target.nickname ? 1 : 0;
    case 'motto': return target.motto ? 1 : 0;
    case 'bird': return target.stateBird ? 1 : 0;
    case 'flower': return target.stateFlower ? 1 : 0;
    case 'tree': return target.stateTree ? 1 : 0;
    case 'animal': return target.stateAnimal ? 1 : 0;
    case 'admitted': return typeof target.admittedYear === 'number' ? 1 : 0;
    case 'region': return target.region ? 1 : 0;
    case 'largestCity': return target.largestCity ? 1 : 0;
    case 'majorCities':
      return Math.min(majorCityNames(target).length, MAX_MAJORCITY_QS);
    case 'funFacts':
      return Array.isArray(target.funFacts)
        ? Math.min(target.funFacts.length, MAX_FUNFACT_QS)
        : 0;
    case 'physicalFeatures':
      return Array.isArray(target.physicalFeatures)
        ? Math.min(target.physicalFeatures.length, MAX_PHYSICAL_QS)
        : 0;
    case 'parks':
      return Array.isArray(target.parks)
        ? Math.min(target.parks.length, MAX_PARK_QS)
        : 0;
    case 'quarter': return target.quarter ? 1 : 0;
  }
}

const CATEGORY_LABELS: Record<CategoryId, string> = {
  capital: 'Capital city',
  nickname: 'Nickname',
  motto: 'State motto',
  bird: 'State bird',
  flower: 'State flower',
  tree: 'State tree',
  animal: 'State animal',
  admitted: 'Year admitted',
  region: 'Region',
  largestCity: 'Largest city',
  majorCities: 'Major cities',
  funFacts: 'Fun facts',
  physicalFeatures: 'Physical features',
  parks: 'Parks & protected places',
  quarter: 'State quarter',
};

// Display order in the picker (groups symbols together, then geography, then arrays).
const CATEGORY_ORDER: CategoryId[] = [
  'capital',
  'largestCity',
  'majorCities',
  'region',
  'admitted',
  'nickname',
  'motto',
  'bird',
  'flower',
  'tree',
  'animal',
  'quarter',
  'physicalFeatures',
  'parks',
  'funFacts',
];

// -------- Timing --------

const FEEDBACK_DELAY_MS = 1500; // both right and wrong — kid sees the result

// -------- Component --------

type Mode = 'picker' | 'quiz' | 'results';

type Props = {
  state: StateRecord;
  allStates: StateRecord[];
};

export default function StateQuiz({ state, allStates }: Props) {
  const others = useMemo(
    () => allStates.filter((s) => s.postal !== state.postal),
    [allStates, state.postal],
  );

  // Build the per-state category list once. Categories with count 0 (e.g.
  // state animal for a state missing one, quarter for DC) are filtered out
  // entirely so we don't show a checkbox the kid can't actually use.
  const categories: CategoryDef[] = useMemo(() => {
    return CATEGORY_ORDER
      .map((id) => ({ id, label: CATEGORY_LABELS[id], count: countForCategory(id, state) }))
      .filter((c) => c.count > 0);
  }, [state]);

  const [mode, setMode] = useState<Mode>('picker');
  const [enabled, setEnabled] = useState<Set<CategoryId>>(() => {
    // Default: all available categories checked.
    return new Set(categories.map((c) => c.id));
  });

  const totalQuestions = useMemo(
    () => categories.filter((c) => enabled.has(c.id)).reduce((sum, c) => sum + c.count, 0),
    [categories, enabled],
  );

  // Question queue + cursor — only relevant in 'quiz' and 'results' modes.
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState<Array<{ q: Question; pickedIndex: number }>>([]);
  const [feedback, setFeedback] = useState<null | { kind: 'right' | 'wrong'; pickedIndex: number }>(null);

  // Single advance timer; cleared on unmount or before scheduling another.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const toggleCategory = useCallback((id: CategoryId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setEnabled(new Set(categories.map((c) => c.id)));
  }, [categories]);

  const clearAll = useCallback(() => {
    setEnabled(new Set());
  }, []);

  const startQuiz = useCallback(() => {
    const qs = generateQuestions(state, others, enabled);
    if (qs.length === 0) return;
    setQueue(qs);
    setIndex(0);
    setScore(0);
    setMisses([]);
    setFeedback(null);
    setMode('quiz');
  }, [state, others, enabled]);

  const playAgainSame = useCallback(() => {
    // Re-generate so options re-shuffle and item subsets re-pick (the capped
    // categories pull a new random subset each run — keeps replays fresh).
    startQuiz();
  }, [startQuiz]);

  const backToPicker = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setFeedback(null);
    setMode('picker');
  }, []);

  const handleAnswer = useCallback(
    (pickedIndex: number) => {
      if (feedback !== null) return; // ignore during 1.5s flash
      const current = queue[index];
      if (!current) return;
      const isRight = pickedIndex === current.correctIndex;
      setFeedback({ kind: isRight ? 'right' : 'wrong', pickedIndex });
      if (isRight) {
        setScore((s) => s + 1);
      } else {
        setMisses((m) => [...m, { q: current, pickedIndex }]);
      }
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setFeedback(null);
        if (index + 1 >= queue.length) {
          setMode('results');
        } else {
          setIndex((i) => i + 1);
        }
      }, FEEDBACK_DELAY_MS);
    },
    [feedback, queue, index],
  );

  // ---------------- Picker ----------------
  if (mode === 'picker') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Link
            href={`/geography/state/${state.postal.toLowerCase()}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-500 transition-colors mb-4"
          >
            ← Back to {state.name}
          </Link>

          <header className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md p-6 sm:p-8 mb-6">
            <h1 className="text-3xl sm:text-4xl font-black mb-1">Quiz: {state.name}</h1>
            <p className="text-emerald-50 text-base sm:text-lg">
              Pick what to quiz on, then start.
            </p>
          </header>

          <section className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg sm:text-xl font-black text-emerald-900">
                Categories
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-500 px-2 py-1 rounded"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-400 px-2 py-1 rounded"
                >
                  Clear all
                </button>
              </div>
            </div>

            <ul className="space-y-1">
              {categories.map((c) => {
                const checked = enabled.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-emerald-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(c.id)}
                        className="h-5 w-5 accent-emerald-600 cursor-pointer"
                      />
                      <span className="flex-1 text-base sm:text-lg font-semibold text-gray-800">
                        {c.label}
                      </span>
                      <span className="text-xs sm:text-sm text-emerald-700 font-bold tabular-nums">
                        +{c.count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <button
            type="button"
            onClick={startQuiz}
            disabled={totalQuestions === 0}
            className="w-full bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-black text-xl sm:text-2xl py-5 rounded-2xl shadow-md transition-all"
          >
            {totalQuestions === 0
              ? 'Pick at least one category'
              : `Start Quiz (${totalQuestions} question${totalQuestions === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>
    );
  }

  // ---------------- In-Quiz ----------------
  if (mode === 'quiz') {
    const current = queue[index];
    if (!current) {
      // Shouldn't happen — startQuiz guards an empty queue, and the advance
      // timer transitions to 'results' before we'd index past the end.
      return null;
    }
    const pct = ((index + (feedback ? 1 : 0)) / queue.length) * 100;
    const letterFor = (i: number) => 'ABCD'[i];

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-6 sm:py-10 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 mb-3 text-sm sm:text-base">
            <button
              type="button"
              onClick={backToPicker}
              className="font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
            >
              ← Back to picker
            </button>
            <div className="font-bold text-gray-700 tabular-nums">
              Question {index + 1} of {queue.length} · Score: {score}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 sm:p-7 mb-5">
            <h2 className="text-xl sm:text-2xl font-black text-emerald-900 leading-snug">
              {current.prompt}
            </h2>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {current.options.map((opt, i) => {
              const isCorrect = i === current.correctIndex;
              const isPicked = feedback?.pickedIndex === i;
              // Visual logic during feedback:
              //   - picked correct: green
              //   - picked wrong: red, AND highlight the actual correct option green
              //   - other options: dimmed
              let stateClass =
                'bg-white border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-800';
              if (feedback) {
                if (isPicked && feedback.kind === 'right') {
                  stateClass = 'bg-emerald-500 border-emerald-600 text-white';
                } else if (isPicked && feedback.kind === 'wrong') {
                  stateClass = 'bg-red-500 border-red-600 text-white';
                } else if (isCorrect) {
                  stateClass = 'bg-emerald-500 border-emerald-600 text-white';
                } else {
                  stateClass = 'bg-white border-gray-200 text-gray-400';
                }
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(i)}
                  disabled={feedback !== null}
                  className={`text-left p-4 rounded-2xl border-2 font-semibold text-base sm:text-lg shadow-sm transition-all ${stateClass}`}
                >
                  <span className="inline-block w-7 h-7 rounded-full bg-black/10 text-center leading-7 font-black mr-3 text-sm">
                    {letterFor(i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Feedback text under the options */}
          {feedback && (
            <div
              className={`mt-5 p-4 rounded-2xl text-base sm:text-lg font-semibold ${
                feedback.kind === 'right'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-red-100 text-red-900'
              }`}
            >
              {feedback.kind === 'right' ? 'Correct! ' : 'Not quite. '}
              {current.explanation}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- Results ----------------
  // mode === 'results'
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md p-6 sm:p-8 mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-black mb-2">All done!</h1>
          <p className="text-2xl sm:text-3xl font-black">
            You got {score} of {queue.length}!
          </p>
        </header>

        {misses.length > 0 && (
          <section className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-black text-emerald-900 mb-3">
              Worth another look ({misses.length})
            </h2>
            <ul className="space-y-3">
              {misses.map(({ q }, idx) => (
                <li key={idx} className="border-l-4 border-emerald-400 pl-3">
                  <p className="font-semibold text-gray-800">{q.prompt}</p>
                  <p className="text-sm text-emerald-700 font-medium">
                    Correct: {q.options[q.correctIndex]}
                  </p>
                  <p className="text-sm text-gray-600 italic mt-1">{q.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={playAgainSame}
            className="bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-md transition-all"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={backToPicker}
            className="bg-white border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-black text-base sm:text-lg py-4 rounded-2xl shadow-sm transition-all"
          >
            Pick Different Categories
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link
            href={`/geography/state/${state.postal.toLowerCase()}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-500"
          >
            ← Back to {state.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
