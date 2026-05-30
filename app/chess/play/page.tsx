'use client';

// Chess play page — three views:
//   1) Config:  player names, mode (2-player or vs-AI w/ difficulty + side),
//               theme, board orientation. Start.
//   2) Playing: Board + MoveList + TurnIndicator + Undo + Resign. Promotion
//               picker pops up on pawn-to-back-rank. GameOverCard on end.
//   3) GameOver: rendered as modal overlay; for vs-AI games it submits the
//               result to /api/chess/game/finish for MP credit.
//
// State: useReducer keyed on the engine's Position. All rule decisions go
// through lib/chess/engine.ts. The UI never decides what is legal.
//
// AI move loop: when it's the AI's turn we schedule chooseMove() inside a
// setTimeout(0) so the "Thinking…" indicator paints first. The AI is
// synchronous; with the Wizard 3s budget this WILL block the main thread,
// but the indicator is up and there's no UI input expected during that
// window (board buttons all check `aiThinking`). A Worker would require
// serializing the Position and pulling all engine modules into the worker
// bundle — too much weight for v1.
//
// Autosave: 800ms after each move, fire-and-forget POST to
// /api/chess/game/save. Skipped silently if the user is not logged in
// (server returns 401 for anon). Shows a tiny "Saved" indicator briefly.
//
// Finish: when the engine reports end-state (or on resignation), for vs-AI
// games we POST to /api/chess/game/finish. For anonymous kids we compute
// the would-have-earned amount client-side via computeChessReward() and
// show an inline login form; on login we re-POST finish with the SAME
// game.id so the server's idempotency dedupe protects against double credit.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import Board from '@/components/chess/Board';
import MoveList from '@/components/chess/MoveList';
import TurnIndicator from '@/components/chess/TurnIndicator';
import PromotionPicker, {
  type PromotionChoice,
} from '@/components/chess/PromotionPicker';
import GameOverCard, {
  type GameOverReason,
  type GameOverResult,
} from '@/components/chess/GameOverCard';
import ThemePicker from '@/components/chess/ThemePicker';
import {
  CHESS_THEMES,
  DEFAULT_THEME_ID,
  getTheme,
  type ChessThemeId,
} from '@/data/chess-themes';
import type { GameStatusLite, UiMove } from '@/components/chess/chess-ui-types';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

// Engine imports.
import {
  initialPosition,
  legalMoves,
  makeMove,
  isCheck,
  gameStatus,
  squareToAlgebraic,
  type Position,
  type Move,
  type Color,
  type Square as EngineSquare,
} from '@/lib/chess/engine';
import { toFEN } from '@/lib/chess/fen';
import { chooseMove, type AiLevel } from '@/lib/chess/ai';
import { computeChessReward, type ChessOpponent } from '@/lib/chess/reward';
import type {
  ChessReason,
  ChessWinner,
  SavedChessGame,
} from '@/lib/chess/game-state';

// -------------------------------------------------------------------------
// Top-level page
// -------------------------------------------------------------------------

export default function ChessPlayPage() {
  return (
    <LoginGate
      section="chess"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-purple-700">Loading…</div>
        </div>
      }
    >
      <ChessPlayAuthed />
    </LoginGate>
  );
}

type GameMode = 'local' | 'ai';

type GameSetup = {
  whiteName: string;
  blackName: string;
  mode: GameMode;
  aiLevel?: AiLevel;
  // For ai mode: which color the AI plays as.
  aiColor?: Color;
  themeId: ChessThemeId;
  flipped: boolean;       // true = Black at bottom
  // If resuming, the saved game we resume from.
  resume?: SavedChessGame;
};

type View =
  | { kind: 'config' }
  | { kind: 'playing'; setup: GameSetup };

function ChessPlayAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });
  const [resumeOffer, setResumeOffer] = useState<SavedChessGame | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const { learner } = useLearner();

  // On mount (and whenever learner changes), check for a resumable game.
  // All setState happens inside the async closure (after a fetch await) so
  // we don't trigger cascading renders inside the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!learner) {
        if (!cancelled) {
          setResumeOffer(null);
          setResumeChecked(true);
        }
        return;
      }
      try {
        const res = await fetch('/api/chess/game', { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) {
          setResumeOffer(null);
          setResumeChecked(true);
          return;
        }
        const data = (await res.json()) as { progress?: { current?: SavedChessGame } };
        if (cancelled) return;
        const current = data.progress?.current;
        if (current && !current.result) {
          setResumeOffer(current);
        } else {
          setResumeOffer(null);
        }
        setResumeChecked(true);
      } catch {
        if (!cancelled) {
          setResumeOffer(null);
          setResumeChecked(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [learner]);

  const handleStart = useCallback((setup: GameSetup) => {
    setResumeOffer(null);
    setView({ kind: 'playing', setup });
  }, []);

  const handleResume = useCallback(() => {
    if (!resumeOffer) return;
    const setup: GameSetup = {
      whiteName: resumeOffer.players.white,
      blackName: resumeOffer.players.black,
      mode: resumeOffer.mode,
      aiLevel: resumeOffer.aiLevel,
      aiColor: resumeOffer.aiColor,
      themeId: (resumeOffer.theme as ChessThemeId) || DEFAULT_THEME_ID,
      flipped: false,
      resume: resumeOffer,
    };
    setResumeOffer(null);
    setView({ kind: 'playing', setup });
  }, [resumeOffer]);

  const handleDiscardResume = useCallback(async () => {
    setResumeOffer(null);
    // Best-effort delete; fire-and-forget.
    try {
      await fetch('/api/chess/game', { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      // ignore
    }
  }, []);

  const backToConfig = useCallback(() => setView({ kind: 'config' }), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-yellow-50 to-white py-8 px-3 md:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <Link
            href="/chess"
            className="text-purple-700 hover:text-purple-900 text-sm font-semibold"
          >
            ← Chess hub
          </Link>
        </div>

        {view.kind === 'config' && (
          <>
            {resumeChecked && resumeOffer && (
              <ResumeBanner
                game={resumeOffer}
                onResume={handleResume}
                onDiscard={handleDiscardResume}
              />
            )}
            <ConfigCard onStart={handleStart} />
          </>
        )}
        {view.kind === 'playing' && (
          <PlayView setup={view.setup} onExit={backToConfig} />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Resume banner
// -------------------------------------------------------------------------

function ResumeBanner({
  game,
  onResume,
  onDiscard,
}: {
  game: SavedChessGame;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const plies = game.moveHistory.length;
  const movesDesc = plies === 0
    ? 'no moves yet'
    : `${Math.ceil(plies / 2)} move${plies > 2 ? 's' : ''} in`;
  const modeDesc = game.mode === 'ai'
    ? `vs ${game.aiLevel ? game.aiLevel[0].toUpperCase() + game.aiLevel.slice(1) : 'AI'}`
    : `${game.players.white} vs ${game.players.black}`;
  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 md:p-5 mb-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-black text-yellow-900">
            ⏯ You have a game in progress
          </div>
          <div className="text-xs text-yellow-800 mt-0.5">
            {modeDesc} · {movesDesc}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onResume}
            className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            Resume game
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="bg-white border-2 border-yellow-300 hover:border-yellow-500 text-yellow-900 font-bold px-3 py-2 rounded-xl text-sm transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// 1) CONFIG
// -------------------------------------------------------------------------

type AiSide = 'w' | 'b' | 'random';

const AI_LEVELS: { key: AiLevel; label: string; emoji: string; blurb: string }[] = [
  { key: 'cub', label: 'Cub', emoji: '🐻', blurb: 'Quick, plays nice' },
  { key: 'knight', label: 'Knight', emoji: '🐴', blurb: 'Thinks 3 moves ahead' },
  { key: 'wizard', label: 'Wizard', emoji: '🧙', blurb: 'Will challenge you' },
];

function ConfigCard({ onStart }: { onStart: (setup: GameSetup) => void }) {
  const [whiteName, setWhiteName] = useState('White');
  const [blackName, setBlackName] = useState('Black');
  const [mode, setMode] = useState<GameMode>('local');
  const [aiLevel, setAiLevel] = useState<AiLevel>('cub');
  // The side selector picks the HUMAN's color. AI gets the opposite.
  const [humanSide, setHumanSide] = useState<AiSide>('w');
  const [themeId, setThemeId] = useState<ChessThemeId>(DEFAULT_THEME_ID);
  const [flipped, setFlipped] = useState(false);

  const handleStart = () => {
    let aiColor: Color | undefined;
    let resolvedWhite = whiteName.trim() || 'White';
    let resolvedBlack = blackName.trim() || 'Black';
    let resolvedFlipped = flipped;
    if (mode === 'ai') {
      // Resolve human side.
      let chosen: Color;
      if (humanSide === 'random') {
        chosen = Math.random() < 0.5 ? 'w' : 'b';
      } else {
        chosen = humanSide;
      }
      aiColor = chosen === 'w' ? 'b' : 'w';
      // Label the players: the human side gets their name, the AI side gets
      // the difficulty label.
      const humanLabel = (whiteName.trim() || 'You'); // we reuse whiteName as "your name"
      const aiLabel = aiLevel === 'cub' ? '🐻 Cub'
        : aiLevel === 'knight' ? '🐴 Knight'
        : '🧙 Wizard';
      if (chosen === 'w') {
        resolvedWhite = humanLabel;
        resolvedBlack = aiLabel;
        // Human plays White, default board orientation is fine (white-bottom).
        resolvedFlipped = false;
      } else {
        resolvedWhite = aiLabel;
        resolvedBlack = humanLabel;
        // Human plays Black; flip board so human pieces are at the bottom.
        resolvedFlipped = true;
      }
    }
    onStart({
      whiteName: resolvedWhite,
      blackName: resolvedBlack,
      mode,
      aiLevel: mode === 'ai' ? aiLevel : undefined,
      aiColor,
      themeId,
      flipped: resolvedFlipped,
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-200 p-6 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">♟️</div>
        <h2 className="text-2xl md:text-3xl font-black text-purple-900">
          Set up the game
        </h2>
        <p className="text-sm text-purple-700 mt-1">
          {mode === 'local'
            ? 'Two players, one board.'
            : 'Play against the computer. Wins and draws earn MP.'}
        </p>
      </div>

      {/* Mode */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Mode
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
              mode === 'local'
                ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
            }`}
          >
            👥 Two players
          </button>
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
              mode === 'ai'
                ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
            }`}
          >
            🧙 vs AI
          </button>
        </div>
      </fieldset>

      {/* Player names (local) OR Your name (ai) */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          {mode === 'local' ? 'Players' : 'Your name'}
        </legend>
        {mode === 'local' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-purple-700 block mb-1">
                ♔ White
              </span>
              <input
                type="text"
                value={whiteName}
                onChange={(e) => setWhiteName(e.target.value.slice(0, 20))}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900 font-semibold"
                maxLength={20}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-purple-700 block mb-1">
                ♚ Black
              </span>
              <input
                type="text"
                value={blackName}
                onChange={(e) => setBlackName(e.target.value.slice(0, 20))}
                className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900 font-semibold"
                maxLength={20}
              />
            </label>
          </div>
        ) : (
          <input
            type="text"
            value={whiteName}
            onChange={(e) => setWhiteName(e.target.value.slice(0, 20))}
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900 font-semibold"
            placeholder="Your name"
            maxLength={20}
          />
        )}
      </fieldset>

      {/* AI difficulty + side, only in AI mode */}
      {mode === 'ai' && (
        <>
          <fieldset className="mb-6">
            <legend className="block text-sm font-bold text-purple-900 mb-2">
              Difficulty
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {AI_LEVELS.map((lvl) => {
                const on = aiLevel === lvl.key;
                return (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => setAiLevel(lvl.key)}
                    className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                      on
                        ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                        : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                    }`}
                  >
                    <div className="text-2xl">{lvl.emoji}</div>
                    <div>{lvl.label}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${on ? 'text-purple-100' : 'text-purple-700'}`}>
                      {lvl.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="block text-sm font-bold text-purple-900 mb-2">
              Your side
            </legend>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setHumanSide('w')}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  humanSide === 'w'
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                ♔ White
              </button>
              <button
                type="button"
                onClick={() => setHumanSide('b')}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  humanSide === 'b'
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                ♚ Black
              </button>
              <button
                type="button"
                onClick={() => setHumanSide('random')}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  humanSide === 'random'
                    ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                    : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
                }`}
              >
                🎲 Random
              </button>
            </div>
          </fieldset>
        </>
      )}

      {/* Theme */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Piece set
        </legend>
        <ThemePicker selectedId={themeId} onSelect={setThemeId} />
      </fieldset>

      {/* Orientation (local only — AI mode auto-orients to put human at bottom) */}
      {mode === 'local' && (
        <fieldset className="mb-6">
          <legend className="block text-sm font-bold text-purple-900 mb-2">
            Board orientation
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                !flipped
                  ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                  : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
              }`}
            >
              White at bottom
            </button>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                flipped
                  ? 'border-purple-700 bg-purple-700 text-white shadow-md'
                  : 'border-purple-200 bg-purple-50 text-purple-900 hover:border-purple-400'
              }`}
            >
              Black at bottom
            </button>
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={handleStart}
        className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-800 hover:to-purple-900 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start game →
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------
// 2) PLAY — reducer + view
// -------------------------------------------------------------------------

type PlayState = {
  // The engine position is the source of truth.
  position: Position;
  // History of positions for undo.
  history: Position[];
  moveHistory: UiMove[];
  // UCI move history (parallel to moveHistory) for save round-trip.
  uciHistory: string[];
  selectedSquare: EngineSquare | null;
  pendingPromotion: { from: EngineSquare; to: EngineSquare } | null;
  result: GameOverResult | null;
};

type Action =
  | { type: 'SELECT_SQUARE'; square: EngineSquare }
  | { type: 'CONFIRM_MOVE'; move: Move }
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: 'w' | 'b' }
  | { type: 'CANCEL_PROMOTION' }
  | { type: 'RESET' };

function initialState(resume?: SavedChessGame): PlayState {
  if (resume) {
    // Replay from initial position through the UCI history so we get a fresh
    // history stack (for undo) and an authoritative engine position.
    let pos = initialPosition();
    const history: Position[] = [pos];
    const moveHistory: UiMove[] = [];
    const uciHistory: string[] = [];
    for (const uci of resume.moveHistory) {
      const fromAlg = uci.slice(0, 2);
      const toAlg = uci.slice(2, 4);
      const promoChar = uci.slice(4, 5);
      try {
        const from = algIdx(fromAlg);
        const to = algIdx(toAlg);
        const candidates = legalMoves(pos, from);
        const promo = promoChar
          ? (promoChar.toUpperCase() as 'Q' | 'R' | 'B' | 'N')
          : undefined;
        const match = candidates.find(
          (m) =>
            m.to === to &&
            (promo ? m.promotion === promo : !m.promotion),
        );
        if (!match) break;
        pos = makeMove(pos, match);
        history.push(pos);
        moveHistory.push({
          from: match.from,
          to: match.to,
          promotion: match.promotion,
          flag: match.flag,
        });
        uciHistory.push(uci);
      } catch {
        break;
      }
    }
    return {
      position: pos,
      history,
      moveHistory,
      uciHistory,
      selectedSquare: null,
      pendingPromotion: null,
      result: null,
    };
  }
  const pos = initialPosition();
  return {
    position: pos,
    history: [pos],
    moveHistory: [],
    uciHistory: [],
    selectedSquare: null,
    pendingPromotion: null,
    result: null,
  };
}

// Local helper: algebraic ('e2') → square index, mirroring engine's
// algebraicToSquare without an import cycle.
function algIdx(s: string): EngineSquare {
  const file = s.charCodeAt(0) - 97;
  const rank = 8 - Number(s[1]);
  return rank * 8 + file;
}

function moveToUciLocal(move: Move): string {
  const base = squareToAlgebraic(move.from) + squareToAlgebraic(move.to);
  if (!move.promotion) return base;
  return base + move.promotion.toLowerCase();
}

function reducer(state: PlayState, action: Action): PlayState {
  // If the game is over, no further moves — only RESET is honored.
  if (state.result && action.type !== 'RESET') {
    return state;
  }

  switch (action.type) {
    case 'SELECT_SQUARE': {
      const { square } = action;
      const piece = state.position.board[square];

      if (state.selectedSquare === null) {
        if (!piece || piece.color !== state.position.turn) {
          return state;
        }
        return { ...state, selectedSquare: square };
      }

      if (state.selectedSquare === square) {
        return { ...state, selectedSquare: null };
      }

      if (piece && piece.color === state.position.turn) {
        return { ...state, selectedSquare: square };
      }

      const candidates = legalMoves(state.position, state.selectedSquare);
      const matching = candidates.filter((m) => m.to === square);
      if (matching.length === 0) {
        return { ...state, selectedSquare: null };
      }

      const hasPromotion = matching.some((m) => m.promotion !== undefined);
      if (hasPromotion) {
        return {
          ...state,
          pendingPromotion: { from: state.selectedSquare, to: square },
          selectedSquare: null,
        };
      }

      return applyMove(state, matching[0]);
    }

    case 'CONFIRM_MOVE': {
      return applyMove(state, action.move);
    }

    case 'CANCEL_PROMOTION': {
      return { ...state, pendingPromotion: null, selectedSquare: null };
    }

    case 'UNDO': {
      if (state.history.length <= 1) return state;
      const newHistory = state.history.slice(0, -1);
      const newPosition = newHistory[newHistory.length - 1];
      return {
        ...state,
        history: newHistory,
        position: newPosition,
        moveHistory: state.moveHistory.slice(0, -1),
        uciHistory: state.uciHistory.slice(0, -1),
        selectedSquare: null,
        pendingPromotion: null,
        result: null,
      };
    }

    case 'RESIGN': {
      return {
        ...state,
        selectedSquare: null,
        pendingPromotion: null,
        result: {
          winner: action.color === 'w' ? 'b' : 'w',
          reason: 'resignation',
        },
      };
    }

    case 'RESET': {
      return initialState();
    }
  }
}

function applyMove(state: PlayState, move: Move): PlayState {
  const newPosition = makeMove(state.position, move);
  const newHistory = [...state.history, newPosition];
  const newMoves = [
    ...state.moveHistory,
    {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      flag: move.flag,
    },
  ];
  const newUci = [...state.uciHistory, moveToUciLocal(move)];

  const status = gameStatus(newPosition);
  let result: GameOverResult | null = null;
  if (status === 'checkmate') {
    result = {
      winner: newPosition.turn === 'w' ? 'b' : 'w',
      reason: 'checkmate',
    };
  } else if (status === 'stalemate') {
    result = { winner: 'draw', reason: 'stalemate' };
  } else if (status === 'draw-50-move') {
    result = { winner: 'draw', reason: 'draw-50-move' };
  } else if (status === 'draw-threefold') {
    result = { winner: 'draw', reason: 'draw-threefold' };
  } else if (status === 'draw-insufficient') {
    result = { winner: 'draw', reason: 'draw-insufficient' };
  }

  return {
    ...state,
    position: newPosition,
    history: newHistory,
    moveHistory: newMoves,
    uciHistory: newUci,
    selectedSquare: null,
    pendingPromotion: null,
    result,
  };
}

function PlayView({
  setup,
  onExit,
}: {
  setup: GameSetup;
  onExit: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, setup.resume, initialState);
  const theme = useMemo(() => getTheme(setup.themeId), [setup.themeId]);
  const [flipped, setFlipped] = useState(setup.flipped);
  const [aiThinking, setAiThinking] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable per-game ID (used for save + finish idempotency). If resuming, use
  // the resumed game's id so the server dedupes against any earlier save.
  const gameIdRef = useRef<string>(
    setup.resume?.id ?? makeClientGameId(),
  );
  const startedAtRef = useRef<number>(setup.resume?.startedAt ?? Date.now());
  // Tracks whether the gameIdRef matches the current state's history. Reset
  // (new game) generates a fresh id so a new finish doesn't dedupe.
  const resetCounterRef = useRef(0);

  const isAiGame = setup.mode === 'ai';
  const aiColor = setup.aiColor;
  const aiLevel = setup.aiLevel;

  // Compute legal destinations for the selected piece.
  const legalDestinations = useMemo<number[]>(() => {
    if (state.selectedSquare === null) return [];
    const moves = legalMoves(state.position, state.selectedSquare);
    return Array.from(new Set(moves.map((m) => m.to)));
  }, [state.position, state.selectedSquare]);

  // Find a king square that's in check.
  const checkSquare = useMemo<number | null>(() => {
    if (state.result) return null;
    const color = state.position.turn;
    if (!isCheck(state.position, color)) return null;
    for (let i = 0; i < state.position.board.length; i++) {
      const piece = state.position.board[i];
      if (piece && piece.color === color && piece.type === 'K') return i;
    }
    return null;
  }, [state.position, state.result]);

  const statusLite: GameStatusLite = state.result
    ? mapResultToStatus(state.result.reason)
    : gameStatus(state.position);

  const lastMove = state.moveHistory.length
    ? state.moveHistory[state.moveHistory.length - 1]
    : null;

  // --- AI move loop -------------------------------------------------------
  //
  // When it's the AI's turn and the game isn't over, we schedule chooseMove()
  // on a setTimeout(0) so React commits + paints the "Thinking…" indicator
  // BEFORE the synchronous search runs.
  useEffect(() => {
    if (!isAiGame || !aiColor || !aiLevel) return;
    if (state.result) return;
    if (state.position.turn !== aiColor) return;
    if (state.pendingPromotion) return;
    if (aiThinking) return;

    setAiThinking(true);
    // Capture the position we're computing against — if state changes
    // (undo, reset) during the AI think, we'll discard the result.
    const positionAtSchedule = state.position;
    const t = setTimeout(() => {
      try {
        const move = chooseMove(positionAtSchedule, aiLevel);
        // Bail if the state changed under us (undo / reset).
        if (positionAtSchedule !== state.position) {
          setAiThinking(false);
          return;
        }
        dispatch({ type: 'CONFIRM_MOVE', move });
      } catch (err) {
        // chooseMove throws on a terminal position; that's the engine telling
        // us the game ended on the human move. The reducer should have set
        // state.result already; if not, just stop.
        console.error('AI choose error', err);
      } finally {
        setAiThinking(false);
      }
    }, 16); // small delay to give React's commit + paint a chance

    return () => {
      clearTimeout(t);
    };
    // We intentionally don't include `state.position` in the deps beyond what
    // we already use (`state.result`, `state.pendingPromotion`) — the
    // position check above is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.position, state.result, state.pendingPromotion, aiColor, aiLevel, isAiGame]);

  // --- Autosave -----------------------------------------------------------
  //
  // Debounced 800ms after each state change. Skipped if the game is over
  // (the finish endpoint handles persistence in that case) or if the user
  // is anonymous (save returns 401). Fire and forget.
  const totalMoves = state.uciHistory.length;
  useEffect(() => {
    // No save for empty / freshly-reset games.
    if (totalMoves === 0) return;
    if (state.result) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const game: SavedChessGame = {
        id: gameIdRef.current,
        startedAt: startedAtRef.current,
        updatedAt: Date.now(),
        mode: setup.mode,
        aiLevel: setup.aiLevel,
        aiColor: setup.aiColor,
        players: { white: setup.whiteName, black: setup.blackName },
        fen: toFEN(state.position),
        moveHistory: state.uciHistory,
        theme: setup.themeId,
      };
      setSaveIndicator('saving');
      void fetch('/api/chess/game/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ game }),
      })
        .then((res) => {
          if (res.ok) {
            setSaveIndicator('saved');
            if (savedFlashTimeoutRef.current) {
              clearTimeout(savedFlashTimeoutRef.current);
            }
            savedFlashTimeoutRef.current = setTimeout(
              () => setSaveIndicator('idle'),
              1500,
            );
          } else {
            // 401 (anonymous) or 4xx — silently drop back to idle.
            setSaveIndicator('idle');
          }
        })
        .catch(() => setSaveIndicator('idle'));
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // We don't include the whole state in the deps — only what affects the save
    // payload (position via uciHistory + result).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMoves, state.result]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedFlashTimeoutRef.current) clearTimeout(savedFlashTimeoutRef.current);
  }, []);

  const handleSquareClick = (square: number) => {
    if (aiThinking) return;
    // In AI mode, the human can only move their own color.
    if (isAiGame && aiColor && state.position.turn === aiColor) return;
    dispatch({ type: 'SELECT_SQUARE', square });
  };

  const handlePromotionChoose = (piece: PromotionChoice) => {
    if (!state.pendingPromotion) return;
    const candidates = legalMoves(state.position, state.pendingPromotion.from);
    const move = candidates.find(
      (m) =>
        m.to === state.pendingPromotion!.to && m.promotion === piece,
    );
    if (move) dispatch({ type: 'CONFIRM_MOVE', move });
    else dispatch({ type: 'CANCEL_PROMOTION' });
  };

  const handleResign = () => {
    // In AI mode, only the human can resign — and they're resigning for the
    // side that's NOT the AI. In local mode, whoever's turn it is resigns.
    let resigningColor: Color;
    if (isAiGame && aiColor) {
      resigningColor = aiColor === 'w' ? 'b' : 'w';
    } else {
      resigningColor = state.position.turn;
    }
    const resigningName = resigningColor === 'w' ? setup.whiteName : setup.blackName;
    if (window.confirm(`${resigningName}, resign this game?`)) {
      dispatch({ type: 'RESIGN', color: resigningColor });
    }
  };

  const handleNewGame = () => {
    if (state.history.length > 1 && !state.result) {
      if (!window.confirm('Start a new game? Current progress will be lost.')) return;
    }
    // Fresh game.id so post-finish a new game can earn separately.
    gameIdRef.current = makeClientGameId();
    startedAtRef.current = Date.now();
    resetCounterRef.current += 1;
    dispatch({ type: 'RESET' });
  };

  // Build the SavedChessGame snapshot for finish submission.
  const buildSavedGame = useCallback((): SavedChessGame => {
    return {
      id: gameIdRef.current,
      startedAt: startedAtRef.current,
      updatedAt: Date.now(),
      mode: setup.mode,
      aiLevel: setup.aiLevel,
      aiColor: setup.aiColor,
      players: { white: setup.whiteName, black: setup.blackName },
      fen: toFEN(state.position),
      moveHistory: state.uciHistory,
      theme: setup.themeId,
    };
  }, [setup, state.position, state.uciHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Left column: turn indicator + board + buttons */}
      <div className="space-y-4">
        <TurnIndicator
          turn={state.position.turn}
          status={statusLite}
          whiteName={setup.whiteName}
          blackName={setup.blackName}
        />

        {/* AI thinking + save indicator strip */}
        <div className="flex items-center justify-between pl-5 min-h-[20px]">
          <div className="text-xs font-bold text-purple-700">
            {aiThinking ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                {setup.aiLevel === 'wizard'
                  ? '🧙 Wizard is thinking…'
                  : setup.aiLevel === 'knight'
                    ? '🐴 Knight is thinking…'
                    : '🐻 Cub is thinking…'}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] font-bold text-emerald-700">
            {saveIndicator === 'saving' && '· saving'}
            {saveIndicator === 'saved' && '✓ saved'}
          </div>
        </div>

        <div className="pl-5">
          <Board
            board={state.position.board}
            legalDestinations={legalDestinations}
            selectedSquare={state.selectedSquare}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
            checkSquare={checkSquare}
            theme={theme}
            flipped={flipped}
            onSquareClick={handleSquareClick}
          />
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-2 justify-center pl-5">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={
              state.history.length <= 1 ||
              state.result !== null ||
              aiThinking
            }
            className="bg-white border-2 border-purple-300 hover:border-purple-500 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⇅ Flip board
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⟲ New game
          </button>
          <button
            type="button"
            onClick={handleResign}
            disabled={state.result !== null || aiThinking}
            className="bg-red-50 border-2 border-red-300 hover:border-red-500 hover:bg-red-100 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 text-red-800 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            🏳️ Resign
          </button>
          <button
            type="button"
            onClick={onExit}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Right column: move list */}
      <div>
        <MoveList moves={state.moveHistory} />
      </div>

      {/* Promotion modal */}
      {state.pendingPromotion && (
        <PromotionPicker
          color={state.position.turn}
          theme={theme}
          onChoose={handlePromotionChoose}
        />
      )}

      {/* Game-over modal */}
      {state.result && (
        <ChessGameOverWithEarn
          key={`${gameIdRef.current}-${resetCounterRef.current}`}
          result={state.result}
          setup={setup}
          buildSavedGame={buildSavedGame}
          onPlayAgain={handleNewGame}
        />
      )}

      {/* Quiet hint about the theme being changeable from /chess */}
      {CHESS_THEMES.length > 1 && (
        <div className="lg:col-span-2 text-center text-xs text-purple-600">
          Theme: <span className="font-bold">{theme.label}</span> · change it from
          {' '}
          <Link href="/chess" className="underline hover:text-purple-900">
            the hub
          </Link>
          {' '}or by exiting to Settings.
        </div>
      )}
    </div>
  );
}

function mapResultToStatus(reason: GameOverReason): GameStatusLite {
  switch (reason) {
    case 'checkmate':
      return 'checkmate';
    case 'stalemate':
      return 'stalemate';
    case 'resignation':
      return 'checkmate';
    case 'draw-50-move':
      return 'draw-50-move';
    case 'draw-threefold':
      return 'draw-threefold';
    case 'draw-insufficient':
      return 'draw-insufficient';
  }
}

// Map a UI GameOverReason to the server's ChessReason union.
function reasonToServerReason(reason: GameOverReason): ChessReason {
  switch (reason) {
    case 'checkmate': return 'checkmate';
    case 'stalemate': return 'stalemate';
    case 'resignation': return 'resignation';
    case 'draw-50-move': return '50-move';
    case 'draw-threefold': return 'threefold';
    case 'draw-insufficient': return 'insufficient';
  }
}

function winnerToServer(winner: GameOverResult['winner']): ChessWinner {
  if (winner === 'w') return 'w';
  if (winner === 'b') return 'b';
  return 'draw';
}

function makeClientGameId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// -------------------------------------------------------------------------
// 3) GAME OVER + EARN
// -------------------------------------------------------------------------
//
// Wraps GameOverCard with chess-specific earn logic:
//
//   - Local games (mode='local'): no MP submission. Just show the card.
//     (v1 decision per spec: sibling-vs-sibling on one device has no good
//      way to attribute the win to the right kid.)
//
//   - AI games + logged-in: POST /api/chess/game/finish, show
//     "+X.XX MP earned", refresh learner balance.
//
//   - AI games + anonymous: compute computeChessReward() client-side as a
//     PREVIEW, show an inline name+PIN form. On successful auth, POST
//     finish with the SAME game.id so the server idempotency dedupes
//     against any speculative preview state.

type FinishResponse = {
  centsEarned: number;
  balanceCents: number | null;
  reason: string;
  duplicate: boolean;
};

type EarnState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; cents: number; reason: string }
  | { kind: 'anon'; previewCents: number; reason: string }
  | { kind: 'error'; message: string };

function ChessGameOverWithEarn({
  result,
  setup,
  buildSavedGame,
  onPlayAgain,
}: {
  result: GameOverResult;
  setup: GameSetup;
  buildSavedGame: () => SavedChessGame;
  onPlayAgain: () => void;
}) {
  const { learner, refresh } = useLearner();
  const [earnState, setEarnState] = useState<EarnState>({ kind: 'idle' });
  const submittedRef = useRef(false);

  const isAiGame = setup.mode === 'ai';
  // Determine human result for vs-AI games.
  const humanResult = useMemo<'win' | 'loss' | 'draw' | null>(() => {
    if (!isAiGame) return null;
    if (result.winner === 'draw') return 'draw';
    if (!setup.aiColor) return null;
    return result.winner !== setup.aiColor ? 'win' : 'loss';
  }, [result.winner, setup.aiColor, isAiGame]);

  const opponent = useMemo<ChessOpponent | null>(() => {
    if (!isAiGame) return null;
    return setup.aiLevel ?? 'cub';
  }, [setup.aiLevel, isAiGame]);

  // Submit (or preview) once.
  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    // Local games: skip MP entirely.
    if (!isAiGame) {
      setEarnState({ kind: 'idle' });
      return;
    }

    // AI games — figure out the snapshot.
    const game = buildSavedGame();
    const finishedGame: SavedChessGame = {
      ...game,
      result: {
        winner: winnerToServer(result.winner),
        reason: reasonToServerReason(result.reason),
        finalFen: game.fen,
      },
    };

    if (!learner) {
      // Anonymous — preview only.
      if (humanResult && opponent) {
        const preview = computeChessReward({
          result: humanResult,
          opponent,
          moveCount: game.moveHistory.length,
        });
        setEarnState({
          kind: 'anon',
          previewCents: preview.cents,
          reason: preview.reason,
        });
      } else {
        setEarnState({ kind: 'idle' });
      }
      return;
    }

    // Logged in — submit to server.
    setEarnState({ kind: 'submitting' });
    void submitFinish(finishedGame).then((res) => {
      if ('error' in res) {
        setEarnState({ kind: 'error', message: res.error });
        return;
      }
      setEarnState({
        kind: 'success',
        cents: res.centsEarned,
        reason: res.reason,
      });
      void refresh();
    });
    // Intentionally do NOT re-run when learner changes — that's handled by
    // the PendingClaim flow below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After anon login claim succeeds.
  const handleClaimed = useCallback(
    (cents: number, reason: string) => {
      setEarnState({ kind: 'success', cents, reason });
      void refresh();
    },
    [refresh],
  );

  return (
    <GameOverCardWithBanner
      result={result}
      setup={setup}
      earnState={earnState}
      buildSavedGame={buildSavedGame}
      onPlayAgain={onPlayAgain}
      onClaimed={handleClaimed}
    />
  );
}

function GameOverCardWithBanner({
  result,
  setup,
  earnState,
  buildSavedGame,
  onPlayAgain,
  onClaimed,
}: {
  result: GameOverResult;
  setup: GameSetup;
  earnState: EarnState;
  buildSavedGame: () => SavedChessGame;
  onPlayAgain: () => void;
  onClaimed: (cents: number, reason: string) => void;
}) {
  // Banner is rendered ABOVE the standard GameOverCard buttons via composition:
  // we use a custom wrapper rather than editing GameOverCard (out of scope).
  // Approach: render GameOverCard as-is, then overlay our earn-strip in a
  // sibling sub-modal that sits in the same fixed layer.
  return (
    <>
      <GameOverCard
        result={result}
        whiteName={setup.whiteName}
        blackName={setup.blackName}
        onPlayAgain={onPlayAgain}
      />
      <ChessEarnOverlay
        earnState={earnState}
        result={result}
        setup={setup}
        buildSavedGame={buildSavedGame}
        onClaimed={onClaimed}
      />
    </>
  );
}

// A small overlay anchored to the bottom of the GameOver modal that shows
// the MP-earned banner (or the inline login form for anonymous kids).
function ChessEarnOverlay({
  earnState,
  result,
  setup,
  buildSavedGame,
  onClaimed,
}: {
  earnState: EarnState;
  result: GameOverResult;
  setup: GameSetup;
  buildSavedGame: () => SavedChessGame;
  onClaimed: (cents: number, reason: string) => void;
}) {
  if (setup.mode !== 'ai') return null;
  if (earnState.kind === 'idle') return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-4 pointer-events-none flex justify-center"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-md w-full">
        {earnState.kind === 'submitting' && (
          <div className="rounded-2xl bg-white border-2 border-purple-200 shadow-xl p-4 text-center">
            <div className="text-sm font-bold text-purple-800">Saving game and crediting MP…</div>
          </div>
        )}
        {earnState.kind === 'success' && (
          <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-xl p-4 text-center">
            {earnState.cents > 0 ? (
              <>
                <div className="text-xs uppercase tracking-wide text-emerald-800 font-bold">
                  MP earned
                </div>
                <div className="text-3xl font-black text-emerald-900 my-1">
                  +{centsToMP(earnState.cents)}
                </div>
                <div className="text-xs text-emerald-800">{earnState.reason}</div>
              </>
            ) : (
              <div className="text-sm font-bold text-emerald-900">
                {earnState.reason}
              </div>
            )}
          </div>
        )}
        {earnState.kind === 'error' && (
          <div className="rounded-2xl bg-red-50 border-2 border-red-300 shadow-xl p-4 text-center">
            <div className="text-sm font-bold text-red-800">
              Couldn&apos;t record MP: {earnState.message}
            </div>
          </div>
        )}
        {earnState.kind === 'anon' && (
          <ChessAnonClaim
            previewCents={earnState.previewCents}
            reason={earnState.reason}
            result={result}
            buildSavedGame={buildSavedGame}
            onClaimed={onClaimed}
          />
        )}
      </div>
    </div>
  );
}

// Inline name+PIN form for anonymous kids — pattern mirrors
// components/PendingEarnPrompt.tsx, but POSTs to /api/chess/game/finish
// instead of /api/money/earn after auth.
type AnonStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string };

function ChessAnonClaim({
  previewCents,
  reason,
  result,
  buildSavedGame,
  onClaimed,
}: {
  previewCents: number;
  reason: string;
  result: GameOverResult;
  buildSavedGame: () => SavedChessGame;
  onClaimed: (cents: number, reason: string) => void;
}) {
  const [user, setUser] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<AnonStatus>({ kind: 'idle' });

  const submit = async (action: 'login' | 'register') => {
    if (!user.trim()) {
      setStatus({ kind: 'error', message: 'Enter your name.' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setStatus({ kind: 'error', message: 'PIN must be exactly 4 digits.' });
      return;
    }
    setStatus({ kind: 'busy' });

    // Step 1: log in or register.
    try {
      const trimmedDisplay = displayName.trim();
      const body: Record<string, string> = { user: user.trim(), pin };
      if (action === 'register' && trimmedDisplay) {
        body.displayName = trimmedDisplay;
      }
      const res = await fetch(`/api/drive/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (action === 'login' && res.status === 401) {
          setStatus({ kind: 'error', message: 'Wrong name or PIN.' });
          return;
        }
        if (action === 'register' && res.status === 409) {
          setStatus({
            kind: 'error',
            message: data.error || 'Name taken — try Log in instead.',
          });
          return;
        }
        setStatus({
          kind: 'error',
          message: data.error || 'Something went wrong. Try again.',
        });
        return;
      }
      try {
        localStorage.setItem('dl_user', user.trim().toLowerCase());
      } catch {
        // ignore
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
      return;
    }

    // Step 2: POST finish with the SAME game.id (idempotency).
    const game = buildSavedGame();
    const finishedGame: SavedChessGame = {
      ...game,
      result: {
        winner: winnerToServer(result.winner),
        reason: reasonToServerReason(result.reason),
        finalFen: game.fen,
      },
    };
    const finishRes = await submitFinish(finishedGame);
    if ('error' in finishRes) {
      setStatus({
        kind: 'error',
        message: `Logged in, but MP didn't record: ${finishRes.error}`,
      });
      return;
    }
    onClaimed(finishRes.centsEarned, finishRes.reason);
  };

  const busy = status.kind === 'busy';

  return (
    <div className="rounded-2xl bg-yellow-50 border-2 border-yellow-300 shadow-xl p-4">
      <div className="text-center mb-3">
        <div className="text-xs uppercase tracking-wide text-yellow-800 font-bold">
          You would earn
        </div>
        <div className="text-3xl font-black text-yellow-900 my-1">
          +{centsToMP(previewCents)}
        </div>
        <div className="text-xs text-yellow-800">{reason}</div>
        <div className="text-[11px] text-yellow-800 mt-2">
          Log in or register to keep it.
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit('login');
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            autoComplete="username"
            disabled={busy}
            className="rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2 font-semibold"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •"
            maxLength={4}
            autoComplete="current-password"
            disabled={busy}
            className="rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2 tracking-[0.4em] text-center font-bold"
          />
        </div>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (optional — only when registering)"
          maxLength={30}
          autoComplete="off"
          disabled={busy}
          className="w-full rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2 text-sm"
        />

        {status.kind === 'error' && (
          <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {status.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
          >
            {busy ? '…' : 'Log in & claim'}
          </button>
          <button
            type="button"
            onClick={() => void submit('register')}
            disabled={busy}
            className="bg-yellow-200 hover:bg-yellow-300 disabled:bg-yellow-100 text-purple-900 font-bold py-2.5 rounded-xl border-2 border-yellow-400 transition-colors text-sm"
          >
            {busy ? '…' : "I'm new — register"}
          </button>
        </div>
      </form>
    </div>
  );
}

// POST /api/chess/game/finish wrapper.
async function submitFinish(
  game: SavedChessGame,
): Promise<FinishResponse | { error: string }> {
  if (!game.result) return { error: 'missing result' };
  try {
    const res = await fetch('/api/chess/game/finish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        game,
        result: game.result,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { error: typeof data.error === 'string' ? data.error : `HTTP ${res.status}` };
    }
    return {
      centsEarned: typeof data.centsEarned === 'number' ? data.centsEarned : 0,
      balanceCents: typeof data.balanceCents === 'number' ? data.balanceCents : null,
      reason: typeof data.reason === 'string' ? data.reason : '',
      duplicate: data.duplicate === true,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

