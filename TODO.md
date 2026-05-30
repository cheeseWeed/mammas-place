# Mamma's Place — TODO

Working notes for the next feature session. Pairs with `IMPROVEMENTS.md` (the longer roadmap).

---

## ✅ Just Shipped (2026-05-30) — Math + Language Arts + cross-section MP earning

Branch: `dglazier/feature/language-arts-and-math` (not yet merged to master).

### Math Arena — `/math`
- `/math` hub (Phase 1 shipped; Phase 2-3 listed as Coming Soon)
- `/math/practice` — config → playing → results
  - Operations: +, −, ×, ÷ — multi-select; "Mix all four" shortcut
  - Difficulty: Easy / Medium / Hard (number ranges in `lib/math/engine.ts`)
  - Round size: 5 / 10 / 15 / 20 questions
  - **Per-question timer: 5 / 10 / 15 / 20 / 30 / 45 / 60 seconds (kid picks)**
  - On timer expire: reveal correct answer for ~1.2s, mark wrong, auto-advance (per user spec)
  - **Integer-only division** (no remainders) — engine builds dividend from (quotient × divisor)
  - Live streak counter, per-question timer bar (sky → amber → red)
- Spec: `app/math/PLAN.md`

### Language Arts — `/language-arts`
- `/language-arts` hub (Phase L1 shipped; L2-L6 Coming Soon: Grammar / Punctuation / Phonics / Dictionary / Thesaurus)
- `/language-arts/homophones` — Phase L1 fill-in-the-blank drill
  - 10 sets, 47 sentences: its/it's, your/you're, their/they're/there, to/too/two, affect/effect, then/than, lose/loose, whose/who's, were/where/wear, accept/except
  - Tier (Easy 2-way / Medium 3-way / Hard subtle)
  - Round size 5/10/15/20
  - On wrong answer: rule for that set + optional item hint surface for ~1.6s
- Content + helpers: `lib/languageArts/homophones.ts`
- Spec: `app/language-arts/PLAN.md`

### Cross-section MP earning — **server-decided**, no daily cap
**Single rule kids hear: "the better you do, the more you earn."**

- New table `mp_earnings` (idempotency key prevents double-credit)
- New route `POST /api/money/earn` — kid-cookie auth (no parent gate); server decides cents from {section, kind, payload}
- New lib `lib/money/earn.ts` — pure reward formulas per section + orchestrator
- New lib `lib/money/earn-client.ts` — `submitEarn()` helper for any section to call
- **No daily cap** (per user 2026-05-30). Merit curve handles grind-prevention. `DAILY_EARN_CAP_CENTS` sits at `Number.MAX_SAFE_INTEGER` so the response shape stays stable if we reintroduce one.
- **Atomicity (fixed 2026-05-30):** MpEarning row + balance increment + MpTransaction ledger row all live in **one** `prisma.$transaction`. If any one fails, none commit — kid can't lose money to a half-write that replays as 'duplicate'. Original first pass had two separate transactions; the cross-session review flagged it.
- Reward formulas in `lib/money/earn.ts`:
  - **Math:** `100c × accuracy^1.5 × difficulty(1/1.5/2.25) × speed(0.75-1.25) × streak(1-1.5)`
  - **Spelling quiz:** `80c × accuracy^1.5 × (1 + (level-1)×0.15)` (Spelling page still needs to call this)
  - **Language Arts drill:** `70c × accuracy^1.5 × tier(1/1.3/1.75)`
  - **Geography quiz:** size-based base × accuracy^1.5 (50/80/120/200c for 5/10/20/50 questions)
  - **Drive deck:** flat 25c · **Drive quiz/exam:** 75c/250c × accuracy^1.5, only at ≥80% accuracy
- Quantized to 25¢ (.25 MP) so balances look clean
- Idempotency: client generates a UUID per round mount (`newIdempotencyKey()`); replays are no-ops

### Sections currently wired to earn:
- ✅ Math (`/math/practice`) — wired
- ✅ Language Arts (`/language-arts/homophones`) — wired
- ✅ **Geography Name Quiz** (`/geography/name-quiz`) — wired as proof-of-concept on existing section

### Sections that still need the `submitEarn()` call (one ~10-line addition each):
- ⏳ **Spelling practice** (`app/spelling/practice/page.tsx`) — call with section=`spelling`, kind=`quiz`, payload=`{correct, total, level}`
- ⏳ **Drive quizzes/decks** (under `app/drive/`) — call with section=`drive`, kind=`quiz` or `deck`. Important: pass `isFinalOrSim:true` on the 3 finals + 50-Q simulator to bump them from 75c → 250c base.
- ⏳ **Geography remaining quizzes**: capital-quiz, flag-match, drag-match, silhouette-puzzle, physical-quiz, per-state quizzes, world capital/flag/name/physical quizzes. All have `onComplete({score, total, ...})`-style callbacks — copy the pattern from `/geography/name-quiz/page.tsx`.

