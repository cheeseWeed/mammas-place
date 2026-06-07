# Mamma's Place — Project Knowledge (read this first)

A homeschool family learning + economy app. **Production IS the test environment** —
the family (wife + kids) are the only testers. See "Working style" at the bottom: a
broken or factually-wrong feature destroys trust in the whole site, so everything ships
HARD-verified (driven like a user), not just type-clean.

## Stack
- **Next.js 16.1.6** (App Router, React 19.2, `reactCompiler: true` in `next.config.ts`), Turbopack dev.
- **Prisma 6.19** client → **Neon Postgres** (`DATABASE_URL`). **Same DB for local AND prod** — there is no separate dev database.
- **Vercel** hosting. Tailwind 4. Vitest (unit) + Playwright (e2e).
- Repo root: `C:\Users\dglazier\source\Personal\mammas-place`

## Run / build / deploy
| Task | Command |
|------|---------|
| Dev server | `npm run dev` → http://localhost:3000 |
| Build | `npm run build` (runs `prisma generate && next build`) |
| Typecheck | `npx tsc --noEmit` |
| Push schema to Neon | `npx prisma db push` (REQUIRED after any `schema.prisma` change) |
| Unit tests | `npm run test` (vitest) |
| E2E | `npm run test:e2e` (playwright) |
| Deploy to prod | `vercel --prod --yes` (MANUAL — see gotchas) |

**Passcode gate for fresh browsers:** the whole site is behind a passcode
(`context/PasscodeContext.tsx`, passcode `1379`). To test in a clean browser, set
`sessionStorage['mammas-place-passcode-unlocked'] = 'true'` (or just type 1379).

## Critical gotchas (learned the hard way)
1. **`npx prisma db push` after EVERY schema change.** It pushes to the shared Neon DB
   used by both local and prod. `prisma generate` is in the `build` script (and `postinstall`).
2. **A running `next dev` LOCKS the Prisma engine `.dll` → `prisma generate` fails with
   EPERM.** Kill the dev server (free port 3000) before running `prisma generate` / `npm run build`.
3. **`.vercelignore` is critical — keep it.** Without it, `vercel --prod` stalls forever
   uploading `node_modules` / `.next` ("Downloading 4029 files…"). It ignores
   `node_modules .next .git .claude *.log`.
4. **Vercel GitHub auto-deploy is BROKEN/disconnected.** Pushing to git does NOT deploy.
   **All deploys are manual: `vercel --prod --yes`.** To fix permanently: Vercel dashboard →
   Settings → Git → reconnect repo `cheeseWeed/mammas-place`, branch `master`.

## What the app is
A single login (a kid/learner) unlocks all sections. Learning sections (each at `/<key>`):
`scripture-study`, `letters`, `geography`, `drive` (Utah driver license study),
`spelling`, `math`, `language-arts`, `chess`, `music`, `chores`. Plus a **shop** and
**MP Money** — a closed-loop family currency: kids EARN MP by learning, SPEND it in the
shop, send **gift cards** (printable single-use codes) and do **kid-to-kid gifting**.
1 MP = 100 cents internally (`lib/money/earn.ts`); displayed as `10.54MP`.

The **Driver License study tool is fully self-contained** in `public/drive-assets/`
(decks, quizzes, exams, cheat-sheets, dashboard, images, `earn-toast.js`) — mostly
static assets, separate from the React sections.

## Auth model (verified in code — this is the part to get right)
Three identities. Don't conflate them.

| Cookie | Who | Properties | Set by |
|--------|-----|-----------|--------|
| `dl_user` | the logged-in kid/learner | `httpOnly:false` (client reads it), 2h `maxAge` | `app/api/drive/login/route.ts` |
| `mp_parent` | admin **godmode** | `httpOnly`, **SESSION cookie** (no maxAge → dies on browser close), signed timestamp with **hard 30-min cap** | `lib/money/parent.ts` `setParentCookie()` |
| `mp_admin_present` | client-readable marker "an admin is logged in" | `httpOnly:false`, **not a security boundary** | set/cleared alongside `mp_parent` |

