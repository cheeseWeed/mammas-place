# Mamma's Place — TODO

Working notes for the next feature session. Pairs with `IMPROVEMENTS.md` (the longer roadmap).

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

## 🎯 Next session — MP Money (replace cash with per-user store credit)

### Vision
- Kids "earn" MP money (chores, grades, driving practice, completing study units)
- They spend it in the mamma's place store on real or pretend goods
- No real money handled — closed-loop family economy
- Optional: gift cards (printed codes that unlock a balance) for visitors/birthdays

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
