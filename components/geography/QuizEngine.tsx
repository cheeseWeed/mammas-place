// QuizEngine — orchestrates a quiz round in one of two modes.
//
// Modes:
//   'name'    — prompt is the state name; kid clicks the state on a blank map.
//               Capital stars hidden so the visual is just outlines.
//   'capital' — prompt is the capital city (with "capital of <State>" hint);
//               capital stars stay visible but capital NAMES are hidden, so
//               kid uses star position + state shape to find the right state.
//
// State machine (mode-agnostic):
//   ASK    — waiting for user to click; map shows no highlight
//   RIGHT  — flash green for 800ms, then advance
//   WRONG  — flash red on clicked state + green on correct state for 1500ms,
//            then advance
//
// Timers are tracked in a ref so unmount / re-renders cancel pending advances
// (no setState-on-unmounted, no stacked timers if a kid spam-clicks).
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import statesData from '@/data/states.json';
import USMap, { REGION_TINTS } from './USMap';
import QuizPrompt from './QuizPrompt';
import StateTooltip from './StateTooltip';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  region?: string;
};

export type QuizMode = 'name' | 'capital';

// Region pool — null means "all 50 states", otherwise filters to that region.
export type QuizRegion = null | 'Northeast' | 'Midwest' | 'South' | 'West';

export type QuizEngineProps = {
  questionCount: number;          // sized to the active pool (caller decides)
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
  mode?: QuizMode;                // defaults to 'name'
  region?: QuizRegion;            // defaults to null (all states)
  allowHoverNames?: boolean;      // default false — peeking is cheating
  // Scaffolding: when true, show the OPPOSITE labels as memory anchors.
  // - Name mode: show all capital names + stars on the map.
  // - Capital mode: show all state names on the map.
  // Default false — pure quiz, no anchors.
  showOppositeLabels?: boolean;
};

const ALL_STATES = (statesData as StateRecord[]).filter((s) => s.postal !== 'DC');
// Postal set used to hide ALL labels/capital names on the quiz map. Built from the
// underlying statesData (not the filtered STATES) so DC's label is hidden too —
// otherwise the kid would see "Washington" floating on the map while we're hiding
// every other capital name.
const ALL_POSTALS_SET = new Set((statesData as StateRecord[]).map((s) => s.postal));

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

