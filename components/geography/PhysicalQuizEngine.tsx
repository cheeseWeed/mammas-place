// PhysicalQuizEngine — multiple-choice quiz over every state's physicalFeatures.
//
// Two modes:
//   'state'   — Mode A: "Which state has [feature]?"
//               Options = 4 state names (1 owner + 3 random other states).
//   'feature' — Mode B: "Which is a [type] in [state]?"
//               Options = 4 feature names of the same type (1 from the
//               target state + 3 from OTHER states, same type).
//
// State machine per question (mirrors QuizEngine pattern):
//   ASK   — waiting for click; no highlight
//   RIGHT — green flash + brief explanation, ~1.5s, then advance
//   WRONG — red flash on clicked option + green on correct, ~1.5s, then advance
//
// Source of truth: data/states.json. Each state has `physicalFeatures: [...]`
// with name/type/description/fact (and optional latLon). The pool is built
// once per round from a flat list of {state, feature} pairs, optionally
// filtered to a single type bucket. Mode B needs a state that actually has
// the right type AND ≥4 other states that also have that type (else Mode B
// can't form decoys); we fall back gracefully when the pool is thin.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import statesData from '@/data/states.json';
import QuizPrompt from './QuizPrompt';

type PhysicalFeature = {
  name: string;
  type: string;
  description?: string;
  fact?: string;
  latLon?: [number, number];
};

type StateRecord = {
  postal: string;
  name: string;
  region?: string;
  physicalFeatures?: PhysicalFeature[];
};

export type PhysicalQuizMode = 'state' | 'feature';

// User-facing type-filter buckets. The data has ~17 distinct natural-feature
// types plus "landmark"; we collapse them into 5 friendly groups for the
// picker. 'all' lets the kid practice across every category.
export type PhysicalTypeBucket =
  | 'all'
  | 'rivers'
  | 'lakes'
  | 'mountains'
  | 'landmarks'
  | 'other';

export type PhysicalQuizEngineProps = {
  questionCount: number;
  mode: PhysicalQuizMode;
  typeBucket: PhysicalTypeBucket;
  onComplete: (result: {
    score: number;
    total: number;
    misses: string[]; // formatted "Feature (State)" strings for the results card
  }) => void;
};

// Map raw feature types (from states.json) into the friendly buckets.
// Anything not explicitly listed falls into 'other'.
const TYPE_TO_BUCKET: Record<string, PhysicalTypeBucket> = {
  river: 'rivers',
  lake: 'lakes',
  mountains: 'mountains',
  peak: 'mountains',
  volcano: 'mountains',
  landmark: 'landmarks',
};

function bucketOf(type: string): PhysicalTypeBucket {
  return TYPE_TO_BUCKET[type] ?? 'other';
}

// Singular noun for prompt text in Mode B ("Which is a famous river in Utah?").
// Keyed on the RAW feature.type, not the bucket — kid sees the precise word.
const TYPE_LABEL_SINGULAR: Record<string, string> = {
  river: 'river',
  lake: 'lake',
  mountains: 'mountain range',
  peak: 'mountain peak',
  volcano: 'volcano',
  landmark: 'landmark',
  bay: 'bay',
  coastline: 'coastline',
  canyon: 'canyon',
  desert: 'desert',
  forest: 'forest',
  glacier: 'glacier',
  island: 'island',
  swamp: 'swamp',
  valley: 'valley',
  wetland: 'wetland',
  plains: 'plains region',
};

function singularFor(type: string): string {
  return TYPE_LABEL_SINGULAR[type] ?? 'feature';
}

const ALL_STATES = (statesData as StateRecord[]).filter((s) => s.postal !== 'DC');

// Flattened (state, feature) pairs across the whole dataset. Built once at
// module load — the JSON import is static, so this is effectively a const.
// Each entry is a unique question source; if the same feature name appears in
// two states (e.g. a border river), each (state, feature) entry stands alone.
type FlatEntry = {
  state: StateRecord;
  feature: PhysicalFeature;
};

const ALL_FLAT: FlatEntry[] = ALL_STATES.flatMap((s) =>
  (s.physicalFeatures ?? []).map((f) => ({ state: s, feature: f })),
);

