# Language Arts — Phased Plan

Reading, writing, and the tricky-words layer for the mammasplace kids. Same discipline as Geography / Math / Spelling: shared learner profile (name+PIN), MP rewards routed through `/api/money/earn`, server-decided cents, idempotency-keyed.

## Architecture principles (locked in from day one)

1. **One section, many phases.** L1 = Homophones. L2-L6 are mapped in the hub as Coming Soon so the kid can see the roadmap.
2. **Content over engine for v1.** Phase L1 is hand-authored sentence items — not generated. Quality bar is "no ambiguity once the rule is known." Curated > scraped.
3. **Server is the source of truth on MP.** The drill page tells `/api/money/earn` what happened; the server picks cents via `lib/money/earn.ts → computeLangArtsReward()`. Tweak in one file.
4. **Per-set rule + hint on wrong answers.** Drilling without a rule is just punishment. When the kid misses, the rule for *this* set surfaces immediately, plus an optional item-specific hint.
5. **Tier ≠ vocabulary level.** Easy / Medium / Hard reflect difficulty of the *distinction*: 2-way pair, 3-way set, subtle/register difference.

## Phase ladder

| # | Phase | What kid does | Ship priority |
|---|---|---|---|
| **L1** | **Homophones & Confused Words** | Fill-in-the-blank sentence; pick from the set (its/it's, your/you're, their/they're/there, to/too/two, affect/effect, then/than, lose/loose, whose/who's, were/where/wear, accept/except). | ✅ **Shipped** |
| **L2** | **Grammar Basics** | Parts of speech, subject/verb agreement, tense. Choice-list answers; rule + hint on wrong. | ✅ **Shipped 2026-05-30** |
| **L3** | **Punctuation** | Commas, apostrophes, quotes, end-punct, semicolons, colons, dash vs hyphen. Mix of *fix-mode* (find the missing/wrong mark) and *fill-mode* (pick the right one). | ✅ **Shipped 2026-05-30** |
| **L4** | **Phonics & Sounds** | Vowel teams, blends, digraphs. Phonemes are word-anchored (e.g. "the *ay* in *day*"), not IPA — the kid can sound it out. | ✅ **Shipped 2026-05-30** |
| **L5** | **Dictionary Skills** | Alphabetical order, guide words, pronunciation guides, multiple definitions, POS labels, etymology. | ✅ **Shipped 2026-05-30** |
| **L6** | **Thesaurus Skills** | Synonyms, antonyms, shade of meaning, avoiding word repetition, strength scale. | ✅ **Shipped 2026-05-30** |

### Phase L2-L6 shipped notes (2026-05-30)

All five phases follow the L1 page pattern: `config → playing → results` with `<PendingEarnPrompt>` wired in. Earn payload is `('languageArts', 'drill', {correct, total, tier}, key)` — the reward calc doesn't distinguish phases (one MP curve for the whole section).

| Phase | Route | Items file | Item count (easy/med/hard) | Distinctive UI |
|---|---|---|---|---|
| L2 Grammar | `app/language-arts/grammar/page.tsx` | `lib/languageArts/grammar.ts` | 52 (20/20/12) — 20 POS / 16 agreement / 16 tense | Choice list |
| L3 Punctuation | `app/language-arts/punctuation/page.tsx` | `lib/languageArts/punctuation.ts` | 63 (24/23/16) | Two item modes: fix-mode + fill-mode |
| L4 Phonics | `app/language-arts/phonics/page.tsx` | `lib/languageArts/phonics.ts` | 72 (vowels/blends/digraphs/vowel-teams) | Word-anchored phonemes (no IPA) |
| L5 Dictionary | `app/language-arts/dictionary/page.tsx` | `lib/languageArts/dictionary.ts` | 68 | Standard choice list across 6 sub-skills |
| L6 Thesaurus | `app/language-arts/thesaurus/page.tsx` | `lib/languageArts/thesaurus.ts` | 65 | Shade-of-meaning items show the synonym group |

~360 new drill items total across the five phases.

## File layout (locked)

```
app/language-arts/
  PLAN.md                         # this file
  page.tsx                        # hub: lists phases, links to drill routes
  homophones/page.tsx             # Phase L1 — config → playing → results

lib/languageArts/
  homophones.ts                   # sets (rules), items (sentences), helpers

# Cross-section (used by every learning section):
lib/money/earn.ts                 # server-side reward calculator
lib/money/earn-client.ts          # client helper for submitting earns
app/api/money/earn/route.ts       # POST endpoint
```

## Content authoring guide (for adding items to Phase L1)

When extending `HOMOPHONE_ITEMS`:

1. **Concrete, age-appropriate context.** "The cat licked ____ paw." not "____ implications were significant."
2. **The wrong choice must be clearly wrong** once the rule is applied. If a sentence works with two of the choices, throw it out.
3. **Aim for 4-6 items per set.** Variety > volume — the kid sees the same set across rounds.
4. **Hints are optional and only for the trickiest items.** They show only after a wrong answer.

## Reward curve (the rule kids hear: "the better you do, the more you earn")

Identical to Math (and every other section). See `app/math/PLAN.md` for the worked formula. Summary:

- **0.25 MP** per question attempted (flat)
- **1.00 MP** per correct × tier multiplier (Easy 1.0×, Medium 1.5×, Hard 2.0×)
- **Fibonacci bonus** (5/8/13/21/34 MP at 80/85/90/95/100%) × size multiplier × tier

A 10-item hard homophones drill at 100% earns 49.70 MP. A 3/10 easy still pays 5.50 MP. **No daily cap.**

## Non-goals (don't build)

- Speed timer (yet). Reading-comprehension drills shouldn't reward racing.
- Open-ended typing — choice list keeps the experience deterministic and grade-able.
- Phase-gating. Kid picks any phase from the hub; no "must finish L1 to unlock L2" wall.

## When this gets touched again

- Add a new homophone set: append to `HOMOPHONE_SETS` + add 4-6 items to `HOMOPHONE_ITEMS`. No code changes.
- Add a new tier: update `HomophoneTier` union + `TIERS` array in the page.
- Phase L2+: add a `lib/languageArts/<phase>.ts` data file, a route under `app/language-arts/<phase>/page.tsx`, and flip its hub card to `shipped`.
