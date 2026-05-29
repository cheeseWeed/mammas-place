// WorldQuizEngine — country-on-map quiz, parallel to QuizEngine for the US.
//
// Modes:
//   'name'    — prompt is the country name; kid clicks the country on the
//               world map.
//   'capital' — prompt is the capital city; kid clicks the country.
//
// State machine (mode-agnostic):
//   ASK    — waiting for click; no highlight on map
//   RIGHT  — flash green for 800ms, then advance
//   WRONG  — flash red on clicked country + green on correct country for
//            1500ms, then advance
//
// Differences from the US QuizEngine:
//   - The world map fires ISO-3 codes (not US postals). Pool keys are ISO-3.
//   - There are no "regions" — we use continent filters instead.
//   - Continent tints come from the WorldMap module rather than REGION_TINTS.
//
// Timers tracked in a ref so unmount / re-renders cancel pending advances.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import countriesData from '@/data/countries.json';
import WorldMap, { CONTINENT_TINTS } from './WorldMap';
import QuizPrompt from './QuizPrompt';
import CountryTooltip from './CountryTooltip';

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string;
  continent: string;
  population?: number;
  areaSqKm?: number;
};

export type WorldQuizMode = 'name' | 'capital';

// 7-continent model (kid-friendly), null = all (excluding Antarctica which we
// filter out at pool build time — kids care about populated continents).
export type WorldQuizContinent =
  | null
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania';

export type WorldQuizEngineProps = {
  questionCount: number;            // sized to the active pool
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
  mode?: WorldQuizMode;             // defaults to 'name'
  continent?: WorldQuizContinent;   // defaults to null (all continents)
};

const ALL_COUNTRIES = (countriesData as CountryRecord[]).filter(
  (c) => c.continent !== 'Antarctica',
);

const RIGHT_DELAY_MS = 800;
const WRONG_DELAY_MS = 1500;

type Phase = 'ask' | 'right' | 'wrong';

// Fisher-Yates over a copy. Pure — caller passes in the source.
function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export default function WorldQuizEngine({
  questionCount,
  onComplete,
  mode = 'name',
  continent = null,
}: WorldQuizEngineProps) {
  // Pool = all countries OR continent-filtered subset. Frozen for the round.
  const queue = useMemo(() => {
    const pool = continent
      ? ALL_COUNTRIES.filter((c) => c.continent === continent)
      : ALL_COUNTRIES;
    return pickRandom(pool, questionCount);
  }, [questionCount, continent]);

  // Hover tooltip — always on, but in non-peek mode it shows only the
  // OPPOSITE field. Stage 1 reveal at 1.5s, stage 2 at 3.0s (escalates to
  // both name and capital).
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);
  const [tooltipStage, setTooltipStage] = useState<0 | 1 | 2>(0);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  useEffect(() => {
    setTooltipStage(0);
    if (!hoveredIso3) return;
    const t1 = setTimeout(() => setTooltipStage(1), 1500);
    const t2 = setTimeout(() => setTooltipStage(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hoveredIso3]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [highlightIso3, setHighlightIso3] = useState<string | null>(null);
  const [wrongIso3, setWrongIso3] = useState<string | null>(null);
  const missesRef = useRef<string[]>([]);
  const scoreRef = useRef(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const current = queue[index];

  const advance = useCallback(() => {
    timerRef.current = null;
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      onComplete({
        score: scoreRef.current,
        total: queue.length,
        misses: missesRef.current.slice(),
      });
      return;
    }
    setIndex(nextIndex);
    setPhase('ask');
    setFeedbackText('');
    setHighlightIso3(null);
    setWrongIso3(null);
  }, [index, queue.length, onComplete]);

  const handleCountryClick = useCallback(
    (clickedIso3: string) => {
      if (phase !== 'ask' || !current) return;

      if (clickedIso3 === current.iso3) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        setFeedbackText('Correct!');
        setHighlightIso3(current.iso3);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        const clickedName =
          ALL_COUNTRIES.find((c) => c.iso3 === clickedIso3)?.name ?? clickedIso3;
        setPhase('wrong');
        const lookingFor = mode === 'capital' ? current.capital : current.name;
        setFeedbackText(`That was ${clickedName} — looking for ${lookingFor}`);
        setHighlightIso3(current.iso3);
        setWrongIso3(clickedIso3);
        if (!missesRef.current.includes(current.iso3)) {
          missesRef.current.push(current.iso3);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance, mode],
  );

  const hoveredCountry = useMemo(() => {
    if (!hoveredIso3) return null;
    return ALL_COUNTRIES.find((c) => c.iso3 === hoveredIso3) ?? null;
  }, [hoveredIso3]);

  // Memoized Sets so WorldMap doesn't re-derive on every render.
  const highlightedCountries = useMemo(
    () => (highlightIso3 ? new Set([highlightIso3]) : new Set<string>()),
    [highlightIso3],
  );
  const wrongCountries = useMemo(
    () => (wrongIso3 ? new Set([wrongIso3]) : new Set<string>()),
    [wrongIso3],
  );

  // Continent tint: when a continent is active, tint only its countries.
  // When no continent (all), no tint — too busy mid-quiz.
  const continentTints = useMemo(() => {
    if (!continent) return undefined;
    const color = CONTINENT_TINTS[continent];
    if (!color) return undefined;
    const m = new Map<string, string>();
    ALL_COUNTRIES.forEach((c) => {
      if (c.continent === continent) m.set(c.iso3, color);
    });
    return m;
  }, [continent]);

  if (!current) return null;

  const promptText = mode === 'capital' ? current.capital : current.name;

  return (
    <div className="h-full w-full flex flex-col">
      <QuizPrompt
        prompt={promptText}
        current={index + 1}
        total={queue.length}
        score={score}
        feedback={phase === 'ask' ? null : phase}
        feedbackText={feedbackText}
      />

      <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1">
        <WorldMap
          continentTints={continentTints}
          highlightedCountries={highlightedCountries}
          wrongCountries={wrongCountries}
          onCountryClick={handleCountryClick}
          onCountryHover={setHoveredIso3}
          showCountryLabels={false}
        />
      </div>

      {hoveredCountry && tooltipStage >= 1 && (
        <CountryTooltip
          name={hoveredCountry.name}
          capital={hoveredCountry.capital}
          x={cursor.x}
          y={cursor.y}
          // In non-peek mode (default), reveal the OPPOSITE field first; at
          // stage 2 escalate to 'both' so persistent hover still unlocks the
          // full pairing (but costs 3s).
          mode={
            tooltipStage >= 2 ? 'both' : mode === 'name' ? 'capital' : 'name'
          }
        />
      )}
    </div>
  );
}
