'use client';

// Two-device chess — lobby + polled game view.
//
// This is the "👥 Two devices" mode of /chess/play. Two kids on two devices
// share one ChessMatch row (lib/chess/match + /api/chess/match/*). One creates
// a game and reads the short CODE aloud; the other types it in to join. From
// then on each device:
//   - polls GET /api/chess/match/[code] every ~1800ms,
//   - re-derives the board Position by replaying moveHistory through the SAME
//     pure engine the single-device game uses (mirrors page.tsx's resume loop),
//   - only lets the LOCAL player move when it's their color's turn (same
//     input-disable pattern as "AI is thinking"),
//   - POSTs the move to /api/chess/match/[code]/move, which re-validates with
//     the engine and is the sole arbiter of legality + turn order,
//   - shows the GameOverCard on finish.
//
// No MP is credited for two-device games (see the move route's TODO). We just
// play to completion and announce the result.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
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
import {
  getTheme,
  DEFAULT_THEME_ID,
  type ChessThemeId,
} from '@/data/chess-themes';
import type { GameStatusLite, UiMove } from '@/components/chess/chess-ui-types';
import { useLearner } from '@/context/LearnerContext';

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
} from '@/lib/chess/engine';
import type { ChessGameResult } from '@/lib/chess/game-state';

const POLL_MS = 1800;

// Server's view of the match (GET / move / join responses).
type MatchState = {
  moveHistory: string[];
  turn: Color;
  status: 'waiting' | 'active' | 'finished';
  result: ChessGameResult | null;
  version: number;
  whiteUser: string | null;
  blackUser: string | null;
  fen: string;
  theme: string;
};

// -------------------------------------------------------------------------
// Entry: lobby switch (create / join) → game
// -------------------------------------------------------------------------

type LobbyView =
  | { kind: 'menu' }
  | { kind: 'created'; code: string }   // creator is waiting for opponent
  | { kind: 'joining' }
  | { kind: 'playing'; code: string };

