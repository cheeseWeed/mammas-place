// WorldPhysicalQuizEngine — multiple-choice quiz over every country's
// physicalFeatures + landmarks arrays. Parallel to PhysicalQuizEngine (US),
// but the pool is built from data/countries.json and there's a continent
// filter on top of the type-bucket filter.
//
// Two modes:
//   'country' — Mode A: "Which country has [feature]?"
//               Options = 4 country names (1 owner + 3 random other countries).
//   'feature' — Mode B: "Which is a [type] in [country]?"
//               Options = 4 feature names of the same type (1 from the
//               target country + 3 from OTHER countries, same type).
//
// State machine per question mirrors the US engine:
//   ASK   — waiting for click; no highlight
//   RIGHT — green flash + brief explanation, ~1.5s, then advance
//   WRONG — red flash on clicked option + green on correct, ~1.5s, then advance
//
// Source of truth: data/countries.json. Each country has `physicalFeatures`
// (typed) and `landmarks` (untyped — we tag them as type 'landmark' at load
// time so they live alongside physical features in one flat pool).
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import countriesData from '@/data/countries.json';
import QuizPrompt from './QuizPrompt';

type PhysicalFeature = {
  name: string;
  type: string;
  description?: string;
  fact?: string;
  latLon?: [number, number];
};

type Landmark = {
  name: string;
  description?: string;
  fact?: string;
  latLon?: [number, number];
};

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  continent: string;
  physicalFeatures?: PhysicalFeature[];
  landmarks?: Landmark[];
};

export type WorldPhysicalQuizMode = 'country' | 'feature';

// Continent filter — 'all' plus the six populated continents the rest of the
// world section uses. Antarctica isn't in the data so we don't surface it.
export type WorldContinent =
  | 'all'
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America';

// User-facing type buckets. The raw data has ~40 distinct natural-feature
// types plus 'landmark'; we collapse them into friendly groups for the picker.
export type WorldPhysicalTypeBucket =
  | 'all'
  | 'mountains'
  | 'rivers'
  | 'lakes'
  | 'deserts'
  | 'islands'
  | 'landmarks'
  | 'other';

export type WorldPhysicalQuizEngineProps = {
  questionCount: number;
  mode: WorldPhysicalQuizMode;
  continent: WorldContinent;
  typeBucket: WorldPhysicalTypeBucket;
  onComplete: (result: {
    score: number;
    total: number;
    misses: string[]; // formatted "Feature (Country)" strings for the results card
  }) => void;
};

// Map raw feature types into friendly buckets. The data has plurals
// (mountains/lakes/islands) and singulars (lake/island) — both map to the
// same bucket. Anything not explicitly listed falls into 'other'.
const TYPE_TO_BUCKET: Record<string, WorldPhysicalTypeBucket> = {
  // Mountains family
  mountains: 'mountains',
  peak: 'mountains',
  volcano: 'mountains',
  hills: 'mountains',
  hill: 'mountains',
  plateau: 'mountains',
  tepui: 'mountains',
  // Rivers family
  river: 'rivers',
  delta: 'rivers',
  waterfall: 'rivers',
  // Lakes family
  lake: 'lakes',
  lakes: 'lakes',
  lagoon: 'lakes',
  // Deserts family
  desert: 'deserts',
  'sand dunes': 'deserts',
  'salt flat': 'deserts',
  // Islands family
  island: 'islands',
  islands: 'islands',
  atoll: 'islands',
  atolls: 'islands',
  // Landmark (synthetic — assigned to every entry from the landmarks array)
  landmark: 'landmarks',
};

function bucketOf(type: string): WorldPhysicalTypeBucket {
  return TYPE_TO_BUCKET[type] ?? 'other';
}

