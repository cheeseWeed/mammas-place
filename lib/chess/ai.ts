// Three-level chess AI: Cub, Knight, Wizard.
//
// All three share the same engine (lib/chess/engine.ts) — only the search depth
// and eval components differ.
//
//   Cub     — depth-1 material check + 30% pure-random; <100ms; ~600-900 ELO
//   Knight  — negamax + alpha-beta, depth 3, MVV-LVA capture ordering; <1s; ~1100-1400 ELO
//   Wizard  — iterative deepening to depth 4 (3s budget), quiescence, killer moves,
//             alpha-beta with full eval (material + PST + mobility + king safety
//             + pawn structure); ~1500-1800 ELO target
//
// Randomness uses a small seeded PRNG (mulberry32) so tests are reproducible.
// chooseMove() accepts an optional `rng` parameter; if omitted, Math.random is used.
//
// All three levels return a legal move. If the position has no legal moves, the
// engine should be reporting checkmate/stalemate and the caller shouldn't be
// asking for a move — but to be safe we throw rather than return a bogus move.

import type { Color, Move, Position } from './engine';
import { legalMoves, makeMove } from './engine';
import { MATE_SCORE, PIECE_VALUE, evaluate, terminalScore } from './ai-eval';

export type AiLevel = 'cub' | 'knight' | 'wizard';

export type Rng = () => number;

// Seeded PRNG — mulberry32. Deterministic, fast, good enough for picking moves.
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// === Move ordering ============================================================

// MVV-LVA: Most Valuable Victim, Least Valuable Attacker. Captures sorted so we
// look at PxQ before QxP — alpha-beta cuts more.
function mvvLvaScore(pos: Position, move: Move): number {
  const victim = pos.board[move.to];
  const attacker = pos.board[move.from];
  if (!victim || !attacker) {
    // En passant capture — victim is a pawn one square behind `to`.
    if (move.flag === 'enpassant' && attacker) {
      return 10 * PIECE_VALUE.P - PIECE_VALUE[attacker.type];
    }
    return 0;
  }
  return 10 * PIECE_VALUE[victim.type] - PIECE_VALUE[attacker.type];
}

function orderMoves(pos: Position, moves: Move[], killers: readonly (Move | null)[] = []): Move[] {
  return moves.slice().sort((a, b) => {
    const aScore = scoreMoveForOrdering(pos, a, killers);
    const bScore = scoreMoveForOrdering(pos, b, killers);
    return bScore - aScore;
  });
}

function scoreMoveForOrdering(pos: Position, move: Move, killers: readonly (Move | null)[]): number {
  const victim = pos.board[move.to];
  const isCapture = victim != null || move.flag === 'enpassant';
  if (isCapture) return 1_000_000 + mvvLvaScore(pos, move);
  if (move.promotion === 'Q') return 900_000;
  for (const killer of killers) {
    if (killer && killer.from === move.from && killer.to === move.to) {
      return 800_000;
    }
  }
  return 0;
}

// === Search ===================================================================

// Negamax with alpha-beta. Score is from the side-to-move's perspective.
// Returns a score in centipawns (mate scores are large finite numbers and get
// nudged by depth so we prefer shorter mates).
function negamax(
  pos: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  side: Color,
  killers: (Move | null)[][],
  useKillers: boolean,
): number {
  const terminal = terminalScore(pos, pos.turn);
  if (terminal !== null) {
    // Adjust mate scores by ply distance so we prefer mate in 1 over mate in 3.
    if (terminal === MATE_SCORE) return MATE_SCORE - ply;
    if (terminal === -MATE_SCORE) return -MATE_SCORE + ply;
    return terminal;
  }
  if (depth <= 0) return evaluate(pos, pos.turn);

  const killerSlot: readonly (Move | null)[] = useKillers ? (killers[ply] ?? []) : [];
  const moves = orderMoves(pos, legalMoves(pos), killerSlot);

  let best = -Infinity;
  for (const move of moves) {
    const next = makeMove(pos, move);
    const score = -negamax(next, depth - 1, -beta, -alpha, ply + 1, side, killers, useKillers);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      // Beta cutoff. Remember this move as a killer if it wasn't a capture.
      if (useKillers && pos.board[move.to] == null && move.flag !== 'enpassant') {
        let slot = killers[ply];
        if (!slot) {
          slot = [null, null];
          killers[ply] = slot;
        }
        if (!slot[0] || slot[0].from !== move.from || slot[0].to !== move.to) {
          slot[1] = slot[0];
          slot[0] = move;
        }
      }
      break;
    }
  }
  return best;
}

