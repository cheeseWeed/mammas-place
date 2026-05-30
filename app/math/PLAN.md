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
cents = 100 × accuracy^1.5 × difficultyMult × speedMult × streakMult
```

| Factor | Range | Notes |
|---|---|---|
| `accuracy^1.5` | 0.0 → 1.0 | 100% is dramatically more than 80%. 0 correct = no earn, no exceptions. |
| `difficultyMult` | 1.0 / 1.5 / 2.25 | Easy / Medium / Hard. Hard is worth >2× easy at the same accuracy. |
| `speedMult` | 0.75 → 1.25 | `avgAnswerMs / timerMs` slow→0.75, half-timer→1.0, very fast→1.25. |
| `streakMult` | 1.0 → 1.5 | `1 + min(streak, 10)/20`. Caps at 10-in-a-row. |

Quantized to nearest 25¢ (.25 MP). **No daily cap** (per user 2026-05-30) — the merit curve already makes grinding the same easy round inefficient relative to attempting harder content. The `DAILY_EARN_CAP_CENTS` constant exists at `Number.MAX_SAFE_INTEGER` so the response shape stays stable if we ever reintroduce a cap.

## Phase ladder

| # | Phase | What kid does | Ship priority |
|---|---|---|---|
| **1** | **Quick Drill** | Pick op set (+/−/×/÷ or mix), difficulty, round size, timer. Race the clock, answer typed, Enter to submit. On expire: reveal + auto-advance. | ✅ **Shipped** |
| 2 | Fact Families | Master triangles (4×6=24 / 24÷6=4). Different drill mode, same engine for problem generation. | Future |
| 3 | Word Problems | Read it, picture it, solve it. Hand-authored item bank with categories. | Future |
| 4 | Fractions / Decimals | New problem types in the engine; reuse round loop. | Future |
| 5 | Multi-step / Order of Ops | PEMDAS. Bigger problem text + scratch-pad UI. | Future |

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