// Public so the picker page can show "X questions available" per bucket.
export function flatPoolSize(bucket: PhysicalTypeBucket): number {
  if (bucket === 'all') return ALL_FLAT.length;
  return ALL_FLAT.filter((e) => bucketOf(e.feature.type) === bucket).length;
}

// Total question pool across all buckets — handy for hub/debug.
export const TOTAL_FEATURE_COUNT = ALL_FLAT.length;

const RIGHT_DELAY_MS = 1500;
const WRONG_DELAY_MS = 1500;

type Phase = 'ask' | 'right' | 'wrong';

// Fisher-Yates over a copy. Pure — caller passes in the source.
function shuffle<T>(source: T[]): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom<T>(source: T[], n: number): T[] {
  return shuffle(source).slice(0, Math.min(n, source.length));
}

// One generated question. `options` is shuffled; `correctIndex` points at the
// right one. `meta` carries the state+feature for results-list formatting.
type Question = {
  promptText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  meta: { featureName: string; stateName: string };
};

// Build a Mode A question: "Which state has [feature]?".
function buildStateQuestion(entry: FlatEntry, pool: FlatEntry[]): Question {
  const correctName = entry.state.name;
  // Decoy state names: any state OTHER than the owner. Drawn from the full
  // 50-state pool (not the filtered feature pool) so decoys are real, varied,
  // and the kid sees plausible options regardless of type filter.
  const decoyPool = ALL_STATES
    .filter((s) => s.postal !== entry.state.postal)
    .map((s) => s.name);
  const decoys = pickRandom(decoyPool, 3);
  const options = shuffle([correctName, ...decoys]);
  const correctIndex = options.indexOf(correctName);
  // pool is unused for Mode A decoys but kept in the signature for symmetry.
  void pool;
  return {
    promptText: `Which state has ${entry.feature.name}?`,
    options,
    correctIndex,
    explanation: `${entry.feature.name} is in ${entry.state.name}.`,
    meta: { featureName: entry.feature.name, stateName: entry.state.name },
  };
}

// Build a Mode B question: "Which is a [type-singular] in [state]?".
// Caller guarantees `entry` is from a state with ≥1 feature of this type AND
// that the broader pool has enough same-type decoys elsewhere — if not we
// fall back to whatever decoys we can find (down to 1 option in the worst
// case, which the picker prevents from happening by gating Mode B on pool
// size).
function buildFeatureQuestion(entry: FlatEntry): Question {
  const correctName = entry.feature.name;
  const sameTypeOtherStates = ALL_FLAT.filter(
    (e) =>
      e.feature.type === entry.feature.type &&
      e.state.postal !== entry.state.postal &&
      // Dedupe by feature name so a border river doesn't show up as both
      // correct + decoy. Cheap O(n) check — pool is small.
      e.feature.name !== correctName,
  ).map((e) => e.feature.name);
  // Dedupe decoy names too — same name can appear in multiple states.
  const uniqueDecoys = Array.from(new Set(sameTypeOtherStates));
  const decoys = pickRandom(uniqueDecoys, 3);
  const options = shuffle([correctName, ...decoys]);
  const correctIndex = options.indexOf(correctName);
  return {
    promptText: `Which is a famous ${singularFor(entry.feature.type)} in ${entry.state.name}?`,
    options,
    correctIndex,
    explanation: `${correctName} is in ${entry.state.name}.`,
    meta: { featureName: correctName, stateName: entry.state.name },
  };
}

// Public so the picker can decide whether Mode B is viable for a bucket.
// Mode B needs ≥4 total entries of a usable type AND ≥2 distinct types so
// "all" rounds can pick varied prompts. For a single-type bucket, ≥4 entries
// is enough.
export function modeBViable(bucket: PhysicalTypeBucket): boolean {
  const candidates = ALL_FLAT.filter((e) =>
    bucket === 'all' ? true : bucketOf(e.feature.type) === bucket,
  );
  if (candidates.length < 4) return false;
  // For each entry, we need ≥3 decoys of the same RAW type elsewhere.
  // Count by raw type — if any type has ≥4 entries it's viable.
  const counts = new Map<string, number>();
  for (const e of candidates) {
    counts.set(e.feature.type, (counts.get(e.feature.type) ?? 0) + 1);
  }
  for (const c of counts.values()) {
    if (c >= 4) return true;
  }
  return false;
}

