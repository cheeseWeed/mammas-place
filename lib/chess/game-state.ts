// Chess save/resume state — the JSON blob stored in DriveUser.chess.
//
// One in-progress game at a time (`current`) + a rolling 10-game history
// (`recentGames`) + lifetime totals. The shape round-trips cleanly through
// JSON.stringify so we can store it in a JSONB column without any custom
// (de)serialization.
//
// `applyMoveUci` and `finishGame` are pure: they take the current saved
// game and return a new saved game. The engine in lib/chess/engine.ts is
// the only arbiter of legality; this file just delegates and re-derives
// the FEN.

import {
  algebraicToSquare,
  squareToAlgebraic,
  legalMoves,
  makeMove,
  type Move,
  type Position,
  type Square,
} from './engine';
import { parseFEN, toFEN } from './fen';

export const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type ChessMode = 'local' | 'ai';
export type AiLevel = 'cub' | 'knight' | 'wizard';
export type AiColor = 'w' | 'b';

export type ChessWinner = 'w' | 'b' | 'draw';
export type ChessReason =
  | 'checkmate'
  | 'stalemate'
  | '50-move'
  | 'threefold'
  | 'insufficient'
  | 'resignation';

export type ChessGameResult = {
  winner: ChessWinner;
  reason: ChessReason;
  finalFen: string;
};

export type SavedChessGame = {
  id: string;
  startedAt: number;
  updatedAt: number;
  mode: ChessMode;
  aiLevel?: AiLevel;
  aiColor?: AiColor;
  players: { white: string; black: string };
  fen: string;
  moveHistory: string[]; // UCI: "e2e4", "e7e8q"
  theme: string;
  result?: ChessGameResult;
};

export type ChessTotalWins = {
  vsHuman: number;
  vsCub: number;
  vsKnight: number;
  vsWizard: number;
};

export type ChessProgress = {
  current?: SavedChessGame;
  recentGames: SavedChessGame[];
  totalGames: number;
  totalWins: ChessTotalWins;
  totalEarnedCents: number;
};

// ---------- Progress helpers ----------

export function emptyProgress(): ChessProgress {
  return {
    recentGames: [],
    totalGames: 0,
    totalWins: { vsHuman: 0, vsCub: 0, vsKnight: 0, vsWizard: 0 },
    totalEarnedCents: 0,
  };
}

// Defensive deserializer: tolerate missing fields on a freshly-added JSONB
// column (legacy `{}` rows).
export function normalizeProgress(raw: unknown): ChessProgress {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const obj = raw as Record<string, unknown>;
  const totalWinsRaw = (obj.totalWins ?? {}) as Record<string, unknown>;
  const recentGames = Array.isArray(obj.recentGames)
    ? (obj.recentGames as SavedChessGame[])
    : [];
  return {
    current: (obj.current as SavedChessGame | undefined) ?? undefined,
    recentGames,
    totalGames: typeof obj.totalGames === 'number' ? obj.totalGames : 0,
    totalWins: {
      vsHuman: typeof totalWinsRaw.vsHuman === 'number' ? totalWinsRaw.vsHuman : 0,
      vsCub: typeof totalWinsRaw.vsCub === 'number' ? totalWinsRaw.vsCub : 0,
      vsKnight: typeof totalWinsRaw.vsKnight === 'number' ? totalWinsRaw.vsKnight : 0,
      vsWizard: typeof totalWinsRaw.vsWizard === 'number' ? totalWinsRaw.vsWizard : 0,
    },
    totalEarnedCents: typeof obj.totalEarnedCents === 'number' ? obj.totalEarnedCents : 0,
  };
}

// ---------- ID generator (works in browser + Node) ----------

function newGameId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- New game ----------

export type NewGameInput = {
  mode: ChessMode;
  aiLevel?: AiLevel;
  aiColor?: AiColor;
  players: { white: string; black: string };
  theme: string;
};

export function newGame(input: NewGameInput): SavedChessGame {
  if (input.mode === 'ai' && !input.aiLevel) {
    throw new Error('AI game requires aiLevel');
  }
  if (input.mode === 'ai' && !input.aiColor) {
    throw new Error('AI game requires aiColor');
  }
  const now = Date.now();
  return {
    id: newGameId(),
    startedAt: now,
    updatedAt: now,
    mode: input.mode,
    aiLevel: input.aiLevel,
    aiColor: input.aiColor,
    players: { ...input.players },
    fen: STARTING_FEN,
    moveHistory: [],
    theme: input.theme,
  };
}

// ---------- UCI move parsing ----------

