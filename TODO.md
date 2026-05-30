# Mamma's Place — TODO

Working notes for the next feature session. Pairs with `IMPROVEMENTS.md` (the longer roadmap).

---

## ✅ Shipped 2026-05-30

### Math
- **Phase 2 — Fact Families** (`/math/fact-families`) — one-equation-at-a-time UI, "Family: a, b, c" chip, no timer; 40 generated families per round; sizes 5/10/15/20; op family addsub/muldiv/mix × easy/medium/hard.
- **Phase 3 — Word Problems** (`/math/word-problems`) — 40 hand-authored items (13/13/14 across easy/med/hard); op filter any/+/−/×/÷/mix; round size 5/10/15.
- Hub: Phase 1/2/3 all flipped to shipped. See `app/math/PLAN.md`.

### Language Arts (L2-L6 all shipped)
- **L2 Grammar** — 52 items (POS / agreement / tense)
- **L3 Punctuation** — 63 items, mix of fix-mode + fill-mode (commas, apostrophes, quotes, end-punct, semicolon, colon, dash vs hyphen)
- **L4 Phonics** — 72 items, word-anchored phonemes (no IPA — kids sound it out)
- **L5 Dictionary** — 68 items (alpha-order, guide words, pronunciation, multiple meanings, POS labels, etymology)
- **L6 Thesaurus** — 65 items (synonyms, antonyms, shade, repetition, strength)
- All five follow homophones page pattern (config → playing → results) with `<PendingEarnPrompt>` for anon-earn claim. See `app/language-arts/PLAN.md`.

### Drive deck earn toast
- Reveal.js decks (`unit-1..5.html`) now call `window.driveEarnToast` on completion via `/drive-assets/earn-toast.js`. Anonymous deck-completers see "Log in to keep this MP" toast; logged-in kids see "+X.XX MP earned" (was POSTing silently before).

### Multi-kid shared-laptop auth
- Session cookie (drops on browser close) replaces 1-year `dl_user` cookie.
- Drive landing is cookie-aware: "Welcome back [Name]" card + "Switch user" button when a cookie exists.
- Homepage `LearnerPills` shows "Hi [Name] · NMP" badge + "Switch →" when logged in.
- `LearnerContext` reads cookie first, localStorage fallback (was localStorage-only — broke shop-side login).

### Anonymous-earn → claim-after-login flow
- API returns "pending" preview when no cookie. Results card renders `<PendingEarnPrompt>` with amount + inline name+PIN form. On login/register the held earn re-submits with same idempotency key and gets banked.
- Wired into: Math practice, Math fact-families, Math word-problems, all 6 LA drills, Spelling practice, and **all 11 Geography quizzes** (US: name/capital/drag/flag/physical/silhouette; World: name/capital/continent/flag/physical).

### Drive quiz/exam HTML earn toast
- 18 quiz/exam HTML pages now show purple/yellow toast on results: logged-in = "+X.XX MP earned!", anonymous = "Log in or register at /drive to keep it". Drive HTML can't host React so no held-earn flow there — toast is informational for anon.

### Reward formula rewrite
- New rule (every section): `0.25MP × total + 1.00MP × correct × diff + fibBonus × sizeMult × diff` (bonus only ≥80%).
- diff = 1.0/1.5/2.0 (easy/med/hard); fibBonus = 5/8/13/21/34 MP at 80/85/90/95/100%; sizeMult = `min(2.0, total/25)`.
- Drive 80% gate removed; Drive deck completion 0.25 → 0.50 MP.

### Parent PIN rotation UI
- "Settings" collapsible at bottom of `/admin/mp-bank`: Current/New/Confirm 4-digit inputs, POST to existing `/api/money/parent/setup`, toast feedback.

### displayName at register
- All four registration surfaces now capture optional "Display name": `DriveLoginForm`, `ShopLoginForm`, `LoginGate`, `PendingEarnPrompt`. Sanitized to 30 chars in `/api/drive/register`. Optional — doesn't block fast registration.

---

## 🔌 Earn wiring status (everything is wired)

| Section | Routes wired | Anon claim flow |
|---|---|---|
| Math | `/math/practice`, `/math/fact-families`, `/math/word-problems` | ✅ |
| Language Arts | all 6 (homophones, grammar, punctuation, phonics, dictionary, thesaurus) | ✅ |
| Spelling | `/spelling/practice` | ✅ |
| Geography (US) | name, capital, drag, flag, physical, silhouette | ✅ |
| Geography (World) | name, capital, continent, flag, physical | ✅ |
| Drive decks (HTML) | unit-1..5 | toast only (HTML can't host React) |
| Drive quizzes/exams (HTML) | all 18 | toast only |
| Chess | wins/draws via `/api/chess/game` finish | n/a |

---

## 🎯 Next session — Phase 6: MP Cards (planned, not built)

Full spec: **`app/money/PLAN-Phase6-Cards.md`** (read first).

| Phase | What ships |
|---|---|
| **6a** | Account card: per-kid 4-digit card number (e.g. `MP·7821`), printable, receive-only (PIN still required to spend). Kid sees card; parent can reroll. Cheapest win. |
| **6b** | `/give` public deposit page so grandparents/visitors can top kids up. Needs rate-limit + per-call cap. |
| **6c** | Gift cards full lifecycle: parents create `MP-XXXXXX` codes, print, kid redeems at `/portal/money/redeem`. Revoke + audit log. |

Not changing in Phase 6: admin top-up (already at `/admin/mp-bank`), kid balance view (already at `/portal/money` + header chip).

---

## 🎯 Chess — in-progress (don't claim shipped yet)

Phases 1 + 2 shipped (engine, themes, 2-player UI). Phases 3 (vs-AI) + 4 (save + MP earn) are being wired in by a parallel agent — check `app/chess/PLAN.md` and `app/chess/play/page.tsx` before assuming state.

---

## 🎯 Other roadmap items (later)

- **GA4 funnels** — wire conversion events for register → first earn → first shop purchase.
- **Phase 8: Wishlist / layaway** — out-of-funds path that signals parent.
- **Phase 9: Daily spend cap** — per-kid daily max set in parent admin.

---

## 🔧 Smaller polish items (whenever)

### /drive
- Tighten remaining slides that still slightly overflow on long content.
- Add 3-Q checkpoints on the dense rule slides where 2-Q feels light (ROW priority ladder especially).
- Final exam celebration: bigger fireworks (15 bursts vs 6) since the achievement is bigger.
- Audio narration for slides (Zerofatalities does this) — long-term content item.

### General
- Confirm `data/drive-progress.json` is fully out of git history (gitignore covers it now).
- Verify demo banner is scoped to non-`/drive` routes per integration-decisions.
- Mobile deck navigation is finger-clumsy — bigger arrow buttons would help.

---

## Reference

- Neon dashboard: https://console.neon.tech → `mammasplace` project
- Vercel dashboard: https://vercel.com/malvaneglecta-5901s-projects/mammas-place
- Production URL: https://mammas-place.vercel.app
- Drive entry point: https://mammas-place.vercel.app/drive
- GitHub: https://github.com/cheeseWeed/mammas-place
- IMPROVEMENTS.md: longer roadmap with priority order
- Deploy is still manual: `git push origin master && npx vercel --prod --yes` (auto-deploy webhook is broken on this project)
- Schema changes (any new column or table) need `npx prisma db push` against Neon before they work in prod