// Pick `count` question entries from the filtered pool. For Mode B we also
// require each entry's RAW type to have ≥4 entries total (so decoys exist).
function pickEntries(
  count: number,
  bucket: PhysicalTypeBucket,
  mode: PhysicalQuizMode,
): FlatEntry[] {
  const filtered = ALL_FLAT.filter((e) =>
    bucket === 'all' ? true : bucketOf(e.feature.type) === bucket,
  );

  if (mode === 'feature') {
    // Pre-compute viable raw types (≥4 entries across the dataset, not just
    // the filtered bucket — decoys can come from anywhere matching the type).
    const rawTypeCounts = new Map<string, number>();
    for (const e of ALL_FLAT) {
      rawTypeCounts.set(e.feature.type, (rawTypeCounts.get(e.feature.type) ?? 0) + 1);
    }
    const usable = filtered.filter((e) => (rawTypeCounts.get(e.feature.type) ?? 0) >= 4);
    return pickRandom(usable, count);
  }

  return pickRandom(filtered, count);
}

export default function PhysicalQuizEngine({
  questionCount,
  mode,
  typeBucket,
  onComplete,
}: PhysicalQuizEngineProps) {
  // Build the whole round up-front so re-renders don't reshuffle mid-round.
  const questions = useMemo(() => {
    const entries = pickEntries(questionCount, typeBucket, mode);
    return entries.map((entry) =>
      mode === 'state' ? buildStateQuestion(entry, ALL_FLAT) : buildFeatureQuestion(entry),
    );
  }, [questionCount, typeBucket, mode]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const missesRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup any pending advance on unmount — prevents setState-on-unmounted.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const current = questions[index];

  const advance = useCallback(() => {
    timerRef.current = null;
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      onComplete({
        score: scoreRef.current,
        total: questions.length,
        misses: missesRef.current.slice(),
      });
      return;
    }
    setIndex(nextIndex);
    setPhase('ask');
    setClickedIndex(null);
    setFeedbackText('');
  }, [index, questions.length, onComplete]);

  const handleOptionClick = useCallback(
    (optionIndex: number) => {
      // Ignore spam clicks during the feedback flash.
      if (phase !== 'ask' || !current) return;
      setClickedIndex(optionIndex);
      if (optionIndex === current.correctIndex) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        setFeedbackText(current.explanation);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        setPhase('wrong');
        setFeedbackText(current.explanation);
        // Record the miss formatted for the results card: "Feature (State)".
        const missLabel = `${current.meta.featureName} (${current.meta.stateName})`;
        if (!missesRef.current.includes(missLabel)) {
          missesRef.current.push(missLabel);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance],
  );

  if (!current) {
    // Empty queue (shouldn't happen — picker gates on pool size).
    return null;
  }

  return (
    <div className="h-full w-full flex flex-col">
      <QuizPrompt
        prompt={current.promptText}
        current={index + 1}
        total={questions.length}
        score={score}
        feedback={phase === 'ask' ? null : phase}
        feedbackText={phase === 'ask' ? undefined : current.explanation}
      />

      <div className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {current.options.map((opt, i) => {
            const isCorrect = i === current.correctIndex;
            const isClicked = i === clickedIndex;
            // Color logic: during ASK, neutral. After click, the clicked
            // option flashes green/red AND the correct one always flashes
            // green (so a wrong guess still shows the right answer).
            let stateClass =
              'bg-white hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-900';
            if (phase !== 'ask') {
              if (isCorrect) {
                stateClass = 'bg-emerald-100 border-emerald-500 text-emerald-900 ring-2 ring-emerald-400';
              } else if (isClicked) {
                stateClass = 'bg-red-100 border-red-500 text-red-900 ring-2 ring-red-400';
              } else {
                stateClass = 'bg-white border-emerald-100 text-emerald-700 opacity-60';
              }
            }
            return (
              <button
                key={`${opt}-${i}`}
                type="button"
                onClick={() => handleOptionClick(i)}
                disabled={phase !== 'ask'}
                className={`text-left rounded-2xl border-2 px-4 py-4 sm:py-5 text-base sm:text-lg font-bold shadow-sm transition-all ${stateClass} ${phase === 'ask' ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
