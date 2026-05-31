'use client';

// Chess Puzzles drill — /chess/puzzles
//
// A new game mode under the chess section. The kid picks a difficulty filter
// (easy / medium / hard / mixed), a theme filter (any / mate-in-1 / mate-in-2
// / mate-in-3 / endgame), and a round size (5 / 10 / 15). The drill picks
// puzzles from the bank, runs them one at a time on the existing Board
// component, and tracks how many the kid solves.
//
// State machine:
//   config  → kid sets filters + size, clicks Start
//   playing → kid solves puzzles one at a time
//   results → "X/N solved" summary + Play again / Back to hub
//
// For each puzzle:
//   - Render Board at the puzzle's starting FEN
//   - Show puzzle.description as a hint at the top
//   - Accept the kid's move via the board's click handler
//   - Compare kid's move (in UCI) to movesToSolve[0]
//       match → if there are more plies, the AI plays movesToSolve[1] after
//               a short delay, then kid tries movesToSolve[2], etc.
//       miss  → show a "Not quite" message, highlight the expected move,
//               offer "Try again" (reset puzzle) and "Skip" (count as miss)
//   - When the kid completes all kid-plies, mark puzzle solved and advance.
//
// MP earn (v2): each puzzle posts to /api/money/earn after the kid solves
// (or gives up). Server-decided cents via computePuzzleReward(). The earn
// fires from DrillView when each puzzle resolves; results are accumulated
// on the per-puzzle state and shown on ResultsCard. Anonymous kids get a
// PendingEarnPrompt per pending earn — pick one to claim and the rest are
// lost (same trade-off as Math/LA: claim before closing the tab).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import Board from '@/components/chess/Board';
import {
  CHESS_PUZZLES,
  type ChessPuzzle,
  type PuzzleDifficulty,
  type PuzzleTheme,
  uciToMove,
  moveToUci,
} from '@/lib/chess/puzzles';
import { parseFEN } from '@/lib/chess/fen';
import {
  legalMoves,
  makeMove,
  isCheck,
  type Position,
  type Move,
  type Square as EngineSquare,
} from '@/lib/chess/engine';
import {
  DEFAULT_THEME_ID,
  getTheme,
  type ChessThemeId,
} from '@/data/chess-themes';
import ThemePicker from '@/components/chess/ThemePicker';
import {
  isPending,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';
import { useLearner } from '@/context/LearnerContext';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

// =========================================================================
// Top-level page (auth wrapper)
// =========================================================================

export default function ChessPuzzlesPage() {
  return (
    <LoginGate
      section="chess"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-purple-700">Loading…</div>
        </div>
      }
    >
      <ChessPuzzlesInner />
    </LoginGate>
  );
}

// =========================================================================
// Top-level view router
// =========================================================================

type DifficultyFilter = PuzzleDifficulty | 'mixed';
type ThemeFilter = PuzzleTheme | 'any';

type DrillConfig = {
  difficulty: DifficultyFilter;
  theme: ThemeFilter;
  roundSize: number; // 5, 10, 15
  themeId: ChessThemeId;
};

// Per-puzzle outcome captured at solve/give-up time. earn is null while the
// submit is in-flight or if the network call failed; the ResultsCard treats
// nulls as "no MP recorded" without blocking the round summary.
export type PuzzleOutcome = {
  puzzleId: string;
  theme: PuzzleTheme;
  result: 'solved' | 'gave-up';
  movesTaken: number;
  earn: EarnResponse | null;
};

type DrillResult = {
  solvedIds: string[];
  failedIds: string[];
  total: number;
  outcomes: PuzzleOutcome[];
};

type View =
  | { kind: 'config' }
  | { kind: 'playing'; config: DrillConfig; puzzles: ChessPuzzle[] }
  | { kind: 'results'; config: DrillConfig; result: DrillResult };