export default function QuizEngine({
  questionCount,
  onComplete,
  mode = 'name',
  region = null,
  allowHoverNames = false,
  showOppositeLabels = false,
}: QuizEngineProps) {
  // Pool = all 50 states OR region-filtered subset. The queue is frozen for
  // the round so re-renders don't reshuffle mid-round.
  const queue = useMemo(() => {
    const pool = region ? ALL_STATES.filter((s) => s.region === region) : ALL_STATES;
    return pickRandom(pool, questionCount);
  }, [questionCount, region]);

  // Cursor tracking for the hover tooltip. Tooltip is ALWAYS on during a
  // quiz — it just shows different info based on allowHoverNames:
  //   off (default): the OPPOSITE piece (capital in name quiz; state in capital quiz)
  //   on ("peek"):   both name + capital
  // Both stages are delayed so a quick glance doesn't reveal the answer:
  // stage 1 at 1.5s = primary info, stage 2 at 3.0s = bonus (only in peek mode).
  const [hoveredPostal, setHoveredPostal] = useState<string | null>(null);
  const [tooltipStage, setTooltipStage] = useState<0 | 1 | 2>(0);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  useEffect(() => {
    setTooltipStage(0);
    if (!hoveredPostal) return;
    const t1 = setTimeout(() => setTooltipStage(1), 1500);
    const t2 = setTimeout(() => setTooltipStage(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hoveredPostal]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [highlightPostal, setHighlightPostal] = useState<string | null>(null);
  const [wrongPostal, setWrongPostal] = useState<string | null>(null);
  const missesRef = useRef<string[]>([]);
  // scoreRef mirrors score so advance() can read the live value without
  // capturing a stale closure. Without this, the last correct answer of a
  // round never reaches onComplete (setScore is async; advance fires immediately).
  const scoreRef = useRef(0);

  // Single pending advance timer. Cleared on unmount or before scheduling a new one.
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
    setHighlightPostal(null);
    setWrongPostal(null);
  }, [index, queue.length, onComplete]);

  const handleStateClick = useCallback(
    (clickedPostal: string) => {
      // Ignore clicks while a feedback flash is in flight. Without this, a
      // fast double-tap during the 1500ms wrong-flash could double-score or
      // skip a question.
      if (phase !== 'ask' || !current) return;

      // Clicks outside the active pool (e.g. a Midwest click during a West
      // round) are ignored — they're not the answer and not a "wrong" choice.
      const poolPostals = new Set(queue.map((q) => q.postal));
      if (!poolPostals.has(clickedPostal) && clickedPostal !== current.postal) {
        // Still allow wrong-pool clicks to register as wrong — feels less weird
        // for All-50 rounds. (poolPostals only matters as commentary here.)
      }

      if (clickedPostal === current.postal) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        setFeedbackText('Correct!');
        setHighlightPostal(current.postal);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        const clickedName =
          ALL_STATES.find((s) => s.postal === clickedPostal)?.name ?? clickedPostal;
        setPhase('wrong');
        // Capital mode wants "looking for <Capital>" because that's what we asked,
        // and tags the clicked wrong state by its NAME (the kid can see the shape,
        // not the capital, so naming the state is the useful correction).
        const lookingFor = mode === 'capital' ? current.capital : current.name;
        setFeedbackText(`That was ${clickedName} — looking for ${lookingFor}`);
        setHighlightPostal(current.postal);
        setWrongPostal(clickedPostal);
        // Track miss (by answer postal — what they SHOULD have clicked).
        // Dedupe in-round in case a state somehow ends up twice (it can't
        // currently, but cheap insurance).
        if (!missesRef.current.includes(current.postal)) {
          missesRef.current.push(current.postal);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance, queue, mode]
  );

  const hoveredStateRec = useMemo(() => {
    if (!hoveredPostal) return null;
    return (statesData as StateRecord[]).find((s) => s.postal === hoveredPostal) ?? null;
  }, [hoveredPostal]);

  // Memoized Sets so USMap's effect deps don't churn every render.
  const highlightedStates = useMemo(
    () => (highlightPostal ? new Set([highlightPostal]) : new Set<string>()),
    [highlightPostal]
  );
  const wrongStates = useMemo(
    () => (wrongPostal ? new Set([wrongPostal]) : new Set<string>()),
    [wrongPostal]
  );

  if (!current) {
    // Empty queue — shouldn't happen given the type guard on questionCount,
    // but render nothing rather than crash.
    return null;
  }

  // Prompt copy by mode. Capital mode shows just the capital city — adding
  // "capital of <State>" turns the test into "find the named state", which
  // defeats the point. Kid should know that Lincoln is in Nebraska.
  const promptText = mode === 'capital' ? current.capital : current.name;

  // Region tint: when a region is active, tint only that region's states so
  // the kid sees the "working area." Other states stay default gray. When
  // no region (all 50), no tint at all — too busy mid-quiz.
  const regionTints = useMemo(() => {
    if (!region) return undefined;
    const tint = REGION_TINTS[region];
    if (!tint) return undefined;
    const m = new Map<string, string>();
    ALL_STATES.forEach((s) => {
      if (s.region === region) m.set(s.postal, tint);
    });
    return m;
  }, [region]);

  // Layout: fills parent height (parent is expected to be a flex container
  // sized to the viewport). Top strip is the prompt; remainder is the map,
  // sized via aspect-ratio so the natural 959:593 SVG shape is preserved
  // while consuming all available vertical space.
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
        <USMap
          // Name mode: hide state names (that's the quiz). Capital mode: show
          // state names IF the kid asked for opposite-label scaffolding.
          hiddenStateLabels={
            mode === 'name'
              ? ALL_POSTALS_SET
              : (showOppositeLabels ? undefined : ALL_POSTALS_SET)
          }
          // Capital mode: hide capital names (that's the quiz). Name mode: show
          // capital names IF the kid asked for opposite-label scaffolding.
          hiddenCapitalNames={
            mode === 'capital'
              ? ALL_POSTALS_SET
              : (showOppositeLabels ? undefined : ALL_POSTALS_SET)
          }
          // Stars: always on in capital mode (signature visual). In name mode,
          // turn them on when showing capital labels — looks weird otherwise.
          showCapitalStars={mode === 'capital' || (mode === 'name' && showOppositeLabels)}
          showCapitalNames={mode === 'name' && showOppositeLabels}
          showStateLabels={mode === 'capital' && showOppositeLabels ? true : mode === 'name' ? false : false}
          onStateClick={handleStateClick}
          onStateHover={setHoveredPostal}
          highlightedStates={highlightedStates}
          wrongStates={wrongStates}
          regionTints={regionTints}
        />
      </div>
      {hoveredStateRec && tooltipStage >= 1 && (
        <StateTooltip
          name={hoveredStateRec.name}
          capital={hoveredStateRec.capital}
          x={cursor.x}
          y={cursor.y}
          // Stage 1: in peek mode show both; otherwise just the OPPOSITE piece.
          // Stage 2 (peek only): we already show both at stage 1, so the second
          // stage isn't used to add info here — peek mode shows everything at 1.5s.
          // In non-peek mode, stage 2 escalates to 'both' so persistent hover
          // eventually reveals the full pairing (still costs 3s, vs instant).
          mode={
            allowHoverNames || tooltipStage >= 2
              ? 'both'
              : mode === 'name' ? 'capital' : 'name'
          }
        />
      )}
    </div>
  );
}