export default function MatchPlay({ onExit }: { onExit: () => void }) {
  const { learner } = useLearner();
  const [view, setView] = useState<LobbyView>({ kind: 'menu' });

  if (!learner) {
    return (
      <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-200 p-6 md:p-8 max-w-md mx-auto text-center">
        <div className="text-5xl mb-3">📱📱</div>
        <h2 className="text-2xl font-black text-purple-900 mb-2">Two devices</h2>
        <p className="text-purple-700 mb-4">
          You need to be logged in to play across two devices.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-5 py-2.5 rounded-xl"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (view.kind === 'playing') {
    return (
      <MatchGame
        code={view.code}
        meKey={learner}
        onExit={onExit}
      />
    );
  }

  return (
    <MatchLobby
      view={view}
      setView={setView}
      onExit={onExit}
    />
  );
}

// -------------------------------------------------------------------------
// Lobby — create or join
// -------------------------------------------------------------------------

function MatchLobby({
  view,
  setView,
  onExit,
}: {
  view: LobbyView;
  setView: (v: LobbyView) => void;
  onExit: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chess/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok || !data.code) {
        setError(data.error || 'Could not start a game');
        return;
      }
      setView({ kind: 'created', code: data.code });
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  }, [setView]);

  const join = useCallback(async (rawCode: string) => {
    const c = rawCode.trim().toUpperCase();
    if (!c) {
      setError('Type the code your friend gave you');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chess/match/${encodeURIComponent(c)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Could not join that game');
        return;
      }
      setView({ kind: 'playing', code: c });
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  }, [setView]);

  // Creator's "waiting for opponent" screen polls until status flips to active.
  useEffect(() => {
    if (view.kind !== 'created') return;
    let cancelled = false;
    const code = view.code;
    const tick = async () => {
      try {
        const res = await fetch(`/api/chess/match/${encodeURIComponent(code)}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as MatchState;
        if (cancelled) return;
        if (data.status === 'active' || data.blackUser) {
          setView({ kind: 'playing', code });
        }
      } catch {
        // ignore — keep polling
      }
    };
    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [view, setView]);

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-200 p-6 md:p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">📱📱</div>
        <h2 className="text-2xl md:text-3xl font-black text-purple-900">
          Play on two devices
        </h2>
        <p className="text-sm text-purple-700 mt-1">
          One of you makes a game and shares the code. The other one types it in.
        </p>
      </div>

      {error && (
        <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {view.kind === 'created' ? (
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-purple-700 font-bold mb-1">
            Share this code
          </div>
          <div className="text-5xl md:text-6xl font-black text-purple-900 tracking-[0.15em] my-3 select-all">
            {view.code}
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-purple-700 mb-5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            Waiting for your friend to join…
          </div>
          <button
            type="button"
            onClick={onExit}
            className="block w-full bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold py-3 rounded-2xl transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="w-full bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-800 hover:to-purple-900 disabled:opacity-60 text-white font-black text-lg py-4 rounded-2xl shadow-md transition-all"
          >
            {busy ? '…' : '✨ Make a new game'}
          </button>

          <div className="flex items-center gap-3 text-purple-400">
            <div className="h-px bg-purple-200 flex-1" />
            <span className="text-xs font-bold">or join one</span>
            <div className="h-px bg-purple-200 flex-1" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void join(code);
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="Enter code"
              maxLength={5}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={busy}
              className="w-full rounded-2xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none bg-purple-50 text-purple-900 px-4 py-4 text-center text-3xl font-black tracking-[0.2em] uppercase"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-60 text-purple-900 font-black text-lg py-3.5 rounded-2xl border-2 border-yellow-400 transition-colors"
            >
              {busy ? '…' : '🙋 Join game'}
            </button>
          </form>

          <button
            type="button"
            onClick={onExit}
            className="block w-full text-purple-700 hover:text-purple-900 font-bold text-sm py-2"
          >
            ← Back to setup
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Game — polled board, local-turn-only input
// -------------------------------------------------------------------------

// Re-derive an engine Position by replaying the UCI move list. Mirrors the
// resume loop in page.tsx (initialState). Returns the final Position and a
// UiMove[] for the move list. Stops at the first move it can't replay (a
// corrupted row) rather than throwing.
function deriveFromMoves(moveHistory: string[]): {
  position: Position;
  uiMoves: UiMove[];
} {
  let pos = initialPosition();
  const uiMoves: UiMove[] = [];
  for (const uci of moveHistory) {
    const from = algIdx(uci.slice(0, 2));
    const to = algIdx(uci.slice(2, 4));
    const promoChar = uci.slice(4, 5);
    const promo = promoChar
      ? (promoChar.toUpperCase() as 'Q' | 'R' | 'B' | 'N')
      : undefined;
    const candidates = legalMoves(pos, from);
    const match = candidates.find(
      (m) => m.to === to && (promo ? m.promotion === promo : !m.promotion),
    );
    if (!match) break;
    pos = makeMove(pos, match);
    uiMoves.push({
      from: match.from,
      to: match.to,
      promotion: match.promotion,
      flag: match.flag,
    });
  }
  return { position: pos, uiMoves };
}

function algIdx(s: string): number {
  const file = s.charCodeAt(0) - 97;
  const rank = 8 - Number(s[1]);
  return rank * 8 + file;
}

function moveToUciLocal(move: Move): string {
  const base = squareToAlgebraic(move.from) + squareToAlgebraic(move.to);
  if (!move.promotion) return base;
  return base + move.promotion.toLowerCase();
}

// Local board interaction reducer — selection + promotion only. The MOVE
// itself is committed by POSTing to the server, not by mutating local state;
// the next poll (or the move response) re-derives the board. We keep the
// selection state local so taps feel instant.
type LocalUi = {
  selectedSquare: number | null;
  pendingPromotion: { from: number; to: number } | null;
};
type UiAction =
  | { type: 'SELECT'; square: number; position: Position }
  | { type: 'CLEAR' }
  | { type: 'PENDING'; from: number; to: number }
  | { type: 'CANCEL_PROMO' };

function uiReducer(state: LocalUi, action: UiAction): LocalUi {
  switch (action.type) {
    case 'SELECT': {
      const { square, position } = action;
      const piece = position.board[square];
      if (state.selectedSquare === null) {
        if (!piece || piece.color !== position.turn) return state;
        return { ...state, selectedSquare: square };
      }
      if (state.selectedSquare === square) {
        return { ...state, selectedSquare: null };
      }
      if (piece && piece.color === position.turn) {
        return { ...state, selectedSquare: square };
      }
      return state;
    }
    case 'CLEAR':
      return { selectedSquare: null, pendingPromotion: null };
    case 'PENDING':
      return { selectedSquare: null, pendingPromotion: { from: action.from, to: action.to } };
    case 'CANCEL_PROMO':
      return { selectedSquare: null, pendingPromotion: null };
  }
}

function MatchGame({
  code,
  meKey,
  onExit,
}: {
  code: string;
  meKey: string;
  onExit: () => void;
}) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [ui, dispatchUi] = useReducer(uiReducer, {
    selectedSquare: null,
    pendingPromotion: null,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number>(-1);

  // Poll the server. Only re-set state when the version actually changed so we
  // don't thrash the board / clear a selection mid-think.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/chess/match/${encodeURIComponent(code)}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as MatchState;
        if (cancelled) return;
        if (data.version !== versionRef.current) {
          versionRef.current = data.version;
          setMatch(data);
          // A move came in from the other device — clear any stale selection.
          dispatchUi({ type: 'CLEAR' });
        } else if (data.status !== match?.status) {
          setMatch(data);
        }
      } catch {
        // ignore — keep polling
      }
    };
    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const myColor: Color | null = useMemo(() => {
    if (!match) return null;
    if (match.whiteUser === meKey) return 'w';
    if (match.blackUser === meKey) return 'b';
    return null;
  }, [match, meKey]);

  const derived = useMemo(
    () => (match ? deriveFromMoves(match.moveHistory) : null),
    [match],
  );
  const position = derived?.position ?? null;

  const finished = match?.status === 'finished' && match.result;
  const myTurn =
    !!match &&
    match.status === 'active' &&
    !finished &&
    myColor !== null &&
    match.turn === myColor;

  // Board is from the local player's perspective (their pieces at the bottom).
  const flipped = myColor === 'b';

  const theme = useMemo(
    () => getTheme((match?.theme as ChessThemeId) || DEFAULT_THEME_ID),
    [match?.theme],
  );

  const legalDestinations = useMemo<number[]>(() => {
    if (!position || ui.selectedSquare === null) return [];
    const moves = legalMoves(position, ui.selectedSquare);
    return Array.from(new Set(moves.map((m) => m.to)));
  }, [position, ui.selectedSquare]);

  const checkSquare = useMemo<number | null>(() => {
    if (!position || finished) return null;
    const color = position.turn;
    if (!isCheck(position, color)) return null;
    for (let i = 0; i < position.board.length; i++) {
      const p = position.board[i];
      if (p && p.color === color && p.type === 'K') return i;
    }
    return null;
  }, [position, finished]);

  const lastMove = derived?.uiMoves.length
    ? derived.uiMoves[derived.uiMoves.length - 1]
    : null;

  // POST a move to the server, then immediately refetch so the mover sees their
  // own move without waiting for the next poll tick.
  const sendMove = useCallback(
    async (uci: string) => {
      setSending(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/chess/match/${encodeURIComponent(code)}/move`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ uci }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as
          | (MatchState & { error?: string })
          | { error?: string };
        if (!res.ok) {
          setError((data as { error?: string }).error || 'Move rejected');
          return;
        }
        const next = data as MatchState;
        versionRef.current = next.version;
        setMatch(next);
        dispatchUi({ type: 'CLEAR' });
      } catch {
        setError('Network error — your move did not send');
      } finally {
        setSending(false);
      }
    },
    [code],
  );

  const handleSquareClick = useCallback(
    (square: number) => {
      if (!position || !myTurn || sending) return;
      // Second tap: is this a legal destination for the selected piece?
      if (ui.selectedSquare !== null && ui.selectedSquare !== square) {
        const candidates = legalMoves(position, ui.selectedSquare);
        const matching = candidates.filter((m) => m.to === square);
        if (matching.length > 0) {
          if (matching.some((m) => m.promotion)) {
            dispatchUi({ type: 'PENDING', from: ui.selectedSquare, to: square });
            return;
          }
          void sendMove(moveToUciLocal(matching[0]));
          return;
        }
      }
      dispatchUi({ type: 'SELECT', square, position });
    },
    [position, myTurn, sending, ui.selectedSquare, sendMove],
  );

  const handlePromotionChoose = useCallback(
    (piece: PromotionChoice) => {
      if (!position || !ui.pendingPromotion) return;
      const candidates = legalMoves(position, ui.pendingPromotion.from);
      const move = candidates.find(
        (m) => m.to === ui.pendingPromotion!.to && m.promotion === piece,
      );
      if (move) void sendMove(moveToUciLocal(move));
      else dispatchUi({ type: 'CANCEL_PROMO' });
    },
    [position, ui.pendingPromotion, sendMove],
  );

  // ---- Render ----

  if (!match || !position) {
    return (
      <div className="text-center text-purple-700 py-12">Loading game…</div>
    );
  }

  const whiteLabel = match.whiteUser ?? 'White';
  const blackLabel = match.blackUser ?? 'Black';
  const waitingForOpponent = match.status === 'waiting' || !match.blackUser;

  const statusLite: GameStatusLite = finished
    ? mapReasonToStatus(match.result!.reason)
    : gameStatus(position);

  const gameOverResult: GameOverResult | null = finished
    ? {
        winner: match.result!.winner,
        reason: serverReasonToUi(match.result!.reason),
      }
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        {/* Code banner — big and kid-friendly so they can read it aloud. */}
        <div className="bg-purple-900 text-white rounded-2xl px-4 py-3 text-center shadow-md">
          <span className="text-sm font-bold opacity-90">Share this code: </span>
          <span className="text-2xl font-black tracking-[0.15em] text-yellow-300 select-all">
            {code}
          </span>
        </div>

        {waitingForOpponent ? (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-4 py-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-yellow-900">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
              Waiting for your opponent to join…
            </div>
          </div>
        ) : (
          <TurnIndicator
            turn={position.turn}
            status={statusLite}
            whiteName={whiteLabel}
            blackName={blackLabel}
          />
        )}

        {/* You-are + turn hint */}
        {myColor && !waitingForOpponent && !finished && (
          <div className="text-center text-sm font-bold text-purple-700 min-h-[20px]">
            You are {myColor === 'w' ? '♔ White' : '♚ Black'} —{' '}
            {myTurn ? 'your move!' : "waiting for the other player…"}
          </div>
        )}

        {error && (
          <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
            {error}
          </div>
        )}

        <div className="pl-0 md:pl-5">
          <Board
            board={position.board}
            legalDestinations={legalDestinations}
            selectedSquare={ui.selectedSquare}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
            checkSquare={checkSquare}
            theme={theme}
            flipped={flipped}
            onSquareClick={handleSquareClick}
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={onExit}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm"
          >
            ⚙️ Leave game
          </button>
          <Link
            href="/chess"
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold px-4 py-2 rounded-2xl transition-colors text-sm flex items-center"
          >
            ← Chess hub
          </Link>
        </div>
      </div>

      <div>
        <MoveList moves={derived?.uiMoves ?? []} />
      </div>

      {ui.pendingPromotion && position && (
        <PromotionPicker
          color={position.turn}
          theme={theme}
          onChoose={handlePromotionChoose}
        />
      )}

      {gameOverResult && (
        <GameOverCard
          result={gameOverResult}
          whiteName={whiteLabel}
          blackName={blackLabel}
          onPlayAgain={onExit}
        />
      )}
    </div>
  );
}

// Map the server's ChessReason union to the UI GameStatusLite / GameOverReason.
function mapReasonToStatus(reason: ChessGameResult['reason']): GameStatusLite {
  switch (reason) {
    case 'checkmate':
    case 'resignation':
      return 'checkmate';
    case 'stalemate':
      return 'stalemate';
    case '50-move':
      return 'draw-50-move';
    case 'threefold':
      return 'draw-threefold';
    case 'insufficient':
      return 'draw-insufficient';
  }
}

function serverReasonToUi(reason: ChessGameResult['reason']): GameOverReason {
  switch (reason) {
    case 'checkmate':
      return 'checkmate';
    case 'stalemate':
      return 'stalemate';
    case 'resignation':
      return 'resignation';
    case '50-move':
      return 'draw-50-move';
    case 'threefold':
      return 'draw-threefold';
    case 'insufficient':
      return 'draw-insufficient';
  }
}