// Singular noun for prompt text in Mode B ("Which is a famous river in
// Brazil?"). Keyed on RAW feature.type so the kid sees the precise word.
const TYPE_LABEL_SINGULAR: Record<string, string> = {
  river: 'river',
  lake: 'lake',
  lakes: 'lake',
  mountains: 'mountain range',
  peak: 'mountain peak',
  volcano: 'volcano',
  landmark: 'landmark',
  bay: 'bay',
  coast: 'coastline',
  coastline: 'coastline',
  canyon: 'canyon',
  desert: 'desert',
  forest: 'forest',
  rainforest: 'rainforest',
  'cloud forest': 'cloud forest',
  'mangrove forest': 'mangrove forest',
  glacier: 'glacier',
  island: 'island',
  islands: 'island group',
  atoll: 'atoll',
  atolls: 'atoll group',
  valley: 'valley',
  wetland: 'wetland',
  delta: 'river delta',
  waterfall: 'waterfall',
  reef: 'reef',
  sea: 'sea',
  fjord: 'fjord',
  hills: 'hills region',
  hill: 'hill',
  plateau: 'plateau',
  tepui: 'tepui',
  savanna: 'savanna',
  'salt flat': 'salt flat',
  'sand dunes': 'sand-dune region',
  'rock formation': 'rock formation',
  lagoon: 'lagoon',
  cave: 'cave',
  'sea cave': 'sea cave',
  sinkhole: 'sinkhole',
  beach: 'beach',
  trench: 'trench',
  geothermal: 'geothermal feature',
  'swimming hole': 'swimming hole',
  'archaeological site': 'archaeological site',
  'natural landmark': 'natural landmark',
  'natural feature': 'natural feature',
  'geological feature': 'geological feature',
  wilderness: 'wilderness',
  plain: 'plains region',
};

function singularFor(type: string): string {
  return TYPE_LABEL_SINGULAR[type] ?? 'feature';
}

// Cast via unknown — countries.json's inferred latLon type is `number[]`
// (tuple positions aren't preserved by the JSON importer), so the structural
// match against our `[number, number]` tuple needs a two-step cast.
const ALL_COUNTRIES = countriesData as unknown as CountryRecord[];

// Flattened (country, feature) pairs across the whole dataset. Built once at
// module load — the JSON import is static, so this is effectively a const.
// Landmarks are folded in with synthetic type 'landmark' so a single flat pool
// covers both arrays.
type FlatEntry = {
  country: CountryRecord;
  feature: { name: string; type: string; description?: string; fact?: string };
};

const ALL_FLAT: FlatEntry[] = ALL_COUNTRIES.flatMap((c) => {
  const fromPhysical: FlatEntry[] = (c.physicalFeatures ?? []).map((f) => ({
    country: c,
    feature: { name: f.name, type: f.type, description: f.description, fact: f.fact },
  }));
  const fromLandmarks: FlatEntry[] = (c.landmarks ?? []).map((l) => ({
    country: c,
    feature: { name: l.name, type: 'landmark', description: l.description, fact: l.fact },
  }));
  return [...fromPhysical, ...fromLandmarks];
});

// Filter a flat pool by continent. Continent='all' is a no-op.
function filterByContinent(pool: FlatEntry[], continent: WorldContinent): FlatEntry[] {
  if (continent === 'all') return pool;
  return pool.filter((e) => e.country.continent === continent);
}

// Public so the picker page can show "X questions available" per
// (continent, bucket) combination.
export function worldFlatPoolSize(
  continent: WorldContinent,
  bucket: WorldPhysicalTypeBucket,
): number {
  const byContinent = filterByContinent(ALL_FLAT, continent);
  if (bucket === 'all') return byContinent.length;
  return byContinent.filter((e) => bucketOf(e.feature.type) === bucket).length;
}

// Total question pool across all continents & buckets — for the hub/debug.
export const WORLD_TOTAL_FEATURE_COUNT = ALL_FLAT.length;

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
// right one. `meta` carries the country+feature for results-list formatting.
type Question = {
  promptText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  meta: { featureName: string; countryName: string };
};

// Build a Mode A question: "Which country has [feature]?".
// Decoy country names always come from the full 195-country pool (not the
// continent-filtered subset) — varied real-world decoys keep the quiz honest
// even when the kid picks "All continents". If they picked a single continent,
// decoys still draw from worldwide so the answer set looks like real geography.
function buildCountryQuestion(entry: FlatEntry): Question {
  const correctName = entry.country.name;
  const decoyPool = ALL_COUNTRIES.filter((c) => c.iso2 !== entry.country.iso2).map((c) => c.name);
  const decoys = pickRandom(decoyPool, 3);
  const options = shuffle([correctName, ...decoys]);
  const correctIndex = options.indexOf(correctName);
  return {
    promptText: `Which country has ${entry.feature.name}?`,
    options,
    correctIndex,
    explanation: `${entry.feature.name} is in ${entry.country.name}.`,
    meta: { featureName: entry.feature.name, countryName: entry.country.name },
  };
}

