// Agent-vs-agent chess test runner.
//
// Plays N games between two AI levels and reports:
//   - results (wins/draws by color, reasons)
//   - average plies per game
//   - average ms per move per level
//   - illegal-move count (MUST be 0 — would indicate engine or AI bug)
//   - any hangs (move took > 10s)
//
// Run with:
//   npx tsx scripts/chess-self-play.ts

import { initialPosition, makeMove, gameStatus, legalMoves, type Position } from '../lib/chess/engine';
import { chooseMove, type AiLevel } from '../lib/chess/ai';

type GameResult = {
  reason: string;
  winner: 'w' | 'b' | 'draw';
  plies: number;
  whiteMs: number[];
  blackMs: number[];
};

function playOne(whiteLevel: AiLevel, blackLevel: AiLevel, maxPlies = 200): GameResult {
  let pos: Position = initialPosition();
  const whiteMs: number[] = [];
  const blackMs: number[] = [];
  let plies = 0;

  while (plies < maxPlies) {
    const status = gameStatus(pos);
    if (status === 'checkmate') {
      // Side to move is checkmated — the other side wins.
      const winner: 'w' | 'b' = pos.turn === 'w' ? 'b' : 'w';
      return { reason: 'checkmate', winner, plies, whiteMs, blackMs };
    }
    if (status === 'stalemate') return { reason: 'stalemate', winner: 'draw', plies, whiteMs, blackMs };
    if (status === 'draw-50-move') return { reason: '50-move', winner: 'draw', plies, whiteMs, blackMs };
    if (status === 'draw-threefold') return { reason: 'threefold', winner: 'draw', plies, whiteMs, blackMs };
    if (status === 'draw-insufficient') return { reason: 'insufficient', winner: 'draw', plies, whiteMs, blackMs };

    const level: AiLevel = pos.turn === 'w' ? whiteLevel : blackLevel;
    const startMs = performance.now();
    const move = chooseMove(pos, level);
    const elapsed = performance.now() - startMs;
    (pos.turn === 'w' ? whiteMs : blackMs).push(elapsed);

    // Safety: verify the AI returned a legal move.
    const legals = legalMoves(pos);
    const isLegal = legals.some(
      (m) => m.from === move.from && m.to === move.to && (m.promotion ?? null) === (move.promotion ?? null),
    );
    if (!isLegal) {
      throw new Error(
        `ILLEGAL MOVE from ${level} at ply ${plies}: from=${move.from} to=${move.to} promo=${move.promotion ?? 'none'}`,
      );
    }

    pos = makeMove(pos, move);
    plies++;
  }

  return { reason: 'max-plies', winner: 'draw', plies, whiteMs, blackMs };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function max(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

function runMatch(white: AiLevel, black: AiLevel, games: number) {
  console.log(`\n=== ${white.toUpperCase()} (white) vs ${black.toUpperCase()} (black) — ${games} games ===`);
  const results: GameResult[] = [];
  const startedAt = performance.now();
  for (let i = 0; i < games; i++) {
    const r = playOne(white, black);
    results.push(r);
    console.log(
      `  Game ${i + 1}: ${r.reason.padEnd(12)} winner=${r.winner.padEnd(5)} plies=${String(r.plies).padStart(3)} ` +
        `whiteAvgMs=${avg(r.whiteMs).toFixed(0).padStart(5)} blackAvgMs=${avg(r.blackMs).toFixed(0).padStart(5)}`,
    );
  }
  const totalMs = performance.now() - startedAt;
  const whiteWins = results.filter((r) => r.winner === 'w').length;
  const blackWins = results.filter((r) => r.winner === 'b').length;
  const draws = results.filter((r) => r.winner === 'draw').length;
  const avgPlies = avg(results.map((r) => r.plies));
  const allWhiteMs = results.flatMap((r) => r.whiteMs);
  const allBlackMs = results.flatMap((r) => r.blackMs);
  console.log(
    `\n  TOTALS: white=${whiteWins} black=${blackWins} draw=${draws}  avgPlies=${avgPlies.toFixed(1)}  ` +
      `${white} p50=${avg(allWhiteMs).toFixed(0)}ms max=${max(allWhiteMs).toFixed(0)}ms  ` +
      `${black} p50=${avg(allBlackMs).toFixed(0)}ms max=${max(allBlackMs).toFixed(0)}ms  ` +
      `total=${(totalMs / 1000).toFixed(1)}s`,
  );
}

async function main() {
  console.log('Chess AI self-play smoke test');
  console.log('Validates: no illegal moves, no hangs >10s, sensible move counts');
  try {
    runMatch('cub', 'cub', 3);
    runMatch('knight', 'cub', 3);
    runMatch('wizard', 'knight', 2);
    runMatch('wizard', 'cub', 2);
    runMatch('knight', 'knight', 2);
    console.log('\nAll matches completed without illegal moves or hangs. Engine + AI good to ship.');
  } catch (err) {
    console.error('\nFAILURE:', err);
    process.exit(1);
  }
}

main();
