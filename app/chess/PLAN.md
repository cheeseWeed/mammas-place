# Chess — Architecture Spec

A real chess game for `/chess` in mammas-place. Not a port of the 2010s code — a fresh build that respects the player. Same architectural discipline as `/geography`, `/money`, `/math`.

The old code at `misc/old-chess-import/Chess/` is reference only. Read it for nostalgia; don't import any of it. The piece PNGs are 2010-vintage and out of scope to reuse. New art ships with v1.

---

## Vision

The kid hits `/chess` and the first thing they see is a board that **looks like a real chess set you'd actually want to play on**, not a JavaScript demo. Pieces are sharp, the board has subtle grain, moves animate. They tap a piece and the legal squares glow. They tap one and the piece slides — it doesn't teleport. They put the AI in check and the warning happens with the right weight, not a bare DOM update.

They earn MP for wins. They learn from losses (the AI explains its move on Easy mode). They can play a sibling. They can save and come back tomorrow. They can play a Christmas-themed set in December because it's fun.

This is the bar. Less than this and we're shipping the same thing the old code was — a JS exercise dressed up.

---

## Architecture (locked)

### 1. Pure engine, dumb UI

`lib/chess/engine.ts` is pure functions over an immutable `Position`. No DOM, no fetch, no localStorage, no React. Every move generation, check detection, and game-state transition is a function call that returns a new `Position`. Tested in isolation with vitest.

The UI is a thin layer that:
- Renders the current `Position`
- Asks the engine "what are the legal moves from this square?"
- Calls `makeMove()` and re-renders

If we ever swap the renderer (canvas, SVG, 3D), the engine doesn't move.

### 2. Position representation = FEN-equivalent

```
Position = {
  board: (Piece | null)[64]      // index 0 = a8, 63 = h1 (standard top-left origin)
  turn: 'w' | 'b'
  castling: { wK, wQ, bK, bQ }   // four bools
  enPassantTarget: 0..63 | null  // the square *behind* a pawn that just two-stepped
  halfmoveClock: number          // 50-move-rule counter
  fullmoveNumber: number
  positionHistory: string[]      // hashes for threefold repetition detection
}

Piece = { color: 'w'|'b', type: 'K'|'Q'|'R'|'B'|'N'|'P' }

Move = {
  from: 0..63
  to: 0..63
  promotion?: 'Q'|'R'|'B'|'N'
  flag?: 'enpassant' | 'castle-k' | 'castle-q' | 'double-pawn'
}
```

FEN import/export is two functions. PGN export is a Phase 5 nice-to-have.

### 3. Move generation respects check

The old code's biggest miss. We generate moves in two passes:
1. **Pseudo-legal moves** — what the piece *can* do per its movement rules
2. **Filter by king safety** — for each pseudo-legal move, simulate it and reject if our king is in check after

This makes pin detection, check evasion, and "you can't castle through check" all *free* — they fall out of the filter, no special cases.

### 4. All special rules covered