- **PINs are SHA-256 hashed, not retrievable.** Kid PINs: `hashPin` in `lib/drive-progress.ts`
  (salt `utahdl-salt`). Parent PIN: `hashParentPin` in `lib/money/parent.ts` (salt `mp-parent-salt`).
  A forgotten PIN is **reset, never recovered** — kids file a `PinResetRequest`; admin sets a new PIN (non-destructive, progress preserved).
- **Parent PIN:** seed/first-time PIN is `mp2186` (`SEED_PARENT_PIN`); format is 4–12 alphanumeric.
  A stale `0000` seed in `ParentConfig` means: log in once with `0000`, then rotate via Settings.
- **`mp_parent` godmode is deliberately strict:** session cookie + signed stamp + 30-min hard
  cap, all enforced in `verifyStamp()` / `isParentAuthenticated()`. The stamp is HMAC-signed so
  the client can't extend it.
- **Parent vs Admin distinction** (`lib/family/auth.ts`):
  - `currentUser()` — the `dl_user` member.
  - `isAdmin()` — holds `mp_parent` (top tier; can create families, grant parent status, manage ANY family).
  - **parent** = a member listed in `Family.parents` (manages only their own family). A user must be
    flagged `DriveUser.isParent` by Admin AND be in `Family.parents` to manage.
- **Impersonation** (`app/api/admin/impersonate/route.ts`): admin POSTs `{user}` → sets `dl_user`
  to that kid + `mp_admin_return` marker, and **SUSPENDS godmode** (deletes `mp_parent`, drops
  `mp_admin_suspended`). So while impersonating the admin sees EXACTLY the kid's view (admin pages
  bounce them too). DELETE clears the borrowed identity and restores `mp_parent` if it was suspended.
  `IdentityBadge` / banner shows the greeting + "Return to admin".

## MP Money — correctness is sacred
**Money rules (verify hard on any change):**
- Balances stored in **cents** (`DriveUser.balanceCents`, integer). Never floats.
- **Append-only `MpTransaction` ledger.** Every balance change writes a ledger row in the SAME
  `prisma.$transaction` as the balance update (`lib/money/balance.ts` `credit`/`debit`/`placeOrder`).
  Partial success can never strand money.
- **Earns** (`lib/money/earn.ts` `awardEarn`): server is authoritative — the client submits
  `{section, kind, payload}`, the SERVER computes cents (kids never dictate their reward).
  All writes (`MpEarning` + balance increment + ledger row) in one transaction. **Idempotency
  via `MpEarning.idempotencyKey @unique`** — the DB unique constraint is the gate (no
  check-then-create race); duplicate → `reason: 'duplicate'`, 0 cents.
- **Double-credit guards via `updateMany`** on a boolean flag. E.g. scheduled gifts
  (`MpGift`): no cron on this stack, so `deliverDueGifts()` (`lib/money/gift.ts`) credits LAZILY
  on the recipient's balance/portal read; `delivered` is flipped with `updateMany` guarded on
  `delivered: false` so a gift can never double-credit under concurrent reads.
- Reward formula (locked 2026-05-30, no daily cap): `0.25 MP/question attempted + 1.00 MP/correct ×
  difficultyMult + Fibonacci accuracy bonus (kicks in at 80%) × round-size mult`. See `earn.ts` header.
- **`InsufficientFundsError`** thrown on overspend (`debit`/`placeOrder`).

