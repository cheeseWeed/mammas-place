# MP Money — Architecture Spec

Closed-loop family economy. Kids earn store credit (chores, grades, study units, driving practice). They spend it in `/shop`. No real money ever changes hands. Lives at `/money` (this folder is the spec home; the actual UI lives under `/shop`, `/checkout`, `/portal`, and `/admin/mp-bank`).

Pairs with `TODO.md` "Next session — MP Money" and `IMPROVEMENTS.md` #8/#9.

---

## Architecture principles (locked in from day one)

1. **One login, two worlds.** Same `name + 4-digit PIN` row in `drive_users` works for `/drive` and `/shop`. **Option A** from the TODO. No duplicate accounts. The `drive_users` table is already the shared LearnerProfile (see `prisma/schema.prisma` comment).
2. **Balance is a column, not a join.** `drive_users.balanceCents` (Int, default 0). Cheap to read on every page load. History lives in `mp_transactions`.
3. **Transactions are append-only.** Every `earn`, `spend`, `gift`, `refund`, `adjust` writes a row. Balance is the running ledger total — every credit/debit pair must net to the new balance. Never mutate transactions; reversals create a new row.
4. **Money in cents (Int), never floats.** Same rule every commerce app learns the hard way. UI formats `$X.YY` at the edge only.
5. **Parent admin is a separate gate.** A single `parent_config` row holds `parentPinHash`. Initial setup PIN is `0000` (see Reference, bottom). Stored server-side; kid PINs never grant admin access.
6. **Anonymous mode still works.** `/shop` browsing, cart, checkout flow all work without a login — but the "Place Order" button becomes "Log in to use MP Money." No fallback to fake credit cards; this replaces them entirely.
7. **Server-authoritative balance.** Browser never decides what the balance is. Every spend hits `/api/money/order` which re-reads the row, checks funds, debits, and writes the order atomically (in a Prisma transaction).
8. **Same patterns as `/drive` for auth.** Reuse `/api/drive/login`, `/api/drive/register`, `dl_user` cookie + localStorage. Shop login form mirrors `DriveLoginForm.tsx`. New `LearnerContext` exposes the current learner client-side. Don't touch the existing `AuthContext` (staff portal — different concern).

## Data model (locked)

Extend `prisma/schema.prisma`:

```prisma
model DriveUser {
  // ... existing fields ...
  balanceCents Int @default(0)  // ⭐ new
  transactions MpTransaction[]
  orders       MpOrder[]
}

model MpTransaction {
  id        String   @id @default(cuid())
  userName  String
  user      DriveUser @relation(fields: [userName], references: [name], onDelete: Cascade)
  cents     Int      // positive = credit, negative = debit
  type      String   // 'earn' | 'spend' | 'gift' | 'refund' | 'adjust'
  reason    String   // human-readable: "Chores", "Order MP-ORD-123", "Birthday gift"
  orderId   String?  // optional link if type=spend/refund
  createdAt DateTime @default(now())

  @@index([userName, createdAt])
  @@map("mp_transactions")
}

model MpOrder {
  id          String   @id @default(cuid())
  userName    String
  user        DriveUser @relation(fields: [userName], references: [name], onDelete: Cascade)
  items       Json     // [{ productId, name, qty, priceCents }]
  totalCents  Int
  status      String   @default("fulfilled") // 'fulfilled' | 'cancelled' | 'pending'
  createdAt   DateTime @default(now())

  @@index([userName, createdAt])
  @@map("mp_orders")
}

model ParentConfig {
  id            Int      @id @default(1) // singleton row
  parentPinHash String   // sha256(pin + SALT)
  updatedAt     DateTime @updatedAt

  @@map("mp_parent_config")
}
```

## Phase ladder

| # | Phase | What changes | Ship priority |
|---|---|---|---|
| **1** | **Schema + lib + APIs** | Migrate Prisma. `lib/money/balance.ts` (read, credit, debit). API: `/api/money/balance`, `/api/money/order`, `/api/money/transactions`, `/api/money/orders`. | 🟢 First |
| **2** | **Shop login + balance chip** | New `LearnerContext`. Shop-side login link in `Header.tsx`. Balance chip ("MP 12.50") when logged in. Form mirrors `DriveLoginForm`. | 🟢 Second |
| **3** | **Checkout rebuild** | Replace shipping+card with balance preview + "Pay with MP Money" button. Insufficient funds → friendly "Ask Dad to top you up." Confetti on success. | 🟢 Third |
| **4** | **Parent admin (`/admin/mp-bank`)** | Parent PIN gate. List all kids + balances. Top-up / deduct buttons (with reason). Per-kid transaction log + all-orders feed. | 🟢 Fourth |
| **5** | **Kid order history (`/portal/orders`)** | Logged-in kid sees their own past orders + balance + transactions. | 🟢 Fifth |
| 6 | Gift cards | Printable codes (`GIFT-XXXXXX`) that redeem a fixed amount. Visitors/birthdays. | Future |
| 7 | Auto-credit hooks | "Deck completed → +50¢" or "Quiz ≥80% → +25¢" callbacks from `/drive`. | Future |
| 8 | Wishlist / layaway | Out-of-funds path: add to wishlist; parent sees the ask. | Future |
| 9 | Daily spend cap | Per-kid daily max (set in parent admin). | Future |