// Build a Mode B question: "Which is a [type-singular] in [country]?".
// Decoys are same-RAW-type features from OTHER countries; deduped by name so a
// shared border feature can't appear as both correct and decoy.
function buildFeatureQuestion(entry: FlatEntry): Question {
  const correctName = entry.feature.name;
  const sameTypeOtherCountries = ALL_FLAT.filter(
    (e) =>
      e.feature.type === entry.feature.type &&
      e.country.iso2 !== entry.country.iso2 &&
      e.feature.name !== correctName,
  ).map((e) => e.feature.name);
  const uniqueDecoys = Array.from(new Set(sameTypeOtherCountries));
  const decoys = pickRandom(uniqueDecoys, 3);
  const options = shuffle([correctName, ...decoys]);
  const correctIndex = options.indexOf(correctName);
  return {
    promptText: `Which is a famous ${singularFor(entry.feature.type)} in ${entry.country.name}?`,
    options,
    correctIndex,
    explanation: `${correctName} is in ${entry.country.name}.`,
    meta: { featureName: correctName, countryName: entry.country.name },
  };
}

// Public so the picker can decide whether Mode B is viable for a
// (continent, bucket) combination. Mode B needs ≥4 entries of a single raw
// type within the filtered candidate pool, AND the same raw type must have
// ≥4 entries dataset-wide (so decoys exist outside the candidate's country).
export function worldModeBViable(
  continent: WorldContinent,
  bucket: WorldPhysicalTypeBucket,
): boolean {
  const candidates = filterByContinent(ALL_FLAT, continent).filter((e) =>
    bucket === 'all' ? true : bucketOf(e.feature.type) === bucket,
  );
  if (candidates.length < 1) return false;

  // Raw-type counts across the FULL dataset (decoys can be from any continent
  // — the prompt names a specific country, so cross-continent decoys are fine).
  const rawTypeCounts = new Map<string, number>();
  for (const e of ALL_FLAT) {
    rawTypeCounts.set(e.feature.type, (rawTypeCounts.get(e.feature.type) ?? 0) + 1);
  }

  // For at least one candidate, the raw type must have ≥4 dataset entries (1
  // correct + 3 unique-name decoys). Cheap O(n) scan.
  for (const e of candidates) {
    if ((rawTypeCounts.get(e.feature.type) ?? 0) >= 4) return true;
  }
  return false;
}

// Pick `count` question entries from the (continent, bucket)-filtered pool.
// For Mode B we additionally require each entry's RAW type to have ≥4 entries
// dataset-wide so decoys exist.
function pickEntries(
  count: number,
  continent: WorldContinent,
  bucket: WorldPhysicalTypeBucket,
  mode: WorldPhysicalQuizMode,
): FlatEntry[] {
  const filtered = filterByContinent(ALL_FLAT, continent).filter((e) =>
    bucket === 'all' ? true : bucketOf(e.feature.type) === bucket,
  );

  if (mode === 'feature') {
    const rawTypeCounts = new Map<string, number>();
    for (const e of ALL_FLAT) {
      rawTypeCounts.set(e.feature.type, (rawTypeCounts.get(e.feature.type) ?? 0) + 1);
    }
    const usable = filtered.filter((e) => (rawTypeCounts.get(e.feature.type) ?? 0) >= 4);
    return pickRandom(usable, count);
  }

  return pickRandom(filtered, count);
}

export default function WorldPhysicalQuizEngine({
  questionCount,
  mode,
  continent,
  typeBucket,
  onComplete,
}: WorldPhysicalQuizEngineProps) {
  // Build the whole round up-front so re-renders don't reshuffle mid-round.
  const questions = useMemo(() => {
    const entries = pickEntries(questionCount, continent, typeBucket, mode);
    return entries.map((entry) =>
      mode === 'country' ? buildCountryQuestion(entry) : buildFeatureQuestion(entry),
    );
  }, [questionCount, continent, typeBucket, mode]);

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
        const missLabel = `${current.meta.featureName} (${current.meta.countryName})`;
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
            // Color logic mirrors the US engine but tinted sky/indigo to match
            // the world section's palette. During ASK, neutral. After click,
            // clicked option flashes green/red and the correct one always
            // flashes green so a wrong guess still surfaces the answer.
            let stateClass =
              'bg-white hover:bg-sky-50 border-sky-200 hover:border-sky-400 text-sky-900';
            if (phase !== 'ask') {
              if (isCorrect) {
                stateClass = 'bg-emerald-100 border-emerald-500 text-emerald-900 ring-2 ring-emerald-400';
              } else if (isClicked) {
                stateClass = 'bg-red-100 border-red-500 text-red-900 ring-2 ring-red-400';
              } else {
                stateClass = 'bg-white border-sky-100 text-sky-700 opacity-60';
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
