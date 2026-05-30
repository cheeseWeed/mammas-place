# MP Money — Phase 6: Cards & Gift Cards (PLAN — DO NOT CODE YET)

Companion to `PLAN.md`. Defines two card concepts that share infrastructure:

1. **MP Account Card** — a short, memorable number tied to a kid's existing learner row. Lets them "pay with their card" instead of typing their PIN. Also makes grandma/grandpa giving them money trivial ("send 25MP to card 7821").
2. **MP Gift Cards** — single-use codes printed for visitors, birthdays, or surprise drops. Redeem once → balance lands in a kid's account.

Both reuse the existing balance + ledger from Phase 1. No second economy. No new currency.

---

## What already exists (don't rebuild)

| Need | Lives at | Status |
|---|---|---|
| Per-kid balance | `DriveUser.balanceCents` | ✅ shipped |
| Kid sees their balance | `/portal/money` | ✅ shipped |
| Admin adds money | `/admin/mp-bank` → "Top up" button per kid | ✅ shipped |
| Append-only ledger | `mp_transactions` | ✅ shipped |
| Parent gate | `mp_parent_config` + `mp_parent` cookie | ✅ shipped |

**So the user-facing answers to "admin adds money" and "kid checks balance" are already live.** Phase 6 is purely about the *card* UX layer on top.

---

## Concept 1: MP Account Card (short number per kid)

### Why
- Kid wants to feel like they have "a card with their money on it." PIN typing is friction.
- Grandparents say "I want to give Lilly 25MP for her birthday" — currently they'd need her PIN or have to ask a parent. A short card number is shareable safely (no auth power; see below).
- Printable: a kid can have a real laminated card with their MP number on it, sitting in a play wallet.

### Properties (locked)
- **Short**: 4 digits. Memorable, fits on a kid-size card. Example: `7821`.
- **Public-safe by design**: the card number is for *receiving* money and *displaying identity*. It is **NOT a credential**. You still need the kid's PIN to spend. Knowing the card number lets you *credit* it, never *debit* it.
- **One per kid**, auto-generated on first /shop login. Unique. Re-rollable from `/admin/mp-bank` (in case of loss).
- **Display format**: `MP·7821` on the card; in code, just the digit string.

### Data model (additive — no migrations to existing tables)

```prisma
model DriveUser {
  // ... existing ...
  mpCardNumber  String? @unique  // 4-digit, optional until first generated
  mpCardCreatedAt DateTime?
}
```

No new table needed for Concept 1.

### Generation
- On first authenticated visit to `/portal/money` (or first parent top-up), auto-generate if null.
- Pick a random 4-digit number, retry on collision (~6 retries worst case with 10K space and a small family).
- Reserve `0000-0099` for parent/system use → kid space is 0100-9999.