function ChessPuzzlesInner() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const handleStart = useCallback((config: DrillConfig) => {
    const puzzles = pickPuzzles(config);
    if (puzzles.length === 0) {
      // No puzzles match — fall back to all puzzles (shouldn't happen for v1
      // given the bank size and filters, but safe to handle).
      return;
    }
    setView({ kind: 'playing', config, puzzles });
  }, []);

  const handleFinish = useCallback(
    (result: DrillResult) => {
      if (view.kind !== 'playing') return;
      setView({ kind: 'results', config: view.config, result });
    },
    [view],
  );

  const handlePlayAgain = useCallback(() => {
    setView({ kind: 'config' });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-yellow-50 to-white py-8 px-3 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-4">
          <Link
            href="/chess"
            className="text-purple-700 hover:text-purple-900 text-sm font-semibold"
          >
            ← Chess hub
          </Link>
        </div>

        {view.kind === 'config' && <ConfigCard onStart={handleStart} />}
        {view.kind === 'playing' && (
          <DrillView
            config={view.config}
            puzzles={view.puzzles}
            onFinish={handleFinish}
            onBail={handlePlayAgain}
          />
        )}
        {view.kind === 'results' && (
          <ResultsCard
            config={view.config}
            result={view.result}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Puzzle selection
// =========================================================================

function pickPuzzles(config: DrillConfig): ChessPuzzle[] {
  // Filter pool.
  const pool = CHESS_PUZZLES.filter((p) => {
    if (config.difficulty !== 'mixed' && p.difficulty !== config.difficulty) return false;
    if (config.theme !== 'any' && p.theme !== config.theme) return false;
    return true;
  });
  if (pool.length === 0) return [];
  // Shuffle (Fisher-Yates) and take roundSize. If pool is smaller than
  // requested, just play all of them.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(config.roundSize, shuffled.length));
}

// =========================================================================
// CONFIG card
// =========================================================================

const DIFFICULTY_OPTIONS: { key: DifficultyFilter; label: string; emoji: string }[] = [
  { key: 'mixed', label: 'Mixed', emoji: '🎲' },
  { key: 'easy', label: 'Easy', emoji: '🌱' },
  { key: 'medium', label: 'Medium', emoji: '🌿' },
  { key: 'hard', label: 'Hard', emoji: '🌳' },
];

const THEME_OPTIONS: { key: ThemeFilter; label: string; emoji: string }[] = [
  { key: 'any', label: 'All themes', emoji: '🧩' },
  { key: 'mate-in-1', label: 'Mate in 1', emoji: '♟️' },
  { key: 'mate-in-2', label: 'Mate in 2', emoji: '♟♟️' },
  { key: 'mate-in-3', label: 'Mate in 3', emoji: '♚' },
  { key: 'endgame', label: 'Endgames', emoji: '👑' },
];

const ROUND_SIZES = [5, 10, 15] as const;

function ConfigCard({ onStart }: { onStart: (config: DrillConfig) => void }) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('mixed');
  const [theme, setTheme] = useState<ThemeFilter>('any');
  const [roundSize, setRoundSize] = useState<number>(5);
  const [themeId, setThemeId] = useState<ChessThemeId>(DEFAULT_THEME_ID);

  // How many puzzles match the current filter? Show this so the kid knows
  // if the round will be shorter than requested.
  const matchCount = useMemo(() => {
    return CHESS_PUZZLES.filter((p) => {
      if (difficulty !== 'mixed' && p.difficulty !== difficulty) return false;
      if (theme !== 'any' && p.theme !== theme) return false;
      return true;
    }).length;
  }, [difficulty, theme]);

  const start = () => onStart({ difficulty, theme, roundSize, themeId });

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-200 p-6 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🧩</div>
        <h1 className="text-2xl md:text-3xl font-black text-purple-900">
          Chess Puzzles
        </h1>
        <p className="text-sm text-purple-700 mt-1">
          Mate in 1, 2, 3. Endgames. Brain food.
        </p>
      </div>

      {/* Difficulty */}
      <fieldset className="mb-5">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Difficulty
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => {
            const on = difficulty === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDifficulty(opt.key)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                <div className="text-2xl">{opt.emoji}</div>
                <div>{opt.label}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Theme */}
      <fieldset className="mb-5">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Puzzle type
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const on = theme === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTheme(opt.key)}
                className={`rounded-xl border-2 px-3 py-2 font-bold text-xs transition-all ${
                  on
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                <div className="text-lg">{opt.emoji}</div>
                <div className="leading-tight">{opt.label}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Round size */}
      <fieldset className="mb-5">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Round size
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {ROUND_SIZES.map((n) => {
            const on = roundSize === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRoundSize(n)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-base transition-all ${
                  on
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                {n} puzzles
              </button>
            );
          })}
        </div>
        <div className="text-xs text-purple-700 mt-2">
          {matchCount} puzzle{matchCount === 1 ? '' : 's'} match your filters
          {matchCount < roundSize && matchCount > 0 ? (
            <span className="text-yellow-700"> — round will be {matchCount}.</span>
          ) : null}
        </div>
      </fieldset>

      {/* Piece set */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Piece set
        </legend>
        <ThemePicker selectedId={themeId} onSelect={setThemeId} />
      </fieldset>

      <button
        type="button"
        onClick={start}
        disabled={matchCount === 0}
        className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-800 hover:to-purple-900 disabled:from-gray-300 disabled:to-gray-400 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start solving →
      </button>
      <div className="text-center text-[11px] text-purple-600 mt-3">
        Earn MP for each puzzle: 0.50–1.50MP per solve + 0.25MP bonus when you
        get it in the fewest moves.
      </div>
    </div>
  );
}

// =========================================================================
// DRILL view — solve one puzzle at a time
// =========================================================================

// Per-puzzle solve state.
type SolveState = {
  position: Position;             // current engine position (updates as kid plays)
  pliesSolved: number;            // how many of the puzzle's plies are done
  selectedSquare: EngineSquare | null;
  lastMove: { from: EngineSquare; to: EngineSquare } | null;
  // Feedback for the most recent attempt.
  feedback:
    | { kind: 'idle' }
    | { kind: 'wrong'; expected: { from: EngineSquare; to: EngineSquare } }
    | { kind: 'solved' };
};

function freshSolveState(puzzle: ChessPuzzle): SolveState {
  const position = parseFEN(puzzle.fen);
  return {
    position,
    pliesSolved: 0,
    selectedSquare: null,
    lastMove: null,
    feedback: { kind: 'idle' },
  };
}

function DrillView({
  config,
  puzzles,
  onFinish,
  onBail,
}: {
  config: DrillConfig;
  puzzles: ChessPuzzle[];
  onFinish: (result: DrillResult) => void;
  onBail: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  // Count of move attempts the kid made on the current puzzle (incl. wrong).
  // Used as the `movesTaken` payload for the earn — only equals the puzzle's
  // expected kid-ply count when they solve cleanly.
  const [movesTaken, setMovesTaken] = useState(0);
  // Session id makes idempotency keys per-(puzzle, this-round) so playing the
  // same puzzle in a later round still earns. Re-claimed via the same key
  // when an anon kid logs in after the round (matches Math/LA semantics).
  const sessionIdRef = useRef<string>(
    crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const puzzle = puzzles[idx];
  const [solve, setSolve] = useState<SolveState>(() => freshSolveState(puzzle));
  const aiReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme + orientation. We orient the board so the side-to-move is on the
  // bottom, which makes the puzzle visually intuitive (the kid plays
  // bottom-up).
  const theme = useMemo(() => getTheme(config.themeId), [config.themeId]);
  const startingPosition = useMemo(() => parseFEN(puzzle.fen), [puzzle]);
  const flipped = startingPosition.turn === 'b';

  // Reset solve state when puzzle changes.
  useEffect(() => {
    if (aiReplyTimerRef.current) clearTimeout(aiReplyTimerRef.current);
    setSolve(freshSolveState(puzzle));
    setMovesTaken(0);
  }, [puzzle]);

  // Cleanup pending AI-reply timer on unmount.
  useEffect(() => () => {
    if (aiReplyTimerRef.current) clearTimeout(aiReplyTimerRef.current);
  }, []);

  // Compute legal destinations for the selected square (used by Board to
  // glow the legal squares).
  const legalDestinations = useMemo<number[]>(() => {
    if (solve.selectedSquare === null) return [];
    const moves = legalMoves(solve.position, solve.selectedSquare);
    return Array.from(new Set(moves.map((m) => m.to)));
  }, [solve.position, solve.selectedSquare]);

  // King in check (for the red glow).
  const checkSquare = useMemo<number | null>(() => {
    const color = solve.position.turn;
    if (!isCheck(solve.position, color)) return null;
    for (let i = 0; i < solve.position.board.length; i++) {
      const piece = solve.position.board[i];
      if (piece && piece.color === color && piece.type === 'K') return i;
    }
    return null;
  }, [solve.position]);

  // The kid plays the side-to-move at the puzzle's starting FEN — that is,
  // the side that plays AT the original puzzle. After their move + the AI's
  // reply, the side-to-move flips back to the kid for the next ply.
  const kidColor = startingPosition.turn;
  const isKidsTurn = solve.position.turn === kidColor;

  // Apply the kid's move and (if more plies remain) schedule the AI's reply.
  const applyKidMove = (move: Move) => {
    // Count every attempt (right OR wrong). The efficiency bonus in the
    // server formula is awarded only when movesTaken === expected, so a
    // single wrong attempt forfeits the bonus.
    setMovesTaken((n) => n + 1);

    const expectedUci = puzzle.movesToSolve[solve.pliesSolved];
    const kidUci = moveToUci(move);
    if (kidUci !== expectedUci) {
      // Wrong! Highlight the expected move for feedback.
      const expectedMove = uciToMove(solve.position, expectedUci);
      const expected = expectedMove
        ? { from: expectedMove.from, to: expectedMove.to }
        : null;
      setSolve({
        ...solve,
        selectedSquare: null,
        feedback: expected ? { kind: 'wrong', expected } : { kind: 'idle' },
      });
      return;
    }

    // Right! Apply the move.
    const newPosition = makeMove(solve.position, move);
    const newPliesSolved = solve.pliesSolved + 1;
    const lastMove = { from: move.from, to: move.to };

    // If the puzzle is done, mark solved and advance.
    if (newPliesSolved >= puzzle.movesToSolve.length) {
      setSolve({
        position: newPosition,
        pliesSolved: newPliesSolved,
        selectedSquare: null,
        lastMove,
        feedback: { kind: 'solved' },
      });
      // Brief pause to let the kid see the final position, then advance.
      aiReplyTimerRef.current = setTimeout(() => {
        recordResult(true);
      }, 1200);
      return;
    }

    // More plies to go — schedule the opponent's reply.
    setSolve({
      position: newPosition,
      pliesSolved: newPliesSolved,
      selectedSquare: null,
      lastMove,
      feedback: { kind: 'idle' },
    });

    aiReplyTimerRef.current = setTimeout(() => {
      const opponentUci = puzzle.movesToSolve[newPliesSolved];
      const opponentMove = uciToMove(newPosition, opponentUci);
      if (!opponentMove) {
        // The puzzle's reply is illegal in the current engine position —
        // this should never happen for verified puzzles. Just mark as a
        // miss and move on.
        // eslint-disable-next-line no-console
        console.error(
          `Puzzle ${puzzle.id}: opponent reply ${opponentUci} not legal at ply ${newPliesSolved}`,
        );
        recordResult(false);
        return;
      }
      const afterOpponent = makeMove(newPosition, opponentMove);
      setSolve((prev) => ({
        ...prev,
        position: afterOpponent,
        pliesSolved: newPliesSolved + 1,
        lastMove: { from: opponentMove.from, to: opponentMove.to },
        feedback: { kind: 'idle' },
        selectedSquare: null,
      }));
    }, 700);
  };

  const handleSquareClick = (square: number) => {
    if (!isKidsTurn) return;
    if (solve.feedback.kind === 'solved') return;

    const piece = solve.position.board[square];

    // First click selects a piece (must be the kid's color and side-to-move).
    if (solve.selectedSquare === null) {
      if (!piece || piece.color !== solve.position.turn) return;
      setSolve({
        ...solve,
        selectedSquare: square,
        feedback: { kind: 'idle' },
      });
      return;
    }

    // Click on the same square deselects.
    if (solve.selectedSquare === square) {
      setSolve({ ...solve, selectedSquare: null });
      return;
    }

    // Click on another of the kid's pieces switches selection.
    if (piece && piece.color === solve.position.turn) {
      setSolve({ ...solve, selectedSquare: square });
      return;
    }

    // Try the move. Promotions: puzzles always promote to Q for v1 — there
    // are no underpromotion puzzles in the bank.
    const candidates = legalMoves(solve.position, solve.selectedSquare);
    let move = candidates.find((m) => m.to === square && !m.promotion);
    if (!move) {
      // Try a promotion move (defaults to Q).
      move = candidates.find((m) => m.to === square && m.promotion === 'Q');
    }
    if (!move) {
      // Not a legal move — deselect.
      setSolve({ ...solve, selectedSquare: null });
      return;
    }

    applyKidMove(move);
  };

  // Track in-flight earn promises so we can await them all on round finish.
  // We push the resolved outcome into a ref so the round-finish handler can
  // pass the complete list to onFinish regardless of which puzzle resolves
  // last (the DrillView unmounts when we transition to the results view).
  const outcomesRef = useRef<PuzzleOutcome[]>([]);
  const pendingEarnsRef = useRef<Promise<void>[]>([]);

  const recordResult = (solved: boolean) => {
    const id = puzzle.id;
    const theme = puzzle.theme;
    // Capture movesTaken at call time so the closure doesn't read a stale 0
    // after the puzzle-change useEffect runs.
    const movesAtCall = movesTaken;
    if (solved) {
      setSolvedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setFailedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }

    // Per-puzzle idempotency: stable across logout->login (same key gets
    // claimed) but unique per (puzzle, this session) so playing the same
    // puzzle in a later round still earns.
    const idempotencyKey = `puzzle-${id}-${sessionIdRef.current}`;

    // Fire the earn. Resolves into outcomesRef + state when done.
    const earnPromise = submitEarn(
      'chess',
      'puzzle',
      {
        result: solved ? 'solved' : 'gave-up',
        theme,
        movesTaken: movesAtCall,
        puzzleId: id,
      },
      idempotencyKey,
    ).then((res) => {
      outcomesRef.current.push({
        puzzleId: id,
        theme,
        result: solved ? 'solved' : 'gave-up',
        movesTaken: movesAtCall,
        earn: res,
      });
    });
    pendingEarnsRef.current.push(earnPromise);

    // Advance to next puzzle, or finish (after all in-flight earns settle).
    const nextIdx = idx + 1;
    if (nextIdx >= puzzles.length) {
      const finalSolved = solved
        ? Array.from(new Set([...solvedIds, id]))
        : solvedIds;
      const finalFailed = solved
        ? failedIds
        : Array.from(new Set([...failedIds, id]));
      void Promise.allSettled(pendingEarnsRef.current).then(() => {
        onFinish({
          solvedIds: finalSolved,
          failedIds: finalFailed,
          total: puzzles.length,
          outcomes: [...outcomesRef.current],
        });
      });
      return;
    }
    setIdx(nextIdx);
  };

  const handleSkip = () => {
    if (aiReplyTimerRef.current) clearTimeout(aiReplyTimerRef.current);
    recordResult(false);
  };

  const handleRetry = () => {
    if (aiReplyTimerRef.current) clearTimeout(aiReplyTimerRef.current);
    setSolve(freshSolveState(puzzle));
  };

  // Render the "expected move" highlight when feedback is "wrong".
  const expectedHighlight =
    solve.feedback.kind === 'wrong' ? solve.feedback.expected : null;

  // For Board display: if we have an "expected" overlay, show it as the
  // lastMove (re-using the existing visual cue). Otherwise show the real
  // last move.
  const boardLastMove = expectedHighlight ?? solve.lastMove;

  const themeLabel = (() => {
    switch (puzzle.theme) {
      case 'mate-in-1': return 'Mate in 1';
      case 'mate-in-2': return 'Mate in 2';
      case 'mate-in-3': return 'Mate in 3';
      case 'endgame': return 'Endgame';
    }
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Left: board + hint + actions */}
      <div className="space-y-3">
        {/* Header strip */}
        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-md p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Puzzle {idx + 1} of {puzzles.length}
              </span>
              <span className="text-xs font-bold text-purple-900 bg-purple-100 rounded-full px-2 py-0.5">
                {themeLabel}
              </span>
              <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                puzzle.difficulty === 'easy'
                  ? 'bg-emerald-100 text-emerald-800'
                  : puzzle.difficulty === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-rose-100 text-rose-800'
              }`}>
                {puzzle.difficulty}
              </span>
            </div>
            <div className="text-xs font-bold text-emerald-700">
              ✓ {solvedIds.length} solved · ✗ {failedIds.length} missed
            </div>
          </div>
          <div className="text-sm text-purple-800">
            {puzzle.description ?? 'Find the best move.'}
          </div>
          <div className="text-xs font-bold text-purple-700 mt-1">
            {kidColor === 'w' ? '♔ White' : '♚ Black'} to move.
          </div>
        </div>

        {/* Feedback strip */}
        <div className="min-h-[44px]">
          {solve.feedback.kind === 'wrong' && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl px-4 py-2 text-center">
              <div className="text-sm font-bold text-rose-900">
                Not quite — the expected move is highlighted on the board.
              </div>
              <div className="text-xs text-rose-700 mt-0.5">
                Try again, or skip to the next puzzle.
              </div>
            </div>
          )}
          {solve.feedback.kind === 'solved' && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-4 py-2 text-center">
              <div className="text-sm font-bold text-emerald-900">
                Solved! ✨
              </div>
            </div>
          )}
        </div>

        <div className="pl-5">
          <Board
            board={solve.position.board}
            legalDestinations={legalDestinations}
            selectedSquare={solve.selectedSquare}
            lastMove={
              boardLastMove
                ? { from: boardLastMove.from, to: boardLastMove.to }
                : null
            }
            checkSquare={checkSquare}
            theme={theme}
            flipped={flipped}
            onSquareClick={handleSquareClick}
          />
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-2 justify-center pl-5 pt-2">
          {solve.feedback.kind === 'wrong' ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-5 py-2 rounded-2xl text-sm transition-colors"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
              >
                Skip puzzle →
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSkip}
              disabled={solve.feedback.kind === 'solved'}
              className="bg-white border-2 border-purple-300 hover:border-purple-500 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
            >
              Skip puzzle →
            </button>
          )}
          <button
            type="button"
            onClick={onBail}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Right column: round progress + move trace */}
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-md p-4">
          <h3 className="text-sm font-black text-purple-900 mb-2">
            Round progress
          </h3>
          <div className="grid grid-cols-5 gap-1.5">
            {puzzles.map((p, i) => {
              const solvedIt = solvedIds.includes(p.id);
              const failedIt = failedIds.includes(p.id);
              const isCurrent = i === idx;
              return (
                <div
                  key={p.id}
                  className={`aspect-square rounded-md text-xs font-bold flex items-center justify-center ${
                    isCurrent
                      ? 'bg-purple-700 text-white ring-2 ring-purple-900'
                      : solvedIt
                        ? 'bg-emerald-200 text-emerald-900'
                        : failedIt
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-purple-100 text-purple-700'
                  }`}
                  title={`Puzzle ${i + 1}: ${p.theme} (${p.difficulty})`}
                >
                  {solvedIt ? '✓' : failedIt ? '✗' : i + 1}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-md p-4">
          <h3 className="text-sm font-black text-purple-900 mb-1">
            How to play
          </h3>
          <ul className="text-xs text-purple-800 list-disc pl-4 space-y-1">
            <li>Tap a piece, then tap where it goes.</li>
            <li>If you play the right move, the opponent (if any) will reply automatically.</li>
            <li>If you play the wrong move, the right square will be highlighted.</li>
            <li>Skip a puzzle to move on without solving it.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-md p-4">
          <h3 className="text-sm font-black text-purple-900 mb-1">
            Position (FEN)
          </h3>
          <div className="text-[10px] font-mono text-purple-700 break-all">
            {puzzle.fen}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// RESULTS card
// =========================================================================

function ResultsCard({
  config,
  result,
  onPlayAgain,
}: {
  config: DrillConfig;
  result: DrillResult;
  onPlayAgain: () => void;
}) {
  const { refresh } = useLearner();
  const solved = result.solvedIds.length;
  const total = result.total;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

  const emoji = pct === 100 ? '🏆' : pct >= 75 ? '🎉' : pct >= 50 ? '👍' : '💪';
  const headline = pct === 100
    ? 'Clean sweep!'
    : pct >= 75
      ? 'Great solving!'
      : pct >= 50
        ? 'Solid round!'
        : 'Keep at it!';

  // Tally what we earned in this round. Three states per outcome:
  //   - logged-in success → centsEarned counted into bankedCents
  //   - anonymous preview → centsEarned counted into pendingCents (claim UI)
  //   - error → counted in errorCount, skipped from totals
  const tally = useMemo(() => {
    let bankedCents = 0;
    let pendingCents = 0;
    let errorCount = 0;
    const pendings: Extract<EarnResponse, { pending: true }>[] = [];
    for (const o of result.outcomes) {
      if (!o.earn) {
        errorCount += 1;
        continue;
      }
      if ('error' in o.earn) {
        errorCount += 1;
        continue;
      }
      if (isPending(o.earn)) {
        pendingCents += o.earn.centsEarned;
        if (o.earn.centsEarned > 0) pendings.push(o.earn);
        continue;
      }
      bankedCents += o.earn.centsEarned;
    }
    return { bankedCents, pendingCents, errorCount, pendings };
  }, [result.outcomes]);

  // After claim succeeds we want the header chip refreshed. The
  // PendingEarnPrompt does this itself, but the parent also wants to update
  // its local banked total so subsequent claims (and the final summary) read
  // correctly. Track "claimed" amounts here.
  const [extraBankedCents, setExtraBankedCents] = useState(0);
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());

  const handleClaimed = useCallback(
    (idempotencyKey: string, cents: number) => {
      setExtraBankedCents((n) => n + cents);
      setClaimedKeys((prev) => {
        const next = new Set(prev);
        next.add(idempotencyKey);
        return next;
      });
      void refresh();
    },
    [refresh],
  );

  const totalBankedCents = tally.bankedCents + extraBankedCents;
  const stillPending = tally.pendings.filter((p) => !claimedKeys.has(p.idempotencyKey));
  const totalCentsThisRound = tally.bankedCents + tally.pendingCents;

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-200 p-6 md:p-8 max-w-xl mx-auto text-center">
      <div className="text-6xl mb-2">{emoji}</div>
      <h2 className="text-3xl font-black text-purple-900 mb-2">{headline}</h2>
      <div className="text-5xl font-black text-purple-700 my-4">
        {solved} / {total}
      </div>
      <div className="text-sm text-purple-800 mb-6">
        {pct}% — {config.difficulty === 'mixed' ? 'mixed difficulty' : config.difficulty}
        {' · '}
        {config.theme === 'any' ? 'all themes' : config.theme.replace(/-/g, ' ')}
      </div>

      {/* MP earned summary — banked for logged-in kids; pending for anon. */}
      {totalCentsThisRound > 0 && stillPending.length === 0 && (
        <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 mb-5 text-center">
          <div className="text-xs uppercase tracking-wide text-yellow-800 font-bold">
            MP earned this round
          </div>
          <div className="text-4xl font-black text-yellow-900 my-1">
            +{centsToMP(totalBankedCents)}
          </div>
          <div className="text-xs text-yellow-800">
            {solved} puzzle{solved === 1 ? '' : 's'} solved
          </div>
        </div>
      )}
      {totalCentsThisRound === 0 && result.outcomes.length > 0 && tally.errorCount === 0 && (
        <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-3 mb-5 text-center text-sm text-purple-800">
          No MP this round — solve a puzzle to earn next time!
        </div>
      )}
      {tally.errorCount > 0 && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 mb-5 text-center text-xs text-rose-800">
          Couldn&apos;t record MP for {tally.errorCount} puzzle{tally.errorCount === 1 ? '' : 's'} (network hiccup).
        </div>
      )}

      {/* Pending claim cards — one per pending earn. Anon kid can log in
          once and reuse the same name+PIN to claim them all (each form
          handles its own re-submit with the held idempotency key). */}
      {stillPending.length > 0 && (
        <div className="mb-5 text-left">
          <div className="text-center text-sm font-bold text-yellow-900 mb-2">
            You earned +{centsToMP(tally.pendingCents)} — log in to keep it!
          </div>
          {stillPending.map((p) => (
            <PendingEarnPrompt
              key={p.idempotencyKey}
              pending={{
                section: p.section,
                kind: p.kind,
                payload: p.payload,
                idempotencyKey: p.idempotencyKey,
                centsEarned: p.centsEarned,
                reason: p.reason,
              }}
              onClaimed={(cents) => handleClaimed(p.idempotencyKey, cents)}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="bg-purple-900 hover:bg-purple-800 text-white font-black py-3 rounded-2xl transition-colors"
        >
          Solve another round
        </button>
        <Link
          href="/chess"
          className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold py-3 rounded-2xl transition-colors flex items-center justify-center"
        >
          Back to Chess hub
        </Link>
      </div>

      <div className="text-[11px] text-purple-600 mt-5">
        Mate-in-1 = 0.50MP · mate-in-2 = 1.00MP · mate-in-3 = 1.50MP · endgame = 1.00MP.
        Solve in the minimum moves for a +0.25MP bonus.
      </div>
    </div>
  );
}
