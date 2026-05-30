'use client';

// Chess play page — two views:
//   1) Config:  player names, mode (2-player; AI disabled until Phase 3),
//               theme, board orientation. Start.
//   2) Playing: Board + MoveList + TurnIndicator + Undo + Resign. Promotion
//               picker pops up on pawn-to-back-rank. GameOverCard on end.
//
// State: useReducer keyed on the engine's Position. All rule decisions go
// through lib/chess/engine.ts. The UI never decides what is legal.

import { useCallback, useMemo, useReducer, useState } from 'react';
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

// Engine import. The engine session is building this file in parallel; we
// import against the contract documented in app/chess/PLAN.md. At runtime
// the page won't function until the engine ships, but TypeScript can still
// verify our usage against the contract.
import {
  initialPosition,
  legalMoves,
  makeMove,
  isCheck,
  gameStatus,
  type Position,
  type Move,
  type Square as EngineSquare,
} from '@/lib/chess/engine';

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
  themeId: ChessThemeId;
  flipped: boolean;       // true = Black at bottom
};

type View =
  | { kind: 'config' }
  | { kind: 'playing'; setup: GameSetup };

function ChessPlayAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const handleStart = useCallback((setup: GameSetup) => {
    setView({ kind: 'playing', setup });
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

        {view.kind === 'config' && <ConfigCard onStart={handleStart} />}
        {view.kind === 'playing' && (
          <PlayView setup={view.setup} onExit={backToConfig} />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// 1) CONFIG
// -------------------------------------------------------------------------

function ConfigCard({ onStart }: { onStart: (setup: GameSetup) => void }) {
  const [whiteName, setWhiteName] = useState('White');
  const [blackName, setBlackName] = useState('Black');
  const [mode, setMode] = useState<GameMode>('local');
  const [themeId, setThemeId] = useState<ChessThemeId>(DEFAULT_THEME_ID);
  const [flipped, setFlipped] = useState(false);

  const handleStart = () => {
    onStart({
      whiteName: whiteName.trim() || 'White',
      blackName: blackName.trim() || 'Black',
      mode,
      themeId,
      flipped,
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
          Two players, one board. AI coming in Phase 3.
        </p>
      </div>

      {/* Player names */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Players
        </legend>
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
      </fieldset>

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
            disabled
            aria-disabled="true"
            className="rounded-xl border-2 px-3 py-3 font-bold text-sm border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed relative"
          >
            🧙 vs AI
            <span className="absolute top-1 right-1 bg-gray-300 text-gray-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Soon
            </span>
          </button>
        </div>
      </fieldset>

      {/* Theme */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-purple-900 mb-2">
          Piece set
        </legend>
        <ThemePicker selectedId={themeId} onSelect={setThemeId} />
      </fieldset>

      {/* Orientation */}
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
  // The engine position is the source of truth — board, turn, castling
  // rights, en-passant target, repetition history all live here.
  position: Position;
  // History of positions for undo. We keep every committed position so
  // popping is just `history.pop()` + `position = top of stack`.
  history: Position[];
  moveHistory: UiMove[];
  selectedSquare: EngineSquare | null;
  // A pawn move that's reached the back rank but still needs a promotion
  // piece chosen. When non-null we render <PromotionPicker>.
  pendingPromotion: { from: EngineSquare; to: EngineSquare } | null;
  // Final result, if the game has ended via the engine or via resignation.
  result: GameOverResult | null;
};

type Action =
  | { type: 'SELECT_SQUARE'; square: EngineSquare }
  | { type: 'CONFIRM_MOVE'; move: Move }
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: 'w' | 'b' }
  | { type: 'CANCEL_PROMOTION' }
  | { type: 'RESET' };

function initialState(): PlayState {
  const pos = initialPosition();
  return {
    position: pos,
    history: [pos],
    moveHistory: [],
    selectedSquare: null,
    pendingPromotion: null,
    result: null,
  };
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

      // 1) Nothing selected yet
      if (state.selectedSquare === null) {
        // Select only if there's a piece of the current player's color.
        if (!piece || piece.color !== state.position.turn) {
          return state;
        }
        return { ...state, selectedSquare: square };
      }

      // 2) Tapped same square twice → deselect
      if (state.selectedSquare === square) {
        return { ...state, selectedSquare: null };
      }

      // 3) Tapped a same-color piece → reselect
      if (piece && piece.color === state.position.turn) {
        return { ...state, selectedSquare: square };
      }

      // 4) Tapped a target → see if it's a legal move from the selection.
      const candidates = legalMoves(state.position, state.selectedSquare);
      const matching = candidates.filter((m) => m.to === square);
      if (matching.length === 0) {
        // Illegal — just deselect.
        return { ...state, selectedSquare: null };
      }

      // 5) Promotion? Multiple matches mean the engine produced one Move per
      //    promotion piece (Q/R/B/N). Defer to the picker.
      const hasPromotion = matching.some((m) => m.promotion !== undefined);
      if (hasPromotion) {
        return {
          ...state,
          pendingPromotion: { from: state.selectedSquare, to: square },
          selectedSquare: null,
        };
      }

      // 6) Single legal move → apply directly.
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

  // Determine end-state.
  const status = gameStatus(newPosition);
  let result: GameOverResult | null = null;
  if (status === 'checkmate') {
    // The side to move is the side that's mated.
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
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const theme = useMemo(() => getTheme(setup.themeId), [setup.themeId]);
  // Allow the player to flip the board mid-game without bouncing to config.
  const [flipped, setFlipped] = useState(setup.flipped);

  // Compute legal destinations for the selected piece.
  const legalDestinations = useMemo<number[]>(() => {
    if (state.selectedSquare === null) return [];
    const moves = legalMoves(state.position, state.selectedSquare);
    // Dedup (promotion produces 4 moves to the same square).
    return Array.from(new Set(moves.map((m) => m.to)));
  }, [state.position, state.selectedSquare]);

  // Find a king square that's in check, for the red-glow square.
  const checkSquare = useMemo<number | null>(() => {
    if (state.result) return null;
    const color = state.position.turn;
    if (!isCheck(state.position, color)) return null;
    // Hunt for the king of that color on the board.
    for (let i = 0; i < state.position.board.length; i++) {
      const piece = state.position.board[i];
      if (piece && piece.color === color && piece.type === 'K') return i;
    }
    return null;
  }, [state.position, state.result]);

  // UI status badge — collapsing the engine's GameStatus into the lite enum
  // the indicator understands.
  const statusLite: GameStatusLite = state.result
    ? mapResultToStatus(state.result.reason)
    : gameStatus(state.position);

  const lastMove = state.moveHistory.length
    ? state.moveHistory[state.moveHistory.length - 1]
    : null;

  const handleSquareClick = (square: number) => {
    dispatch({ type: 'SELECT_SQUARE', square });
  };

  const handlePromotionChoose = (piece: PromotionChoice) => {
    if (!state.pendingPromotion) return;
    // Pick the engine's Move for that promotion piece.
    const candidates = legalMoves(state.position, state.pendingPromotion.from);
    const move = candidates.find(
      (m) =>
        m.to === state.pendingPromotion!.to && m.promotion === piece,
    );
    if (move) dispatch({ type: 'CONFIRM_MOVE', move });
    else dispatch({ type: 'CANCEL_PROMOTION' });
  };

  const handleResign = () => {
    const color = state.position.turn;
    if (
      window.confirm(
        `${color === 'w' ? setup.whiteName : setup.blackName}, resign this game?`,
      )
    ) {
      dispatch({ type: 'RESIGN', color });
    }
  };

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
            disabled={state.history.length <= 1 || state.result !== null}
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
            onClick={() => {
              if (window.confirm('Start a new game? Current progress will be lost.')) {
                dispatch({ type: 'RESET' });
              }
            }}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⟲ New game
          </button>
          <button
            type="button"
            onClick={handleResign}
            disabled={state.result !== null}
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
        <GameOverCard
          result={state.result}
          whiteName={setup.whiteName}
          blackName={setup.blackName}
          onPlayAgain={() => dispatch({ type: 'RESET' })}
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
      // Resignation isn't an engine status; the indicator hides anyway when
      // the GameOver card is up, but we still need to satisfy the type.
      return 'checkmate';
    case 'draw-50-move':
      return 'draw-50-move';
    case 'draw-threefold':
      return 'draw-threefold';
    case 'draw-insufficient':
      return 'draw-insufficient';
  }
}