### Endpoints (new)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/money/card/me` | Returns logged-in kid's card number. Auto-generates if missing. |
| POST | `/api/money/card/credit` | Body: `{ cardNumber, cents, reason, fromName? }`. Credits the kid whose card matches. **No auth required** (it's a deposit, not a withdrawal). Rate-limited per IP. Caps at e.g. 1000MP per call to prevent griefing. |
| POST | `/api/money/admin/card/reroll` | Parent-gated. Generates a new number for a kid. |

### UI

**Kid-facing:**
- New section on `/portal/money`: a "card" visual (rounded purple/yellow tile with `MP·7821` big and the kid's name + balance underneath). Tap → "Show printable card" → opens a PDF-friendly page.
- New page `/portal/money/card` (printable): just the card centered on a white page, with the kid's name, the number, and a small "Visit mammas-place.vercel.app/give to send MP." line.

**Public "give money" page:**
- New page `/give` (no login). Input: card number (4 digits) + amount + optional "from" name + optional message. Hits `/api/money/card/credit`. Success: "🎉 25MP sent to Lilly's card!"
- Confetti, of course.
- Show the kid's display name on success (look up by card number) so the giver knows it went to the right person.

**Parent admin (`/admin/mp-bank`):**
- New column on the learner list: card number + "🔁 Reroll" button.

### Security/abuse notes (think now, not later)
- Card number = recipient identifier, never a credential. Document this in inline comments and the page UI ("It's safe to share — they can only add money, not spend it").
- Rate-limit `/give` per IP (e.g. 10/hour) to stop griefers from generating ledger noise.
- Cap per-credit amount via `/give` to e.g. 500MP. Parent admin has no cap.
- All `/give` credits write a `MpTransaction` row with `type='gift'` and `reason = "Gift from {fromName ?? 'anonymous'}{message ?': ' + message : ''}"`. Audit trail intact.
- Optional Phase 6.5: parent toggle "Pause my kids' /give page" if abuse happens.

---

## Concept 2: MP Gift Cards (single-use codes)

### Why
- Birthday / Christmas / "you did great" surprise drops.
- Visitor doesn't need to know any kid's card number.
- Printable: parent prints a code on a colored card, hands it over, kid types it in.

### Properties (locked)
- **Code format**: `MP-XXXXXX` (6 alphanumerics, base32 alphabet excluding I/O/0/1 for printability). Example: `MP-7K2H9N`. ~1 billion combos — plenty.
- **Single-use**: redeem once, locked forever. Status = `unredeemed | redeemed | revoked`.
- **Optional expiry** (parent sets, default none).
- **Optional "from" / "message"** stored so redemption screen says "From Grandpa: Happy birthday Lilly! ❤️".

### Data model

```prisma
model MpGiftCard {
  code          String   @id          // "MP-7K2H9N"
  cents         Int
  status        String   @default("unredeemed") // 'unredeemed' | 'redeemed' | 'revoked'
  createdAt     DateTime @default(now())
  fromName      String?
  message       String?
  expiresAt     DateTime?
  redeemedBy    String?               // userName (foreign key, soft)
  redeemedAt    DateTime?

  @@map("mp_gift_cards")
}
```

### Endpoints (new)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/money/admin/giftcards/create` | Parent-gated. Body: `{ cents, count, fromName?, message?, expiresAt? }`. Generates `count` unique codes. Returns the list (parent prints them). |
| POST | `/api/money/giftcards/redeem` | Logged-in kid. Body: `{ code }`. Atomically marks redeemed + credits balance + writes ledger row. Idempotency: re-submitting same code returns "already redeemed" without crediting twice. |
| GET | `/api/money/admin/giftcards` | Parent-gated. List all (filter by status). |
| POST | `/api/money/admin/giftcards/revoke` | Parent-gated. Mark unredeemed code as `revoked`. |

### UI

**Parent admin (`/admin/mp-bank` — new tab):**
- "Gift Cards" section. Generate 1 or many at once (e.g. 10 cards × 5MP for a party).
- Print view: a page that renders each card on its own (decorative border, big code, message, expiry if set). Print one A4 page → cut → done.
- Live list of all cards: code, amount, status, who redeemed, when.

**Kid-facing:**
- New page `/portal/money/redeem`. Single input: paste/type the code. Big "Redeem" button.
- Success screen with confetti + "+5MP from Grandpa: Happy birthday! ❤️" + new balance.
- Errors: already redeemed / expired / not found / revoked — friendly messages, no leaking whether the code exists vs is just wrong.

### Security/abuse notes
- Code generation: cryptographically random, base32 without confusables. Server-side only.
- Redemption uses Prisma `$transaction`: lock-and-update giftcard row, only credit if status flips from `unredeemed` → `redeemed`. Concurrent submits → one wins, the other 409s.
- Rate-limit `/portal/money/redeem` per user (e.g. 5 attempts/min) to stop brute-forcing.
- Expiry check at redeem time. Auto-mark expired cards as `revoked` on first sighting (cron not needed; do it lazily).

---

## How "admin adds money" and "kid sees balance" already work

Worth saying explicitly so we don't rebuild:

- **Admin adds money today:** `/admin/mp-bank` → log in with parent PIN → find the kid in the "Learner balances" list → click "Top up" → enter amount + reason → done. Posts to `/api/money/credit`, writes a `MpTransaction` row (`type='earn'`), increments `balanceCents`. **Already shipped in Phase 4.**
- **Kid sees balance today:** `/portal/money` → shows hero card with `XMP` balance, recent orders, recent transactions. Also visible in the header chip on `/shop`. **Already shipped in Phase 5.**
- Phase 6 *adds* the card UX layer but doesn't replace either. After Phase 6:
  - Admin's "Top up" still works exactly the same.
  - Kid's `/portal/money` adds a card-visual section + "Redeem gift card" link.

---

## File layout (planned, not built)

```
app/money/
  PLAN.md                              # existing (Phase 1-5)
  PLAN-Phase6-Cards.md                 # this file

app/give/page.tsx                      # public "send MP to a card" page
app/portal/money/card/page.tsx         # printable kid card view
app/portal/money/redeem/page.tsx       # kid redeems a gift code
app/admin/mp-bank/giftcards/page.tsx   # parent: create + print + manage codes
app/admin/mp-bank/giftcards/print/page.tsx  # print-friendly view

app/api/money/card/
  me/route.ts                          # GET — current kid's card (auto-gen if needed)
  credit/route.ts                      # POST — public deposit endpoint

app/api/money/giftcards/
  redeem/route.ts                      # POST — kid redeems

app/api/money/admin/
  card/reroll/route.ts                 # POST — new card number for a kid
  giftcards/create/route.ts            # POST — batch generate codes
  giftcards/route.ts                   # GET — list (parent-gated)
  giftcards/revoke/route.ts            # POST — kill an unredeemed code

lib/money/
  card.ts                              # generateCardNumber, lookupByCard, creditCard
  giftcard.ts                          # generateCode, redeemCode, listCards
```

## Phase ladder (proposed order — pick what to ship first)

| Step | What | Cost | Why ship it |
|---|---|---|---|
| **6a** | Account card (Concept 1) only — number gen, kid sees their card, parent reroll. No `/give` page yet. | Small | Cheapest win, immediate kid delight (printable card). Doesn't need security thinking yet. |
| **6b** | `/give` public page + abuse limits | Medium | Unlocks the grandparent flow. Need rate-limit + cap before going public. |
| **6c** | Gift cards (Concept 2) full | Medium | Independent feature; ship when you want printed-code surprise drops. |

You could ship 6a alone in one short session and pause. 6b and 6c each stand alone.

## Decisions (locked — override in-session if you change your mind)

1. **Card-as-login? NO.** Card number is receive-only. PIN remains the credential for spending. A laminated card that doubles as auth would defeat the "safe to share with Grandpa" premise. Document this in the `/give` page UI.
2. **Card numbers in URLs? YES.** `/give/7821` prefills the field. Easier for grandparents; rate-limit + per-call cap handles abuse.
3. **Capture `displayName` at register? YES — bundle into 6a.** Schema column already exists. Card looks better as "Lilly" than "lilly". Add the field to `ShopLoginForm` registration path (optional, defaults to capitalized `name`).
4. **Per-card spend cap? SKIP** until someone asks. Not needed for a small family closed loop.
5. **Gift-card receipt? SIMPLE first.** Code + amount + optional message. No decorative border, no fold lines. Fancy template is a Phase 6.5 if kids find the simple version boring.
6. **`/give` success sound? Wand sparkle.** Matches the magical / princess / unicorn aesthetic of the shop better than a "ka-ching." Reuse or generate a short Web Audio chime — no audio file dep (same call as the geography drag-match phase).

## Rules to keep (architectural discipline)

1. **Card number ≠ credential.** Never accept the card number alone as authentication.
2. **All credits hit `MpTransaction`.** Public `/give`, gift redemptions, parent top-ups — all write the same ledger. Never bypass it.
3. **Redemption is a Prisma transaction.** Lock the gift card row, flip status, credit balance, write ledger — all-or-nothing.
4. **Rate-limit public endpoints.** `/give` and `/redeem` need per-IP and per-user throttles before going live.
5. **No new currency.** Cards and gift cards both move MP. Don't invent a separate "gift balance" or "card balance."

## Cross-references

- `app/money/PLAN.md` — Phase 1-5 architecture (read first)
- `lib/money/balance.ts` — credit/debit/listTransactions; gift redemption reuses `credit()`
- `lib/money/parent.ts` — parent gate for admin endpoints
- `lib/drive-progress.ts` — normalizeUser, isValidUser

## Backlog reminders (mentioned in TODO.md, still valid)

- Parent PIN rotation UI in `/admin/mp-bank` (API exists, no UI)
- `displayName` capture at registration
- Auto-credit hooks from `/drive` (Phase 7 in PLAN.md)
- Wishlist / layaway (Phase 8)
- Daily spend cap (Phase 9)