// UCI: "<from-sq><to-sq>[promo]" — promo is one of q/r/b/n.
// E.g. "e2e4", "e7e8q", "g1f3".
const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function parseUci(
  uci: string,
): { from: Square; to: Square; promotion?: 'Q' | 'R' | 'B' | 'N' } {
  const m = UCI_RE.exec(uci);
  if (!m) throw new Error(`Invalid UCI move: ${uci}`);
  const from = algebraicToSquare(m[1]);
  const to = algebraicToSquare(m[2]);
  const promo = m[3];
  if (!promo) return { from, to };
  const promotion = promo.toUpperCase() as 'Q' | 'R' | 'B' | 'N';
  return { from, to, promotion };
}

export function moveToUci(move: Move): string {
  const base = squareToAlgebraic(move.from) + squareToAlgebraic(move.to);
  if (!move.promotion) return base;
  return base + move.promotion.toLowerCase();
}

// ---------- Apply move ----------

// Replay the position from the saved FEN + a UCI move and produce a fresh
// SavedChessGame. Engine validates legality. If the game is already over
// (has `result`), we throw.
export function applyMoveUci(game: SavedChessGame, uci: string): SavedChessGame {
  if (game.result) {
    throw new Error('Game already finished — no more moves');
  }
  const pos: Position = parseFEN(game.fen);
  const parsed = parseUci(uci);

  // Find the matching legal move from the engine (so promotion gets set
  // correctly, en-passant flag attached, etc.).
  const candidates = legalMoves(pos, parsed.from);
  const matched = candidates.find((mv) =>
    mv.from === parsed.from &&
    mv.to === parsed.to &&
    (parsed.promotion ? mv.promotion === parsed.promotion : !mv.promotion),
  );
  if (!matched) {
    throw new Error(`Illegal UCI move for current position: ${uci}`);
  }

  const next = makeMove(pos, matched);
  return {
    ...game,
    fen: toFEN(next),
    moveHistory: [...game.moveHistory, uci],
    updatedAt: Date.now(),
  };
}

// ---------- Finish ----------

export function finishGame(
  game: SavedChessGame,
  result: ChessGameResult,
): SavedChessGame {
  if (game.result) {
    // Idempotent: if a result is already set, leave the game alone.
    return game;
  }
  return {
    ...game,
    result,
    updatedAt: Date.now(),
  };
}

// ---------- Progress mutation helpers ----------

const RECENT_GAMES_CAP = 10;

// Map a finished game to the win-counter slot it belongs in (only credits
// when the *player* won — for local games we treat any non-draw as a human
// win since both sides are human; for AI games only count if AI lost).
function bumpWinCounter(
  totals: ChessTotalWins,
  game: SavedChessGame,
): ChessTotalWins {
  if (!game.result || game.result.winner === 'draw') return totals;
  const winnerColor = game.result.winner;
  if (game.mode === 'local') {
    // Sibling vs sibling: someone won. Count once.
    return { ...totals, vsHuman: totals.vsHuman + 1 };
  }
  // AI mode: a "win" for progress purposes means the HUMAN won — i.e. the
  // winning color is not the AI's color.
  const humanWon = winnerColor !== game.aiColor;
  if (!humanWon) return totals;
  switch (game.aiLevel) {
    case 'cub': return { ...totals, vsCub: totals.vsCub + 1 };
    case 'knight': return { ...totals, vsKnight: totals.vsKnight + 1 };
    case 'wizard': return { ...totals, vsWizard: totals.vsWizard + 1 };
    default: return totals;
  }
}

// Move `game` from `current` into `recentGames`, capping at 10. Also bumps
// totalGames and totalWins. Does NOT touch totalEarnedCents — caller does
// that after computing the reward (so totals reflect what was actually
// credited, including the server's quantization/cap).
export function commitFinishedGame(
  progress: ChessProgress,
  game: SavedChessGame,
): ChessProgress {
  if (!game.result) {
    throw new Error('commitFinishedGame requires a finished game (no result set)');
  }
  // Idempotency: if this game.id is already in recentGames with a result,
  // don't double-count.
  if (progress.recentGames.some((g) => g.id === game.id)) {
    // Still clear `current` if it points at this finished game.
    if (progress.current?.id === game.id) {
      return { ...progress, current: undefined };
    }
    return progress;
  }

  const recentGames = [game, ...progress.recentGames].slice(0, RECENT_GAMES_CAP);
  return {
    ...progress,
    current: progress.current?.id === game.id ? undefined : progress.current,
    recentGames,
    totalGames: progress.totalGames + 1,
    totalWins: bumpWinCounter(progress.totalWins, game),
  };
}
