# Practice Studio — Music section

A daily practice tracker for any instrument. The kid picks (or is assigned)
pieces, follows a generated daily plan to learn them line-by-line, and logs a
quality score each day to earn MP. "The better it sounds, the more you earn."

Built on top of MP Money (see `app/money/PLAN.md`) — it's just another earning
section, like Math or Chess, plus a reusable competition wrapper (Challenge).

## What it does

- **Pieces.** A piece = one song on one instrument, with an estimated number of
  lines, a difficulty, and an optional pass-off target date. Kids can add their
  own; parents can add/edit any kid's from `/admin/music`.
- **Daily plan.** From each piece's line count and target date, the studio tells
  the kid how many *new* lines to learn today — front-loading learning so there's
  polish time before the target. Weekends (Sat/Sun) are flagged as performance
  days, not new-learning days. (See `lib/music/plan.ts`.)
- **Daily earn.** The kid plays, then enters a 1–10 quality score (reviewed by a
  parent / ChatGPT first). MP scales steeply with the score (Fibonacci-style),
  capped at **100 MP/day/piece**. One score per piece per day (idempotent).
  (See `lib/music/reward.ts`.)
- **Pass-off.** A parent confirms a piece is performance-ready in `/admin/music`.
  That mints a **gift card** (200 MP default) the kid redeems through the normal
  MP gift-card flow — single economy, full audit trail.
- **Challenge (reusable).** An OPTIONAL competition wrapper attached to a kid —
  not specific to any one kid. Defines per-pass-off reward + two deadline
  bonuses: "finish all by date X" and "play all well in one day by date Y."
  Reused for any kid with a recital / camp / competition coming up.
- **Certificate.** Once a piece is passed off OR the kid hits a 9–10/10 run
  (full points), the kid can self-print a certificate at `/music/certificate`.

## MP economy (this section)

| Event | Reward | Where set |
|---|---|---|
| Daily practice | up to 100 MP/day/piece (steep on quality) | `lib/music/reward.ts` |
| Pass off a piece (in a challenge) | `challenge.passOffRewardCents` | `/admin/music` |
| Pass off a piece (no challenge) | 200 MP default | `/api/music/pass-off` |
| Weekly pass-off (non-competition kids) | 150 MP/week per pass-off — parent pays from MP Bank | manual |
| Finish all challenge pieces by date | `finishAllBonusCents` | challenge |
| Play all well in one day by date | `playAllInOneDayBonusCents` | challenge |

> The "150 MP/week per pass-off" rule for non-competition kids is a parent
> convention paid via the MP Bank top-up — it isn't auto-enforced, because
> "this week" pass-offs vary. The challenge automates the competition payouts.

## File map

```
lib/music/
  types.ts     # MusicPiece, MusicChallenge, MusicProfile (+ coerce)
  reward.ts    # steep daily-score → cents curve, 100 MP cap
  plan.ts      # daily/weekly line plan, learned/bestScore, perform-day detection
  today.ts     # America/Denver "today" (so weekend detection matches the family)
  profile.ts   # SERVER-ONLY blob I/O + atomic earn + pass-off + challenge eval
  __tests__/reward.test.ts

app/api/music/
  state/route.ts      # GET full profile + today's plan + reward curve
  pieces/route.ts     # POST/PATCH/DELETE pieces (kid self or parent)
  practice/route.ts   # POST daily score → earn (kid)
  pass-off/route.ts   # POST pass-off → mint gift card (parent)
  challenge/route.ts  # POST set/clear challenge (parent)

app/music/page.tsx              # kid hub (plan, score entry, challenge tracker)
app/music/certificate/page.tsx  # printable certificate (self-serve)
app/admin/music/page.tsx        # parent admin (gate) → MusicAdminDashboard
components/admin/MusicAdminDashboard.tsx

scripts/seed-shepherd-music.mjs # Shepherd's 4 cello pieces + July challenge
```

## Architectural rules (kept consistent with MP Money)

1. **Server decides the reward.** The client sends `{pieceId, qualityScore,
   linesPracticed}`; the server computes cents. Kids can't self-credit.
2. **Atomic + idempotent.** Every earn writes MpEarning + balance + ledger +
   the music blob in one `$transaction`. The unique key
   `music:{user}:{pieceId}:{date}` makes one-score-per-day race-safe.
3. **One economy.** Pass-off rewards are MP gift cards via `lib/money/gift-card`,
   not a parallel currency. Section earnings total into the wallet grid
   (`sumEarningsPerSection` → `music`).
4. **Challenge is reusable, never hard-coded.** Shepherd's July sprint is one
   instance created from the generic editor. Award flags are server-managed so a
   parent edit can't re-arm a paid bonus.

## Deploy note

The `music` column is a new JSON field on `drive_users`. Run
**`npx prisma db push`** against Neon before deploying, or every `/api/music/*`
call 500s (same gotcha as every other schema change here).