### Schema additions (need `npx prisma db push` against Neon before this works in prod)
- `DriveUser.math` JSONB column (default `{}`)
- `DriveUser.languageArts` JSONB column (default `{}`)
- `mp_earnings` table (new)

### Header / nav
- Learn dropdown (desktop + mobile) now lists: Geography · Drive · Spelling · **🧮 Math Arena** · **📚 Language Arts**
- `LoginGate` knows the two new sections (sky accent for Math, rose for Language Arts)

### Deploy checklist for next session
1. **`npx prisma db push`** against Neon — materializes new columns + `mp_earnings` table
2. `git push origin dglazier/feature/language-arts-and-math` then merge to master (or open PR)
3. `npx vercel --prod --yes` (manual deploy still required per existing notes)
4. Verify: log in as a kid → run a math round → check `/portal/money` shows the earn

---

## ✅ Recently Shipped (2026-05-29)

### `/drive` — Utah Driver License study tool
For the kids preparing for the Utah DLD written test. Lives at `/drive` with assets under `/drive-assets/`.

- 5 Reveal.js decks (Units 1-5, ~190 slides)
- ~44 inline knowledge-check slides + 15 "Go look at Zerofatalities" review slides + 4 closing tour slides
- 14 quizzes (10 unit tests A/B + commonly-missed A/B + Weak Spots + Due Today spaced-repetition)
- 4 exams (3 finals + 50-Q DLD simulator)
- 5 print-friendly cheat sheets
- 626-question bank backed by 385 canonical facts
- Confetti on deck end, fireworks on quiz pass (≥80%)
- "Today's Plan" recommendation card on dashboard

### Auth — multi-user with PIN
- Name + 4-digit PIN, SHA-256 hashed
- Anonymous fallback (Skip → localStorage only)
- "Hello, [Name]" greeting on dashboard after login
- Server-side cookie + browser localStorage `dl_user`

### Database — Neon Postgres ✨ NEW
- Provider: Neon (free tier, no credit card)
- Project: `mammasplace`, region `AWS US East 1`
- Single table: `drive_users` (JSONB blobs for attempts/misses/scores/SR/deck-completions)
- Schema: `prisma/schema.prisma`
- Client wrapper: `lib/prisma.ts` (singleton — prevents serverless cold-start storms)
- Adapter: `lib/drive-progress.ts` (kept the legacy `readStore`/`writeStore` signatures so route handlers are unchanged)
- Routes: `/api/drive/{register,login,progress,reset}`
- Env var: `DATABASE_URL` (set in Vercel project Environment Variables → Shared)
- Cross-device sync: dashboard's `hydrateThenRender()` fetches from `/api/drive/progress` on every load, overwrites localStorage with server state. Result: progress on laptop appears on phone (and vice versa) the moment the dashboard loads.

### Build / deploy
- `npm` script `postinstall: prisma generate` so Vercel builds the client
- **Deploy is manual: `git push origin master && npx vercel --prod --yes`** (auto-deploy via GitHub webhook is broken on this project — has been an ongoing issue, do not skip the manual step)
- Saved to memory at `~/.claude/memory/mammas-place-deploy.md`

---

## ✅ MP Money — shipped (2026-05-29)

Closed-loop family economy. Kids earn **MP** (the unit), spend it in `/shop`. No real money. One name+PIN works for both `/drive` and `/shop` (TODO Option A).

**Currency:** displayed as `10MP` (whole) or `10.54MP` (fractional). Internally stored in 1/100 units (`balanceCents` Int) to avoid float drift.

**Architecture spec:** `app/money/PLAN.md` (locked, mirrors `app/geography/PLAN.md` discipline).

### What shipped
- `prisma/schema.prisma` — added `DriveUser.balanceCents`, `MpTransaction`, `MpOrder`, `ParentConfig`
- `lib/money/{balance,parent,format}.ts` — server-only ledger helpers, atomic Prisma transactions
- `context/LearnerContext.tsx` — shop-side learner state, reads same `dl_user` as `/drive`
- 10 API routes: `/api/money/{balance,order,transactions,orders,credit,debit,parent/login,parent/setup,admin/learners,admin/orders}`
- `/shop/login` — name+PIN form mirroring `DriveLoginForm`
- `components/BalanceChip.tsx` + Header wiring — desktop pill + mobile menu row
- `/checkout` — full rewrite: "Pay with MP" flow, anonymous prompt, insufficient-funds "Ask Dad to top you up", server re-prices items
- `/admin/mp-bank` — parent-gated dashboard: learner balances, top up/deduct, all-orders feed, per-kid transaction log
- `/admin/mp-bank/login` — parent PIN gate (initial PIN: **0000**, change after first login)
- `/portal/money` — kid's own balance + order history + transactions
- TypeScript clean. `npm run build` passes.