## Prisma models (`prisma/schema.prisma`)
`DriveUser` (the shared LearnerProfile — table is legacy-named `drive_users`; per-section progress
is JSONB columns on this one row; `name` = normalized lowercase id, holds `balanceCents`, `isParent`,
`mpCardNumber`), `MpTransaction`, `MpOrder`, `MpEarning`, `ParentConfig`, `SiteConfig`, `DadAsk`,
`Product`, `Feedback`, `MpGiftCard` (printable single-use `MP-XXXXXX` codes), `MpGift` (kid-to-kid /
admin top-up, immediate or scheduled), `Family`, `PinResetRequest`, `ChessMatch` (2-device chess —
server re-validates every move, MP NOT wired yet to avoid double-credit), `Redemption` (append-only
external-reward log, debited immediately, no approval gate).

## Sabbath system (`lib/sabbath.ts`)
- On **Sundays in `America/Denver`** the shop + most learning are CLOSED. Only
  `scripture` (scripture-study), `music`, `audiobooks` stay open (`SABBATH_OPEN_SECTIONS`).
- Computed in family TZ (flips at local midnight, not UTC).
- **Admin-only "view as day" override:** `mp_sabbath_override` cookie (`'sun'|'wkdy'`), honored
  ONLY when an admin is present (so a stray cookie can't strand a logged-out kid on the wrong day).
- `SabbathGuard` component gates pages; server endpoints (`/api/money/order`, `/api/money/earn`)
  ALSO return 403 on the Sabbath — don't rely on the client guard alone.

## Section kill-switch (`lib/sections.ts`)
- `LEARNING_SECTIONS` registry — keys MUST match the route slug (`/<key>`).
- Admin disables a section site-wide via `SiteConfig.disabledSections` (array of keys);
  `SectionGuard` shows kids a "being updated" message while admin still has access.
- `isSectionEnabled(key, disabledList)` defaults to ENABLED on malformed/unknown input — never
  accidentally blocks a section.

## Letters & Sounds (`/letters`, `lib/letters/speak.ts`)
- 6 modes. **Recorded audio at `public/letters-audio/<letter>.mp3`** (XTTS cloned voice).
- `playLetter()` plays the mp3 and **falls back to browser TTS** (`speak()`) only if the file is
  missing/fails. Recorded audio exists BECAUSE browser TTS mangles isolated phonemes — do not
  remove the mp3s and rely on TTS for letter sounds.

## Feedback loop
- Kids submit feedback via a header bubble.
- Admin replies in **MP Bank → Feedback** (`Feedback.reply`).
- A reply is shown to the kid ONLY if `authorName` was given (which stamps `authorUser`). Blank
  name = fully anonymous, no identity, no reply thread back to the kid.

## Key directories
- `lib/money/` — balance, earn, gift, gift-card, card, dad (DadAsk), parent (admin auth), format.
- `lib/family/` — auth, family, jobs (chores), schedule, today, catalog.
- `lib/` — `sabbath.ts`, `sections.ts`, `drive-progress.ts`, `site-config.ts`, `prisma.ts`,
  per-section dirs (`letters/ math/ spelling/ geography/ chess/ languageArts/ music/`).
- `app/api/` — `admin/ drive/ learner/ money/ family/ feedback/ chess/ music/ audiobooks/ products/ inventory/ upload/`.
- `app/money/PLAN.md` — canonical MP Money spec. `app/money/PLAN-Phase6-Cards.md` — MP cards.
- `public/drive-assets/` — self-contained Utah driver license study tool.
- `docs/` — architecture/, products/, testing/.

## Working style for THIS project (important)
- **Prod is the test+prod environment.** The family are the testers; they leave feedback via the
  bubble. There is no staging.
- **HARD-verify before it reaches them** — drive the feature like a user (Playwright / real
  clicks), don't just confirm it compiles. A wrong driver-test answer or a broken letter sound
  erodes trust in the entire site.
- **Content accuracy = correctness, not polish.** Verify facts (driver-test answers, phonics,
  scripture) against authoritative sources.
- **Money + destructive paths: verify with real data every time.** Check the ledger, check
  balances, confirm idempotency / double-credit guards hold.
- Family faith standard is LDS (relevant to scripture-study content).