| Rule | Where it lives |
|---|---|
| Castling (both sides, all 4 conditions: pieces unmoved, no blockers, king not in check now, king's path not attacked) | `engine.ts` move generator + king-safety filter |
| En passant (capture window opens for one move only) | `engine.ts` — tracked in `enPassantTarget`, cleared every turn |
| Pawn promotion (with under-promotion choice) | `engine.ts` produces a `Move` with `promotion` field; UI shows `PromotionPicker` modal |
| Threefold repetition | Position hash stack in `positionHistory` |
| 50-move rule | `halfmoveClock` |
| Insufficient material | K vs K, K+N vs K, K+B vs K, K+B vs K+B (same color) |
| Stalemate | No legal moves + not in check |
| Checkmate | No legal moves + in check |

### 5. AI is a separate file, three flavors

`lib/chess/ai.ts` exports `chooseMove(position, level): Move`. Three levels:

| Level | Search | Eval | Speed | Use case |
|---|---|---|---|---|
| **Cub** | depth 1 + 30% random legal move | material only | <100ms | First-time players, 7-year-olds |
| **Knight** | depth 3 alpha-beta | material + piece-square tables | <1s | Casual play |
| **Wizard** | depth 4-5 iterative deepening + quiescence + killer moves | material + PST + mobility + king safety + pawn structure | 2-4s | Will actually challenge an adult casually |

Named **Cub / Knight / Wizard** instead of Easy/Medium/Hard because the kids will pick the name they identify with, not the one that admits they're new.

The engine is the same for all three — only the search depth + eval weights change. Hand-rolled, no Stockfish.

### 6. Themes are data, not code

`data/chess-themes.ts` registers each theme:

```ts
{
  id: 'classic',
  label: 'Classic',
  pieceUrl: (color, type) => `/chess/classic/${color}${type}.svg`,
  boardStyle: { light: '#f0d9b5', dark: '#b58863' },
  unlock?: 'always' | { season: 'december' } | { mpEarned: 100 },
}
```

**Themes shipping in v1 (2, not 4):**

| Theme | Style | Unlock | Asset format |
|---|---|---|---|
| **Classic** | Cburnett SVG set, instantly recognizable | Always | SVG (BSD-3 licensed, attribution in `/chess` footer) |
| **Storybook** | hand-drawn cartoon, kid-friendly | Always | SVG (built fresh in-repo) |

**Themes queued for Phase 2.5 (post-v1 reveal):**

| Theme | Style | Trigger |
|---|---|---|
| Royal | medieval ornate | Random "new theme!" callout 2 weeks after v1 ships |
| Holiday | Christmas — Santa kings, gingerbread pawns | December auto-unlock; "what's new" reveal |

Reason: 4 themes × 12 pieces × quality bar = 48 SVGs to polish. Better to ship 2 well-done than 4 mediocre. Holiday especially deserves to be a reveal moment, not a launch-day toggle.

**Why SVG, not PNG:** scales infinitely, smaller payload, themable via CSS. **Critical: contrast.** Old approach was one silhouette + light/dark shading — contrast can fail on a checkered board (black pieces vanish on dark squares). The fix is *fill + opposite-color stroke*: white pieces = white fill + black outline, black pieces = black fill + white outline. Outline guarantees the piece reads against any square color. Lichess's CC0 Cburnett set already does this and is the gold standard.

**Generating the SVGs:** Phase 2 task. Either (a) draw them ourselves with Claude help — chess pieces are simple silhouettes that can be defined as a handful of paths, or (b) license a free SVG set (Lichess uses the Cburnett set which is **quad-licensed: GFDL / CC BY-SA 3.0 / BSD-3 / GPL v2+** — ship under BSD-3 with attribution in NOTICE or `/chess` footer). My recommendation: **use Cburnett under BSD-3** for Classic (battle-tested, instantly recognizable), then draw Storybook ourselves for v1. Royal + Holiday queued for a Phase 2.5 drop — Holiday especially benefits from being a December surprise reveal rather than launch-day clutter.

### 7. MP rewards via `/api/money/earn`

Add `chess` to the `EarnSection` union in the other session's `lib/money/earn.ts` (or extend their endpoint to add a new section). Reward formula:

```
cents = 150 × resultMult × difficultyMult × efficiencyMult
```

| Factor | Range | Notes |
|---|---|---|
| `resultMult` | win=1.0, draw=**0.25**, loss=0 | Spec-advisor recalibration: 0.4 was too high, incentivized stalling for threefold against Cub. 0.25 still rewards a meaningful Wizard draw (0.25 × 1.8 = 45% of baseline). |
| `difficultyMult` | vs-human=0.5 (per side), Cub=0.8, Knight=1.2, Wizard=1.8 | Sibling games pay less than AI games |
| `efficiencyMult` | 1.0 → 1.4 | Bonus for winning in ≤25 moves, no penalty for slow wins |

**2-player anti-grind guardrails (server-enforced):**
- Minimum 15 plies (≈8 full moves) — shorter games earn 0 MP (kills "scholar's mate on purpose 10 times" exploit)
- Same-pair limit: 2-player game between same two learners only credits MP once per 24h
- Per-kid 2-player MP daily cap: ~50¢ (after that, replays earn 0; forces AI play for the rest of the day's earning)

Quantized to 25¢. Counts toward the shared 5 MP/day cap. **Coordinate with the other session before adding** — `lib/money/earn.ts` is theirs. Either we add a function and ask them to merge it, or they own the chess reward formula too and we just send the right payload.

### 8. State, save, resume

```
Game = {
  id: string                  // cuid
  position: Position
  mode: 'local' | 'ai'
  ai?: { level: 'cub'|'knight'|'wizard', playerColor: 'w'|'b' }
  players: { white: string, black: string }
  startedAt: number
  result?: { winner: 'w'|'b'|'draw', reason: 'checkmate'|'stalemate'|'resignation'|'50-move'|'threefold'|'insufficient' }
  moveHistory: Move[]
  theme: string
}
```

Stored in `DriveUser.chess` JSONB column (added in Phase 4) as a single in-progress game. Anonymous players get a sessionStorage fallback. Logged-in players get cross-device resume.

---

## Phase ladder

| Phase | Status | What ships |
|---|---|---|
| **1 — Engine + 2-player** | ✅ Shipped | Pure engine with all rules. Board UI. Click-to-move with legal-square highlights. Move list. Undo. Promotion picker. Game-over screen. Themed checkmate/stalemate/draw banners. Player names. **No AI yet.** |
| **2 — Themes + polish** | ✅ Shipped | Classic + Storybook + Royal + Holiday SVG sets. Theme picker on the start screen. Subtle move animation (CSS transform on the piece). Capture spark. Quiet move sound. |
| **3 — AI: Cub / Knight / Wizard** | 🟡 In progress (wire-in agent running 2026-05-30) | All three difficulty levels. AI move indicator ("Wizard is thinking…"). On Cub, optional "Why?" button that shows the AI's reasoning in plain English ("I went here because it attacks your knight"). |
| **4 — Save + Resume + MP earn** | 🟡 In progress (wire-in agent running 2026-05-30) | `chess` JSONB column. `/api/chess/game` route. Save & quit button. Resume on return. POST `/api/money/earn` on win/draw. |
| 5 | Future | Move sounds (per-piece + capture + check + checkmate jingle), PGN export, board-flip button, FEN import |
| 6 | Future | Opening book — first 6 plies of 8 common openings so AI doesn't blunder its opening |
| 7 | Future | Puzzle mode — daily "mate in 1/2/3" tactics, earns MP, spaced repetition |
| 8 | Future (only if asked) | Online play — code-based room (Lilly's game) for sibling-vs-sibling on different devices. Requires real-time channel (Pusher / Vercel KV pub-sub). |

---

## File layout (locked)

```
app/chess/
  PLAN.md                          # this file
  page.tsx                         # hub — quick start tiles, resume slot, theme preview
  play/page.tsx                    # the game itself

components/chess/
  Board.tsx                        # 8×8 grid (CSS grid, not <table>)
  Square.tsx                       # one cell — handles selected/legal/lastMove/check states
  PieceSprite.tsx                  # theme-aware piece renderer with CSS-transform animation
  MoveList.tsx                     # algebraic notation, scroll-locked to latest
  PromotionPicker.tsx              # 4-piece modal on pawn-to-back-rank
  GameOverCard.tsx                 # win/loss/draw with reason + "Why I lost" link (Phase 3)
  TurnIndicator.tsx                # whose turn, check warning, AI-thinking spinner
  ThemePicker.tsx                  # SVG previews of each theme
  AiExplainCard.tsx                # Cub-mode "here's why I moved here" (Phase 3)

lib/chess/
  engine.ts                        # pure: legalMoves, makeMove, isCheck, gameStatus
  fen.ts                           # parseFEN, toFEN
  san.ts                           # moveToSAN, sanToMove, for move list display
  ai.ts                            # chooseMove(pos, level)
  ai-eval.ts                       # piece-square tables + evaluation function
  ai-explain.ts                    # (Phase 3) translate AI's chosen move into plain English
  zobrist.ts                       # position hashing for repetition detection
  __tests__/
    engine.test.ts                 # legal moves, special rules
    perft.test.ts                  # perft positions — the standard chess engine correctness test

data/
  chess-themes.ts                  # theme registry
  chess-openings.ts                # Phase 6 — opening book

public/chess/
  classic/{wK,wQ,wR,wB,wN,wP,bK,bQ,bR,bB,bN,bP}.svg
  storybook/...
  royal/...
  holiday/...

app/api/chess/
  game/route.ts                    # GET/PUT — save/resume per learner
```

---

## What "shipping a phase" means

- Each phase is its own commit + push + verify in production.
- Engine has perft tests passing before Phase 1 ships. Perft is the standard correctness check: from the starting position, count all legal move sequences to depth N. The numbers are well-known (depth 1 = 20, depth 2 = 400, depth 3 = 8902, depth 4 = 197281, depth 5 = 4865609). If our engine matches the published numbers exactly, we know move generation + special rules + king safety are right. **Non-negotiable for Phase 1.**
- Type check + production build pass before commit.
- Smoke test in browser (real or Playwright) before "done."

---

## Rules to keep (non-negotiable architecture)

1. **Engine has zero side effects.** Pure functions in, new Position out. If you find yourself reaching for `useState` in `engine.ts`, you're in the wrong file.
2. **UI never decides legality.** Click handlers ask the engine. The engine is the only arbiter.
3. **AI uses the same engine.** AI evaluation walks positions through `makeMove()` — there's no shadow representation of the board.
4. **Themes are config.** Adding the 5th theme = one entry + 12 SVGs. No component edits.
5. **MP credit goes through `/api/money/earn`.** No `/api/money/credit` shortcut.
6. **No piece images as `<img>` with raw absolute URLs.** Always `<PieceSprite color={...} type={...} theme={...} />` so a theme swap is one prop change.
7. **Move history is the source of truth for past state.** Undo = pop history + replay from start. Don't keep a parallel undo stack.
8. **Position hashing for repetition uses Zobrist hashing**, not a string serialization. Faster and the right primitive if we ever want a transposition table for the AI.

---

## Decisions (my picks, override if you disagree)

1. **Engine: hand-roll, no `chess.js` dep.** Writing it is part of the value, and we get to tune the eval for the AI personalities. ~600 LOC well-written.
2. **AI search:** Wizard targets 2-4 sec/move at depth 4-5. Cub <100ms. Knight <1s.
3. **Difficulty names:** **Cub / Knight / Wizard.** Kids pick the name that sounds like them; nobody self-identifies as "Easy."
4. **Character sets:** ditch all 4 old PNG sets. Ship **Classic + Storybook + Royal + Holiday** as fresh SVGs. Classic uses Lichess's CC0 Cburnett set (battle-tested, instantly recognizable to anyone who's played online); other three we draw with Claude.
5. **Resume policy:** one saved game per learner. Starting a new one warns "Lose your current game?" before clobbering. Won't accidentally lose progress.
6. **MP for draws:** 40% of a win. A draw against Wizard is a real achievement.
7. **2-player MP:** winner earns at 50% of the AI-equivalent rate. Loser gets 0. So sibling-vs-sibling isn't the optimal grinding strategy.
8. **Mobile:** tap-tap-to-move (same as Math/Geography). Big enough tap targets that small fingers don't misclick. No drag-and-drop — too fiddly on phones.
9. **Holiday theme** auto-suggests in December but is always toggleable. Kid in May wants Santa pawns? Sure.

---

## What I'm explicitly NOT building (v1 and probably ever)

- Time controls / chess clock — no pressure
- 3D pieces — fad, doesn't help learning
- Stockfish or any WASM engine dep — overkill, +1MB
- Drag-and-drop — fiddly on touch; tap-tap is clear
- Online multiplayer in v1 — Phase 8 only if the kids ask
- ELO ratings — wrong incentive for kids
- Account-required gameplay — anonymous play works, login unlocks save+earn

---

## Cross-references

- `app/math/PLAN.md`, `app/geography/PLAN.md`, `app/money/PLAN.md` — the architectural pattern this mirrors
- `app/api/money/earn/route.ts` + `lib/money/earn.ts` — the earn integration point (other session owns this; Phase 4 coordinates)
- `context/LearnerContext.tsx` — auth
- `prisma/schema.prisma` — Phase 4 adds `chess Json @default("{}")`
- `misc/old-chess-import/Chess/` — old code for reference only; do not port
- https://lichess.org/source — Cburnett SVG set (CC0) for Classic theme
- https://www.chessprogramming.org/Perft — perft numbers for engine correctness tests