### ⚠️ Before this works in production
1. **`npx prisma db push`** against Neon to materialize the new tables (`mp_transactions`, `mp_orders`, `mp_parent_config`) and the `balance_cents` column. Until this runs, all `/api/money/*` endpoints will 500.
2. First parent visit: go to `/admin/mp-bank` → enter `0000` → it seeds the ParentConfig row. Change the PIN via `/api/money/parent/setup` (UI for PIN rotation is not built yet — easy add).
3. Deploy is still manual per existing notes: `git push origin master && npx vercel --prod --yes`.

---

## 🎯 Next session — Phase 6: MP Cards (planned, not built)

Full spec: **`app/money/PLAN-Phase6-Cards.md`** (read this first next session).

Two flavors, shared infrastructure:
- **MP Account Card** — short 4-digit card number per kid (e.g. `MP·7821`). Printable. *Receive-only* (can credit, can't spend — PIN still required to spend). Lets grandparents/visitors top kids up via a public `/give` page.
- **MP Gift Cards** — single-use `MP-XXXXXX` codes parents print for birthdays/surprises. Kid redeems at `/portal/money/redeem`.

Suggested phase order (each ships independently):
- **6a** — Account card: number gen + kid sees printable card + parent reroll. Cheapest win.
- **6b** — `/give` public deposit page (needs rate-limit + per-call cap).
- **6c** — Gift cards full (create/print/redeem/revoke).

What's NOT changing in Phase 6:
- Admin adding money — already lives at `/admin/mp-bank` "Top up" button.
- Kid seeing balance — already at `/portal/money` + header chip.
- The card UX is a layer on top of existing balance, not a replacement.

---

## 🎯 Future learning section — Language Arts

Doable and natural fit alongside Spelling and Geography. Reuses the same `DriveUser` table — just add a `languageArts Json @default("{}")` column when the section ships. No new auth, no new login, no new schema upheaval.

### Scope (full)
- **Grammar** — parts of speech, sentence structure (subject/verb/object), tense, agreement, common error patterns
- **Punctuation** — comma, semicolon, colon, apostrophe, quotation marks, dash vs hyphen, Oxford comma
- **Synonyms / Antonyms / Homonyms / Homophones** — the "-nyms" family — drills for "their/they're/there", "affect/effect", "to/too/two"
- **Phonics / phonemes** — letter sounds, blends, digraphs, vowel teams (overlaps with Spelling — share a phoneme map)
- **Word usage** — "when to use which word" — register/tone (formal vs casual), connotation, idioms
- **Dictionary skills** — looking up a word, pronunciation guides, etymology, multiple definitions, parts of speech labels
- **Thesaurus skills** — finding alternatives, choosing the right shade of meaning, avoiding word repetition

### How it fits the existing pattern
- `/language-arts/page.tsx` landing page (mirrors `/drive`, `/geography`)
- `/language-arts/PLAN.md` architecture spec (mirrors `/drive` + `/money` + `/geography` discipline)
- Reuses `LearnerContext` — same name+PIN login as Drive/Shop/Geography
- Per-skill progress as nested JSONB: `{ grammar: {...}, punctuation: {...}, nyms: {...}, phonics: {...}, dictionary: {...} }`
- Spaced repetition for vocab — reuse the `sr` pattern from Drive
- Auto-credit hooks (Phase 7) — completing a unit = +MP

### Doability — high
- Content scope is large but mostly fact-based (drillable)
- Could lean on existing public-domain reference content (Merriam-Webster's free API, Wiktionary, basic grammar references)
- AI generation for question/example variants is a strong fit
- Phaseable: ship phonics first (matches youngest kids), grammar later

### Suggested first slice
Phase L1: Homophones + commonly confused words (their/they're/there, your/you're, its/it's, affect/effect, to/too/two). 1 deck + 1 quiz + spaced repetition. ~1 session of build.

---

## 🎯 Future games section — Chess

### Scope
- Play chess against the computer (Stockfish via WASM is free, runs in the browser, no API cost)
- Difficulty levels (beginner / casual / strong)
- Save unfinished games (per learner — same DriveUser row, `chess` JSONB column)
- Optional later: puzzles ("mate in 2"), opening trainer, end-game drills

### Doability — high
- **chessboardjs / chess.js** — standard open-source pair for board UI + rules
- **Stockfish.wasm** — full chess engine in the browser, no server cost, no API key
- Storage: `DriveUser.chess Json @default("{}")` — `{ games: [...], stats: {wins, losses, draws}, lastPosition }`
- No real money / earnings hook unless we want one (could earn MP for a win against a higher-rated bot)

### Suggested first slice
Phase C1: Play vs Stockfish at a chosen difficulty, save/resume one in-progress game, win/loss/draw counter. ~1 session.

### Future
- Two-player local (siblings at the same screen)
- Puzzles from a free puzzle DB (Lichess publishes one under CC license)
- Online-vs-friend would need a real-time channel — defer

---

## 🎯 Other roadmap items (later)

- **Phase 7: Auto-credit hooks** — `/drive` deck completion → +0.50MP. Quiz ≥80% → +0.25MP.
- **Phase 8: Wishlist / layaway** — out-of-funds path that signals parent.
- **Phase 9: Daily spend cap** — per-kid daily max set in parent admin.
- **Parent PIN rotation UI** — currently only via `/api/money/parent/setup`. Add a settings panel to `/admin/mp-bank`.
- **DisplayName field** — schema has it; UI doesn't capture it on register. Phase 6 is a natural moment to add this (card looks better as "Lilly" than "lilly").

---

## (Original notes — kept for reference)

### Vision (shipped)
- Kids "earn" MP (chores, grades, driving practice, completing study units)
- They spend it in the mamma's place store on real or pretend goods
- No real money handled — closed-loop family economy
- Optional: gift cards (printed codes that unlock a balance) for visitors/birthdays — Phase 6

### What needs to change

**Data model**
- Reuse the Neon DB
- Either extend `DriveUser` with a `balance` column OR create a parallel `MpUser` (cleaner if /drive vs /shop accounts are different — same person can be both)
- New `Transaction` table — id, userId, amount, type (`earn` / `spend` / `gift` / `refund`), reason, ts
- New `Order` table — id, userId, items[], total, status, createdAt
- Optional: `GiftCard` table — code, balance, redeemedBy, redeemedAt

**Auth merge or fork?**
- Option A: same name+PIN account works for both /drive and /shop (one login, both worlds)
- Option B: separate accounts (drive doesn't know about shop, shop doesn't know about drive)
- My take: **Option A** — kids hate juggling accounts, parents want one place to see everything

**Checkout flow**
- Replace "Card / PayPal" buttons with "Pay with MP Money"
- Reject if balance insufficient → "Ask Dad to top you up"
- Subtract on order placement, refund on cancellation
- Show running balance in header

**Admin / parent UI**
- A page where parents can top up balances, deduct, view transaction history
- Probably gated behind a parent PIN (separate from kid PINs)
- Could live at `/admin/mp-bank` or similar

**Order history**
- Each user sees their own past orders
- Parent sees all orders across all kids
- Status: pending, fulfilled, cancelled

### Open questions for next session
- Top-up mechanism? Parents log in and adjust, or a "chore complete" button that auto-credits?
- Spending limits per kid? Daily max?
- What happens when a kid runs out — wishlist? layaway?
- Pretend goods vs real goods — same shop, both?
- Sales tax? Probably skip (it's family money)

### Cross-references in IMPROVEMENTS.md
- #4 Real Auth (NextAuth.js) — could pair, but our PIN system might be enough for family use
- #8 User Accounts & Order History — directly relevant
- #9 Stripe Integration — REPLACE with MP money instead

---

## 🔧 Smaller polish items (whenever)

### /drive
- Decks: tighten remaining slides that still slightly overflow on long content (mostly minor, scrollbar handles it)
- Add 3-Q checkpoints on the dense rule slides where 2-Q feels light (ROW priority ladder especially)
- Final exam celebration: bigger fireworks (15 bursts vs 6) since the achievement is bigger
- Deck completion analytics — count how many minutes she actually spends per slide (could inform pacing)
- Audio narration for slides? Zerofatalities does this — could be a long-term content item

### General
- Strip `data/drive-progress.json` from git history (the old JSON file before Neon — should be safe since `.gitignore` covers it now, but worth confirming)
- Demo banner: still shows on prod? Verify it's scoped to non-`/drive` routes per integration-decisions
- Mobile experience: drive works on phone but the deck navigation is finger-clumsy — could add bigger arrow buttons

---

## Reference

- Neon dashboard: https://console.neon.tech → mammasplace project
- Vercel dashboard: https://vercel.com/malvaneglecta-5901s-projects/mammas-place
- Production URL: https://mammas-place.vercel.app
- Drive entry point: https://mammas-place.vercel.app/drive
- GitHub: https://github.com/cheeseWeed/mammas-place
- IMPROVEMENTS.md: longer roadmap with priority order (this TODO.md is the working notes)