## File layout (locked)

```
app/money/
  PLAN.md                            # this file (no UI — spec only)

app/shop/login/page.tsx               # new — name+PIN form (mirror DriveLoginForm)
app/checkout/page.tsx                 # rewrite — MP Money flow
app/admin/mp-bank/page.tsx            # new — parent dashboard
app/admin/mp-bank/login/page.tsx      # new — parent PIN gate
app/portal/orders/page.tsx            # new — kid's own order history

app/api/money/
  balance/route.ts                    # GET ?user= → { cents }
  order/route.ts                      # POST { user, items, totalCents } → debit + create order (transactional)
  transactions/route.ts               # GET ?user= → list
  orders/route.ts                     # GET ?user= → list
  credit/route.ts                     # POST { user, cents, reason } (parent-gated)
  debit/route.ts                      # POST { user, cents, reason } (parent-gated; manual adjust)
  parent/login/route.ts               # POST { pin } → sets mp_parent cookie
  parent/setup/route.ts               # POST { newPin, currentPin? } → set/change parent PIN

context/
  LearnerContext.tsx                  # new — { learner, balanceCents, refresh, login, logout }

lib/money/
  balance.ts                          # readBalance, credit, debit, listTransactions, listOrders
  parent.ts                           # parent PIN check, cookie helpers
  format.ts                           # centsToMP (display), dollarsInputToCents (parse)

components/
  ShopLoginForm.tsx                   # mirrors DriveLoginForm.tsx
  BalanceChip.tsx                     # header chip + refresh-on-mount
```

## What "shipping a phase" means

- Each phase is its own ship — no half-done flows in `master`.
- After phase 1 lands, balance is queryable but UI shows nothing yet — fine.
- Hub (`/`) and `Header.tsx` reflect "logged in vs not" without breaking anonymous shopping.
- TypeScript clean (`npx tsc --noEmit`). `npm run build` passes.

## Rules to keep (architectural discipline)

1. **Never store balance in localStorage.** Server is the only authority. Header chip fetches on mount + on `learner` change.
2. **Never accept a `cents` value from a kid client.** Order endpoint re-reads each item's price from `data/products.json` server-side and recomputes the total. Client value is a hint only.
3. **Never `update balance` outside a Prisma transaction.** Every change goes: read row → check funds → write transaction + update balance → commit (or rollback).
4. **Parent PIN setup is opt-in.** If `parent_config` row missing, first POST to `/api/money/parent/setup` with `{ newPin }` creates it. Once set, `currentPin` required to change.
5. **Don't mix /drive auth and /shop auth contexts.** Same row in the DB, but two separate React contexts — `LearnerContext` for shop, the existing `dl_user` cookie/localStorage for drive. Both read the same `name`.
6. **Order rows never deleted.** Cancellations flip status to `'cancelled'` and post a refund transaction.

## Open questions (deferred — won't block phases 1–5)

- **Top-up mechanism**: phase 4 ships manual parent top-up only. Auto-credit ("chore complete" button) → phase 7.
- **Spending caps**: phase 4 ships no caps. → phase 9.
- **Wishlist / layaway**: insufficient funds → just shows the friendly message. → phase 8.
- **Pretend goods vs real goods**: same shop, no distinction. Parent fulfills offline.
- **Tax**: skip. It's family money.

## Cross-references

- `TODO.md` — "Next session — MP Money" (this builds it)
- `IMPROVEMENTS.md` #4 / #8 / #9 (auth, accounts, payment)
- `prisma/schema.prisma` — shared LearnerProfile
- `lib/drive-progress.ts` — auth patterns to mirror (hashPin, normalizeUser, isValidPin, isValidUser)
- `components/DriveLoginForm.tsx` — login form to mirror

## Reference

- Initial parent PIN: **`0000`** — change it in `/admin/mp-bank` after first login.
- Currency: USD cents (Int) internally, displayed as `$X.YY`.
- Sentinel: `__anon__` learner = no MP Money access (same convention as `/drive`).
