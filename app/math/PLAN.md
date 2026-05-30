# Math Arena — Phased Plan

Math practice for the mammasplace kids. Same discipline as `app/geography/PLAN.md` and `app/spelling/`: shared learner profile (name+PIN), MP rewards routed through the central `/api/money/earn` endpoint, server-decided cents (kids can't self-credit), idempotency-keyed.

## Architecture principles (locked in from day one)

1. **Pure engine, dumb UI.** Problem generation lives in `lib/math/engine.ts`. The practice page composes config → round → results; no problem math leaks into components.
2. **Server is the source of truth on MP.** The practice page tells `/api/money/earn` *what happened* (correct, total, difficulty, speed, streak). The server decides cents via `lib/money/earn.ts → computeMathReward()`. Tweaking the formula = one file, no client deploy required.
3. **Integer division only (Phase 1).** No remainders. Engine synthesizes (quotient, divisor) then computes dividend, so every `÷` problem has a clean whole answer. Reflects user spec on 2026-05-29.
4. **Kid picks everything: op set, difficulty, round size, per-question timer.** Defaults are easy/10s/10-question/add to make the first run forgiving.
5. **Timer expiry = reveal + mark wrong + auto-advance.** No partial credit, no "almost." Matches the user's spec — be honest, the kid sees the right answer for ~1.2s, then moves on.
6. **One earn per round, ever.** Round mount generates a UUID idempotency key. Replays/retries with the same key are a no-op on the server.

## Reward curve (the rule kids hear: "the better you do, the more you earn")

```
reward = 0.25 MP × total           ← attempt pay, always
       + 1.00 MP × correct × diff  ← right-answer pay
       + fibBonus × sizeMult × diff ← accuracy bonus (≥80% only)
```

| Piece | Value |
|---|---|
| **Attempt pay** | 0.25 MP per question, flat (even with 0 right) |
| **Right pay** | 1.00 MP per correct × difficulty (Easy 1.0×, Medium 1.5×, Hard 2.0×) |
| **Fibonacci bonus** | 5/8/13/21/34 MP at 80/85/90/95/100% accuracy (zero below 80%) |
| **Size multiplier** | `min(2.0, total / 25)` — 25Q baseline, 50Q = 1.5×, 100Q+ = 2.0× |

So a 10-question hard math round at 100% earns: `0.25 × 10 + 1.00 × 10 × 2.0 + 34 × 0.4 × 2.0 = 2.50 + 20.00 + 27.20 = 49.70 MP`. A 10/10 easy round earns 26.10 MP. A 3/10 easy round still earns 5.50 MP (participation + 3 right + no bonus).

**No daily cap** (per user 2026-05-30). The `DAILY_EARN_CAP_CENTS` constant exists at `Number.MAX_SAFE_INTEGER` so the response shape stays stable if we ever reintroduce one. Per-question cents are whole numbers (no quantization) so "0.10 MP for trying with 0 right" displays cleanly.

## Phase ladder

| # | Phase | What kid does | Ship priority |
|---|---|---|---|
| **1** | **Quick Drill** | Pick op set (+/−/×/÷ or mix), difficulty, round size, timer. Race the clock, answer typed, Enter to submit. On expire: reveal + auto-advance. | ✅ **Shipped** |
| **2** | **Fact Families** | Master triangles (4×6=24 / 24÷6=4). One equation at a time with a "Family: a, b, c" chip pinned to the top; no timer, accuracy is what matters. | ✅ **Shipped 2026-05-30** |
| **3** | **Word Problems** | Read it, picture it, solve it. Hand-authored item bank, kid-friendly framing across all four ops. | ✅ **Shipped 2026-05-30** |
| 4 | Fractions / Decimals | New problem types in the engine; reuse round loop. | Future |
| 5 | Multi-step / Order of Ops | PEMDAS. Bigger problem text + scratch-pad UI. | Future |

### Phase 2 shipped notes (2026-05-30)

- Route: `app/math/fact-families/page.tsx`. Generator: `lib/math/fact-families.ts`.
- 40 generated families per round; round sizes 5/10/15/20.
- Op family selector: addsub / muldiv / mix. Difficulty: easy / medium / hard (drives the number ranges).
- Deliberately **no timer** — fact families are a memory drill, not a race; speed pressure would teach the wrong thing.
- Anon-earn wired via `<PendingEarnPrompt>` (same pattern as Quick Drill).

### Phase 3 shipped notes (2026-05-30)

- Route: `app/math/word-problems/page.tsx`. Items: `lib/math/word-problems.ts`.
- 40 hand-authored items, 13/13/14 split across easy/medium/hard. Mix of all four ops.
- Op filter: any / + / − / × / ÷ / mix. Round size 5/10/15 (items are hand-authored, so the pool sets the ceiling).
- Kid-friendly contexts (chores, snacks, road trips). No timer — reading + setup time varies per item.
- Anon-earn wired via `<PendingEarnPrompt>`.

## File layout (locked)

```
app/math/
  PLAN.md                    # this file
  page.tsx                   # hub: lists phases, links to /math/practice
  practice/page.tsx          # Phase 1 — config → playing → results

lib/math/
  engine.ts                  # pure problem generation, range tables, constants

lib/money/
  earn.ts                    # server-side reward calculator (cross-section)
  earn-client.ts             # client helper for submitting earns

app/api/money/earn/route.ts  # POST endpoint: kid-cookie auth, server-decided cents
```

## Non-goals (don't build)

- Letting kids see their MP formula. They see *that* the reward scales with how well they did; the curve is the parent's lever.
- Reintroducing a daily cap silently. If we ever need one (e.g., real money on the line, or parent feedback), do it via `DAILY_EARN_CAP_CENTS` so the shape stays in one place — don't sprinkle thresholds across sections.
- Negative or non-integer answers (Phase 1). Future fractions/decimals phase will introduce a different input type.
- Mobile-specific number pad — the input is `inputMode="numeric"` which gives iOS the right keyboard for free.

## When this gets touched again

- New op type (e.g., exponents): add to `Operation` union + `RANGES` table.
- New difficulty curve: edit `RANGES` only.
- Reward retune: edit `computeMathReward()` in `lib/money/earn.ts`. **No client changes needed.**
- New phase: add a `PhaseCard` to `app/math/page.tsx` with `shipped` flag, build the route.