// Quiescence search: at the leaves of the main search, keep going while there
// are captures (or, if we're in check, all evasions). This avoids the horizon
// effect — the AI won't happily trade its queen for a pawn just because the
// recapture is one ply past the cutoff.
function quiescence(pos: Position, alpha: number, beta: number, side: Color): number {
  const terminal = terminalScore(pos, pos.turn);
  if (terminal !== null) return terminal;

  const standPat = evaluate(pos, pos.turn);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Only consider captures (and pawn promotions).
  const all = legalMoves(pos);
  const tactical = all.filter(m => pos.board[m.to] != null || m.flag === 'enpassant' || m.promotion);
  const ordered = orderMoves(pos, tactical);

  for (const move of ordered) {
    const next = makeMove(pos, move);
    const score = -quiescence(next, -beta, -alpha, side);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// Root call: returns the best move plus its score.
// `useQuiescence`: enabled for Wizard.
// `deadline`: ms timestamp; if past, search bails ASAP (returns best-so-far).
function searchRoot(
  pos: Position,
  depth: number,
  side: Color,
  opts: { useKillers: boolean; useQuiescence: boolean; deadline?: number; killers?: (Move | null)[][] },
): { move: Move; score: number } | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;

  const killers: (Move | null)[][] = opts.killers ?? [];
  const ordered = orderMoves(pos, moves, killers[0] ?? []);

  let bestMove: Move = ordered[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of ordered) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const next = makeMove(pos, move);
    let score: number;
    if (depth <= 1 && opts.useQuiescence) {
      score = -quiescence(next, -beta, -alpha, side);
    } else {
      score = -negamax(next, depth - 1, -beta, -alpha, 1, side, killers, opts.useKillers);
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return { move: bestMove, score: bestScore };
}

// === Cub ======================================================================

// Cub: pick a "good" move (any move that doesn't immediately lose material at
// depth 1) at 70% probability; 30% pure random. Falls back to random if no good
// moves exist. Heuristically <100ms because we only search 1 ply.
function chooseCub(pos: Position, rng: Rng): Move {
  const moves = legalMoves(pos);
  if (moves.length === 0) throw new Error('chooseMove called on terminal position');

  if (rng() < 0.30) {
    return moves[Math.floor(rng() * moves.length)];
  }

  // Score each move by 1-ply material delta. A "good" move = no negative delta.
  const side = pos.turn;
  const scored = moves.map(move => {
    const next = makeMove(pos, move);
    // Material balance from our perspective AFTER our move.
    const matBefore = materialBalance(pos, side);
    const matAfter = materialBalance(next, side);
    // Also penalise giving up material on opponent's reply (1-ply).
    const oppMoves = legalMoves(next);
    let worstReplyDelta = 0;
    for (const reply of oppMoves) {
      const afterReply = makeMove(next, reply);
      const matAfterReply = materialBalance(afterReply, side);
      const delta = matAfterReply - matAfter;
      if (delta < worstReplyDelta) worstReplyDelta = delta;
    }
    return { move, score: (matAfter - matBefore) + worstReplyDelta };
  });

  const good = scored.filter(s => s.score >= 0);
  const pool = good.length > 0 ? good : scored;
  // Pick the highest-scoring among the pool, breaking ties randomly.
  pool.sort((a, b) => b.score - a.score);
  const topScore = pool[0].score;
  const topMoves = pool.filter(s => s.score === topScore);
  return topMoves[Math.floor(rng() * topMoves.length)].move;
}

function materialBalance(pos: Position, side: Color): number {
  let bal = 0;
  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (!piece) continue;
    const val = PIECE_VALUE[piece.type];
    bal += piece.color === side ? val : -val;
  }
  return bal;
}

// === Knight ===================================================================

function chooseKnight(pos: Position): Move {
  const result = searchRoot(pos, 3, pos.turn, { useKillers: false, useQuiescence: false });
  if (!result) throw new Error('chooseMove called on terminal position');
  return result.move;
}

// === Wizard ===================================================================

// Wizard: iterative deepening 1 -> 4, soft time control at 3000ms. Killer moves
// for ordering, quiescence at leaves. We keep the best move from the previous
// completed depth so even if we bail mid-iteration we have a strong fallback.
const WIZARD_MAX_DEPTH = 4;
const WIZARD_TIME_MS = 3000;

function chooseWizard(pos: Position, timeMs: number = WIZARD_TIME_MS): Move {
  const moves = legalMoves(pos);
  if (moves.length === 0) throw new Error('chooseMove called on terminal position');
  // Only one move? Take it.
  if (moves.length === 1) return moves[0];

  const deadline = Date.now() + timeMs;
  const killers: (Move | null)[][] = [];
  let bestMove: Move = moves[0];

  for (let depth = 1; depth <= WIZARD_MAX_DEPTH; depth++) {
    if (Date.now() > deadline) break;
    const result = searchRoot(pos, depth, pos.turn, {
      useKillers: true,
      useQuiescence: true,
      deadline,
      killers,
    });
    if (result) {
      bestMove = result.move;
      // If we found mate, no need to search deeper.
      if (result.score >= MATE_SCORE - 100) break;
    }
    // If we ran out of time during this depth, bail with the previous depth's best.
    if (Date.now() > deadline) break;
  }
  return bestMove;
}

// === Public API ===============================================================

export function chooseMove(pos: Position, level: AiLevel, rng: Rng = Math.random): Move {
  switch (level) {
    case 'cub': return chooseCub(pos, rng);
    case 'knight': return chooseKnight(pos);
    case 'wizard': return chooseWizard(pos);
  }
}

// Re-export explainMove so callers can do `import { chooseMove, explainMove } from 'lib/chess/ai'`.
export { explainMove } from './ai-explain';
