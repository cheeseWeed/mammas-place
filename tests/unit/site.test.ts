// Site-wide unit tests for the pure-function layer.
//
// Covers MP earn formulas, Dad scoring/decision/replies, inventory rules,
// gift-card code helpers, math engine generation, and the Language Arts
// content datasets. DB-backed flows (awardEarn, redeemGiftCard, etc) are
// deliberately excluded — those live in integration tests.

import { describe, it, expect, vi } from "vitest";

// Stub server-only and prisma so we can import server-side pure functions
// (computeChessReward, scoreReason, decideOutcome, generateGiftCardCode, etc)
// without dragging in a real DB client or tripping the server-only guard.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// ---- Earn formulas ----
import {
  computeMathReward,
  computeSpellingReward,
  computeLangArtsReward,
  computeGeographyReward,
  computeDriveDeckReward,
  computeDriveQuizReward,
  computeChessPuzzleReward,
  previewReward,
} from "@/lib/money/earn";

// ---- Chess reward (full games) ----
import { computeChessReward } from "@/lib/chess/reward";

// ---- Dad logic ----
import { scoreReason, decideOutcome } from "@/lib/money/dad";

// ---- Inventory rules ----
import {
  isAvailableNow,
  isInStock,
  isFeaturedToday,
  getFeaturedSelection,
  todayISO,
  type InventoryProduct,
} from "@/lib/inventory-rules";

// ---- Gift card ----
import {
  generateGiftCardCode,
  normalizeGiftCardCode,
  isWellFormedGiftCardCode,
} from "@/lib/money/gift-card";

// ---- Math engine ----
import {
  generateProblem,
  generateRound,
  type Operation,
  type Difficulty,
} from "@/lib/math/engine";

// ---- Language Arts content ----
import { HOMOPHONE_ITEMS, HOMOPHONE_SETS } from "@/lib/languageArts/homophones";
import { GRAMMAR_ITEMS } from "@/lib/languageArts/grammar";
import { PUNCTUATION_ITEMS } from "@/lib/languageArts/punctuation";
import { PHONICS_ITEMS } from "@/lib/languageArts/phonics";
import { DICTIONARY_ITEMS } from "@/lib/languageArts/dictionary";
import { THESAURUS_ITEMS } from "@/lib/languageArts/thesaurus";
import { VOCABULARY_ITEMS } from "@/lib/languageArts/vocabulary";

// =============================================================================
// 1. MP EARN FORMULA
// =============================================================================
//
// Locked rule (2026-05-30):
//   reward = 0.25 MP per question attempted (25 cents)
//          + 1.00 MP per correct × difficultyMult (100 cents × mult)
//          + accuracyBonus (Fibonacci) × sizeBonusMult × difficultyMult
//
// Fibonacci accuracy bonus (cents, at >=80%): 500 / 800 / 1300 / 2100 / 3400
// Size multiplier: min(2.0, total/25) — 10Q=0.4×, 25Q=1.0×, 50Q=2.0×, 100Q=2.0×
// Difficulty mult: easy 1.0, medium 1.5, hard 2.0 (applies to right pay + bonus)

describe("Earn formula — math rewards", () => {
  it("zero correct still pays the 0.25 MP attempt floor per question", () => {
    const r = computeMathReward({
      correct: 0,
      total: 10,
      difficulty: "easy",
      perQuestionSeconds: 10,
      avgAnswerMs: 0,
      bestStreak: 0,
      operations: "add",
    });
    // 10 questions × 25c = 250c, no right pay, no bonus (under 80%)
    expect(r.cents).toBe(250);
    expect(r.reason).toContain("Math easy");
    expect(r.reason).toContain("0/10");
  });

  it("perfect 10Q easy round = attempts + rights + Fibonacci bonus × 0.4 size mult", () => {
    const r = computeMathReward({
      correct: 10,
      total: 10,
      difficulty: "easy",
      perQuestionSeconds: 10,
      avgAnswerMs: 1000,
      bestStreak: 10,
      operations: "add",
    });
    // attempts: 10 × 25 = 250
    // right:    10 × 100 × 1.0 = 1000
    // bonus:    3400 × (10/25=0.4) × 1.0 = 1360
    // total:    2610
    expect(r.cents).toBe(2610);
  });

  it("perfect 25Q hard round nails the locked-in Fibonacci+size+difficulty math", () => {
    const r = computeMathReward({
      correct: 25,
      total: 25,
      difficulty: "hard",
      perQuestionSeconds: 10,
      avgAnswerMs: 1000,
      bestStreak: 25,
      operations: "mix",
    });
    // attempts: 25 × 25 = 625
    // right:    25 × 100 × 2.0 = 5000
    // bonus:    3400 × 1.0 × 2.0 = 6800
    // total:    12425
    expect(r.cents).toBe(12425);
  });

  it("80% medium 10Q applies the 500c Fibonacci rung × 0.4 size × 1.5 diff", () => {
    const r = computeMathReward({
      correct: 8,
      total: 10,
      difficulty: "medium",
      perQuestionSeconds: 10,
      avgAnswerMs: 1500,
      bestStreak: 5,
      operations: "add",
    });
    // attempts: 250
    // right:    8 × 100 × 1.5 = 1200
    // bonus:    500 × 0.4 × 1.5 = 300
    // total:    1750
    expect(r.cents).toBe(1750);
  });

  it("79% gets NO Fibonacci bonus", () => {
    const r = computeMathReward({
      correct: 79,
      total: 100,
      difficulty: "easy",
      perQuestionSeconds: 10,
      avgAnswerMs: 1000,
      bestStreak: 1,
      operations: "add",
    });
    // attempts: 100 × 25 = 2500
    // right:    79 × 100 = 7900
    // bonus:    0
    expect(r.cents).toBe(10400);
  });

  it("100Q exam caps size multiplier at 2.0×", () => {
    const r25 = computeMathReward({
      correct: 25, total: 25, difficulty: "easy",
      perQuestionSeconds: 10, avgAnswerMs: 1000, bestStreak: 0, operations: "add",
    });
    const r100 = computeMathReward({
      correct: 100, total: 100, difficulty: "easy",
      perQuestionSeconds: 10, avgAnswerMs: 1000, bestStreak: 0, operations: "add",
    });
    // 25Q perfect: 625 + 2500 + 3400 = 6525
    // 100Q perfect: 2500 + 10000 + 3400×2 = 19300
    // bonus portion alone goes from 3400 → 6800 (exactly 2.0×)
    expect(r25.cents).toBe(6525);
    expect(r100.cents).toBe(19300);
  });

  it("zero-total round returns 0 cents (and doesn't divide by zero)", () => {
    const r = computeMathReward({
      correct: 0, total: 0, difficulty: "easy",
      perQuestionSeconds: 10, avgAnswerMs: 0, bestStreak: 0, operations: "add",
    });
    expect(r.cents).toBe(0);
  });
});

describe("Earn formula — spelling/langArts/geography/drive/chess", () => {
  it("spelling L1 = easy, L3 = medium, L6 = hard difficulty mult", () => {
    const easy = computeSpellingReward({ correct: 10, total: 10, level: 1 });
    const med = computeSpellingReward({ correct: 10, total: 10, level: 3 });
    const hard = computeSpellingReward({ correct: 10, total: 10, level: 6 });
    // attempts 250 + right (1000/1500/2000) + bonus (1360/2040/2720)
    expect(easy.cents).toBe(2610);
    expect(med.cents).toBe(3790);
    expect(hard.cents).toBe(4970);
  });

  it("language arts tier maps directly to difficulty multiplier", () => {
    const easy = computeLangArtsReward({ correct: 10, total: 10, tier: "easy" });
    const hard = computeLangArtsReward({ correct: 10, total: 10, tier: "hard" });
    expect(easy.cents).toBe(2610);
    // hard: 250 + 2000 + (3400×0.4×2.0=2720) = 4970
    expect(hard.cents).toBe(4970);
  });

  it("geography always uses easy multiplier (round size still scales bonus)", () => {
    const small = computeGeographyReward({ correct: 5, total: 5 });
    const states = computeGeographyReward({ correct: 50, total: 50, quiz: "states" });
    // 5Q perfect easy: 125 + 500 + 3400×0.2×1.0 = 1305
    expect(small.cents).toBe(1305);
    // 50Q perfect easy: 1250 + 5000 + 3400×2.0×1.0 = 13050
    expect(states.cents).toBe(13050);
    expect(states.reason).toContain("states");
  });

  it("drive deck completion is a flat 50¢", () => {
    const r = computeDriveDeckReward({ deck: "signs-101" });
    expect(r.cents).toBe(50);
    expect(r.reason).toContain("signs-101");
  });

  it("drive quiz vs exam: exam (isFinalOrSim=true) pays at HARD rate", () => {
    const quiz = computeDriveQuizReward({
      quiz: "p1", correct: 10, total: 10, isFinalOrSim: false,
    });
    const exam = computeDriveQuizReward({
      quiz: "final", correct: 10, total: 10, isFinalOrSim: true,
    });
    expect(quiz.cents).toBe(2610);    // easy 10Q perfect
    expect(exam.cents).toBe(4970);    // hard 10Q perfect
  });

  it("chess puzzle reward: theme base + efficiency bonus when minimum moves", () => {
    const m1Min = computeChessPuzzleReward({
      result: "solved", theme: "mate-in-1", movesTaken: 1,
    });
    const m1Slow = computeChessPuzzleReward({
      result: "solved", theme: "mate-in-1", movesTaken: 3,
    });
    const gaveUp = computeChessPuzzleReward({
      result: "gave-up", theme: "mate-in-1", movesTaken: 1,
    });
    expect(m1Min.cents).toBe(75);   // 50 base + 25 efficiency
    expect(m1Slow.cents).toBe(50);  // base only
    expect(gaveUp.cents).toBe(0);
  });

  it("chess full-game reward: win vs Wizard in <=25 moves hits the 1.4× efficiency cap", () => {
    const r = computeChessReward({
      result: "win", opponent: "wizard", moveCount: 20,
    });
    // 150 × 1.0 × 1.8 × 1.4 = 378 → quantize to nearest 25¢ floor = 375
    expect(r.cents).toBe(375);
  });

  it("chess loss earns nothing regardless of opponent or moves", () => {
    const r = computeChessReward({
      result: "loss", opponent: "wizard", moveCount: 20,
    });
    expect(r.cents).toBe(0);
  });

  it("previewReward dispatches the same math as awardEarn would", () => {
    const p = previewReward({
      section: "math",
      kind: "round",
      payload: {
        correct: 10, total: 10, difficulty: "easy",
        perQuestionSeconds: 10, avgAnswerMs: 1000, bestStreak: 10, operations: "add",
      },
      idempotencyKey: "test",
    });
    expect(p.cents).toBe(2610);
  });
});

// =============================================================================
// 2. DAD scoreReason
// =============================================================================

describe("Dad scoreReason", () => {
  it("short reasons (<= 10 chars) get a -8 length penalty", () => {
    const s = scoreReason("plz");
    // length 3 → -8, also matches negative 'plz' → -5
    expect(s.delta).toBeLessThanOrEqual(-8);
  });

  it("long reasons (>= 30 chars) get a +6 length bonus", () => {
    const reason =
      "I want to save for a birthday gift for my brother because he loves chess.";
    const s = scoreReason(reason);
    // positive words: save (+5), birthday (+5), love? not in list, brother no
    // length 70+ → +6. Total positive.
    expect(s.delta).toBeGreaterThan(0);
  });

  it("politeness bonus: positive words add +5 each", () => {
    const s1 = scoreReason("filler word filler word");      // 23 chars, no hits
    const s2 = scoreReason("filler word save birthday yo"); // 28 chars, 2 hits
    expect(s2.delta - s1.delta).toBe(10);
  });

  it("negative words ('want', 'gimme', 'plz') subtract 5 each", () => {
    const s = scoreReason("longer reason text 12345"); // 24 chars, no hits
    const sWant = scoreReason("longer reason want stuff"); // 24 chars, 'want' hit
    expect(s.delta - sWant.delta).toBe(5);
  });

  it("flags spammy: 5+ of the same character in a row", () => {
    expect(scoreReason("aaaaa").spammy).toBe(true);
    expect(scoreReason("yessss").spammy).toBe(false); // 4 in a row is fine
    expect(scoreReason("yesssss please").spammy).toBe(true);
    expect(scoreReason("!!!!!").spammy).toBe(true);
    expect(scoreReason("99999").spammy).toBe(true);
  });

  it("ALL CAPS penalty fires only when >=6 letters and entirely upper", () => {
    expect(scoreReason("OK!").delta).toBe(-8); // short-length only, < 6 letters
    // Avoid polite words ("please") which now boost +6 and would mask the
    // ALL CAPS penalty. Use neutral text.
    const yelled = scoreReason("GIVE ME MP NOW DAD");
    expect(yelled.delta).toBeLessThanOrEqual(-4);
    // Mixed-case same text: no caps penalty
    const mixed = scoreReason("give me MP now dad");
    expect(mixed.delta).toBeGreaterThan(yelled.delta);
  });

  it("politeness bonus fires for 'please', 'thank you', etc.", () => {
    const neutral = scoreReason("filler word filler word"); // no hits
    const polite = scoreReason("please filler word filler word");
    // "please" substring matches BOTH "please" and "pls" — that's by design
    // (loose substring scan, capped at +12). Net polite delta is +12.
    expect(polite.delta - neutral.delta).toBeGreaterThanOrEqual(6);
    expect(polite.polite).toBe(true);
    const verySpolite = scoreReason("would you kindly send some please");
    expect(verySpolite.delta).toBeGreaterThanOrEqual(neutral.delta + 6);
    expect(verySpolite.polite).toBe(true);
  });
});

// =============================================================================
// 3. DAD decideOutcome — weight shape, not seeded random
// =============================================================================

describe("Dad decideOutcome", () => {
  // We don't seed Math.random. Instead we verify the weight bag the roller
  // uses is sensible — every yes path is reachable, no path is dominant
  // unless a trigger fires (greedy / spammy / pickup_tab).
  function runWeights(input: Parameters<typeof decideOutcome>[0]) {
    // Re-implement just enough to read what decideOutcome built; the public
    // function rolls AND returns weights, so call once with a thrown-out
    // outcome and inspect the weights.
    const result = decideOutcome(input);
    return result.weights;
  }

  it("baseline portal ask: all standard outcomes reachable, no greedy/pickup_tab", () => {
    const w = runWeights({
      context: "portal",
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: 0, lastAskMs: null, asksToday: 0 },
      amountDelta: 0,
      centsAsked: 50_00, // 50 MP
    });
    expect(w.yes_full).toBeGreaterThan(0);
    expect(w.yes_partial).toBeGreaterThan(0);
    expect(w.maybe_later).toBeGreaterThan(0);
    expect(w.no).toBeGreaterThan(0);
    expect(w.bad_luck).toBeGreaterThan(0);
    expect(w.pickup_tab).toBe(0); // portal context disables this
    expect(w.greedy).toBe(0);     // non-greedy ask
  });

  it("checkout with shortfall enables pickup_tab as a reachable outcome", () => {
    const w = runWeights({
      context: "checkout",
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: 0, lastAskMs: null, asksToday: 0 },
      amountDelta: 0,
      shortfallCents: 500,
      cartTotalCents: 2000,
      centsAsked: 500,
    });
    expect(w.pickup_tab).toBeGreaterThan(0);
  });

  it("greedy ask (checkout, ask >> cart) dominates the roll without zeroing all others", () => {
    const w = runWeights({
      context: "checkout",
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: 0, lastAskMs: null, asksToday: 0 },
      amountDelta: -10,
      shortfallCents: 0,
      cartTotalCents: 1000,    // $10 cart
      centsAsked: 50_000,      // 500 MP — way more than cart
    });
    // greedy weight set to 60 — should be the biggest by a country mile
    expect(w.greedy).toBeGreaterThan(w.yes_full);
    expect(w.greedy).toBeGreaterThan(w.no);
    expect(w.greedy).toBeGreaterThanOrEqual(60);
    expect(w.yes_full).toBe(1); // basically gone
  });

  it("spammy reason kills yes paths and boosts bad_luck/no", () => {
    const w = runWeights({
      context: "portal",
      reasonScore: { delta: 0, spammy: true },
      cadence: { delta: 0, lastAskMs: null, asksToday: 0 },
      amountDelta: 0,
      centsAsked: 100,
    });
    expect(w.yes_full).toBe(1);
    expect(w.yes_partial).toBe(1);
    expect(w.bad_luck).toBeGreaterThan(10);
  });

  it("hammering Dad (asking 4x today) drags yes weights way down", () => {
    const w = runWeights({
      context: "portal",
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: -30 - 25, lastAskMs: 5 * 60_000, asksToday: 4 },
      amountDelta: 0,
      centsAsked: 100,
    });
    // applyDelta(-55): yes_full = 30 - 55 = -25 → clamps to 1
    expect(w.yes_full).toBe(1);
  });

  it("decideOutcome always returns a valid DadOutcome literal", () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { outcome } = decideOutcome({
        context: "portal",
        reasonScore: { delta: 0, spammy: false },
        cadence: { delta: 0, lastAskMs: null, asksToday: 0 },
        amountDelta: 0,
        centsAsked: 100,
      });
      outcomes.add(outcome);
    }
    const allowed = new Set([
      "yes_full", "yes_partial", "pickup_tab",
      "maybe_later", "no", "bad_luck", "greedy",
    ]);
    for (const o of outcomes) expect(allowed.has(o)).toBe(true);
    // Sanity: should hit at least 2 different outcomes across 200 rolls
    expect(outcomes.size).toBeGreaterThan(1);
  });
});

// =============================================================================
// 4. INVENTORY RULES
// =============================================================================

describe("Inventory rules — isAvailableNow", () => {
  // Sun 2026-01-04, Wed 2026-01-07 — known weekday/week-of-month fixtures
  const sun = new Date(2026, 0, 4);  // Sunday, week 1
  const wed = new Date(2026, 0, 7);  // Wednesday, week 1
  const wed2 = new Date(2026, 0, 14); // Wednesday, week 2

  it("category 'always': no rule, available", () => {
    const p: InventoryProduct = { id: "a", availabilityRule: { type: "always" } };
    expect(isAvailableNow(p, wed)).toBe(true);
  });

  it("rule 'weekly': only available on listed days of week", () => {
    const p: InventoryProduct = {
      id: "b",
      availabilityRule: { type: "weekly", daysOfWeek: [0, 6] }, // Sun, Sat
    };
    expect(isAvailableNow(p, sun)).toBe(true);
    expect(isAvailableNow(p, wed)).toBe(false);
  });

  it("rule 'monthly': only available on listed week-of-month", () => {
    const p: InventoryProduct = {
      id: "c",
      availabilityRule: { type: "monthly", weekOfMonth: [1] },
    };
    expect(isAvailableNow(p, wed)).toBe(true);   // week 1
    expect(isAvailableNow(p, wed2)).toBe(false); // week 2
  });

  it("rule 'dated': only available on listed MM-DD dates", () => {
    const p: InventoryProduct = {
      id: "d",
      availabilityRule: { type: "dated", featuredDates: ["01-07"] },
    };
    expect(isAvailableNow(p, wed)).toBe(true);
    expect(isAvailableNow(p, wed2)).toBe(false);
  });

  it("audiobooks/study-guides override calendar rules — always available", () => {
    const p: InventoryProduct = {
      id: "e",
      isAudiobook: true,
      availabilityRule: { type: "dated", featuredDates: ["12-25"] },
    };
    expect(isAvailableNow(p, wed)).toBe(true);
  });

  it("no rule + no special category → available", () => {
    expect(isAvailableNow({ id: "x" }, wed)).toBe(true);
  });
});

describe("Inventory rules — isInStock", () => {
  it("null stockQuantity = unlimited", () => {
    expect(isInStock({ id: "a", stockQuantity: null })).toBe(true);
    expect(isInStock({ id: "a" })).toBe(true);
  });

  it("positive stock = in stock", () => {
    expect(isInStock({ id: "a", stockQuantity: 3 })).toBe(true);
  });

  it("zero stock = OUT", () => {
    expect(isInStock({ id: "a", stockQuantity: 0 })).toBe(false);
  });
});

describe("Inventory rules — getFeaturedSelection (seeded)", () => {
  const products: InventoryProduct[] = [
    { id: "a", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "b", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "c", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "d", stockQuantity: 0, availabilityRule: { type: "always" } }, // OOS
    { id: "e", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "f", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "g", stockQuantity: 5, availabilityRule: { type: "always" } },
    { id: "h", stockQuantity: 5, availabilityRule: { type: "always" } },
  ];

  it("returns clampedCount items (between 5 and 10)", () => {
    const sel = getFeaturedSelection(products, 7, "seed-1");
    expect(sel).toHaveLength(7);
  });

  it("excludes out-of-stock products", () => {
    const sel = getFeaturedSelection(products, 7, "seed-1");
    expect(sel.find((p) => p.id === "d")).toBeUndefined();
  });

  it("same seed = same order (deterministic)", () => {
    const a = getFeaturedSelection(products, 7, "seed-1");
    const b = getFeaturedSelection(products, 7, "seed-1");
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it("different seeds usually return different ordering", () => {
    const a = getFeaturedSelection(products, 7, "seed-1");
    const b = getFeaturedSelection(products, 7, "seed-2");
    // Could rarely match — but with 7 items from 7 eligible the ordering
    // should differ on at least one position.
    expect(a.map((p) => p.id).join(",")).not.toBe(b.map((p) => p.id).join(","));
  });

  it("isFeaturedToday: only true for 'dated' rules that match today", () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayMMDD = `${mm}-${dd}`;
    expect(isFeaturedToday({
      id: "x",
      availabilityRule: { type: "dated", featuredDates: [todayMMDD] },
    })).toBe(true);
    expect(isFeaturedToday({
      id: "y",
      availabilityRule: { type: "always" },
    })).toBe(false);
  });

  it("todayISO returns a YYYY-MM-DD string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// 5. GIFT CARDS
// =============================================================================

describe("Gift cards — code helpers", () => {
  it("generateGiftCardCode produces MP-XXXXXX format with 6 valid body chars", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateGiftCardCode();
      expect(code).toMatch(/^MP-[2-9A-HJ-NP-Z]{6}$/);
      expect(isWellFormedGiftCardCode(code)).toBe(true);
    }
  });

  it("isWellFormedGiftCardCode rejects malformed codes", () => {
    expect(isWellFormedGiftCardCode("MP-ABC")).toBe(false);          // too short
    expect(isWellFormedGiftCardCode("MP-ABCDEFG")).toBe(false);      // too long
    expect(isWellFormedGiftCardCode("XX-ABCDEF")).toBe(false);       // wrong prefix
    expect(isWellFormedGiftCardCode("MP-ABCDE0")).toBe(false);       // 0 not in alphabet
    expect(isWellFormedGiftCardCode("MP-ABCDE1")).toBe(false);       // 1 not in alphabet
    expect(isWellFormedGiftCardCode("MP-ABCDEI")).toBe(false);       // I not in alphabet
    expect(isWellFormedGiftCardCode("ABCDEF")).toBe(false);          // no prefix
  });

  it("normalizeGiftCardCode strips spaces, uppercases, ensures MP- prefix", () => {
    expect(normalizeGiftCardCode("mp-7k2h9n")).toBe("MP-7K2H9N");
    expect(normalizeGiftCardCode("7K2H9N")).toBe("MP-7K2H9N");
    expect(normalizeGiftCardCode("  MP-7K 2H 9N  ")).toBe("MP-7K2H9N");
    expect(normalizeGiftCardCode("mp7k2h9n")).toBe("MP-7K2H9N");
  });
});

// =============================================================================
// 6. MATH ENGINE
// =============================================================================

describe("Math engine — generateProblem", () => {
  const ops: Operation[] = ["add", "sub", "mul", "div"];
  const diffs: Difficulty[] = ["easy", "medium", "hard"];

  for (const op of ops) {
    for (const d of diffs) {
      it(`${op} / ${d}: 50 generated problems all have a valid integer answer`, () => {
        for (let i = 0; i < 50; i++) {
          const p = generateProblem(op, d);
          expect(p.op).toBe(op);
          expect(Number.isInteger(p.answer)).toBe(true);
          expect(p.prompt).toContain(String(p.b));
          // Cross-check the math
          if (op === "add") expect(p.answer).toBe(p.a + p.b);
          if (op === "sub") expect(p.answer).toBe(p.a - p.b);
          if (op === "mul") expect(p.answer).toBe(p.a * p.b);
          if (op === "div") expect(p.a).toBe(p.answer * p.b); // dividend = q × d
        }
      });
    }
  }

  it("subtraction always has answer >= 0 (operand swap)", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateProblem("sub", "hard");
      expect(p.answer).toBeGreaterThanOrEqual(0);
      expect(p.a).toBeGreaterThanOrEqual(p.b);
    }
  });

  it("division never has a remainder", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateProblem("div", "hard");
      expect(p.a % p.b).toBe(0);
      expect(p.answer).toBeGreaterThan(0);
    }
  });

  it("generateRound returns the requested number of problems", () => {
    const round = generateRound(["add", "sub"], "medium", 12);
    expect(round).toHaveLength(12);
    for (const p of round) {
      expect(["add", "sub"]).toContain(p.op);
    }
  });

  it("generateRound with empty ops falls back to 'add'", () => {
    const round = generateRound([], "easy", 5);
    expect(round).toHaveLength(5);
    for (const p of round) expect(p.op).toBe("add");
  });
});

// =============================================================================
// 7. LANGUAGE ARTS CONTENT — invariants
// =============================================================================

describe("Language Arts datasets — invariants", () => {
  // Sets where 'answer' lives inside 'choices' — applies to every drill.
  function expectAnswersInChoices<T extends { id: string; answer: string; choices: string[] }>(
    items: T[],
    label: string,
  ) {
    for (const it of items) {
      expect(it.choices, `${label} item ${it.id} has empty choices`).toBeTruthy();
      expect(it.choices.length).toBeGreaterThanOrEqual(2);
      expect(
        it.choices.includes(it.answer),
        `${label} item ${it.id} has answer "${it.answer}" not in choices`,
      ).toBe(true);
    }
  }

  function expectUniqueIds<T extends { id: string }>(items: T[], label: string) {
    const seen = new Set<string>();
    for (const it of items) {
      expect(it.id, `${label}: empty id found`).toBeTruthy();
      expect(seen.has(it.id), `${label}: duplicate id ${it.id}`).toBe(false);
      seen.add(it.id);
    }
  }

  // Homophones — special shape (no `choices` field per item; choices come from
  // the set's `words` list).
  it("homophones: every item.setId references a known set", () => {
    const setIds = new Set(HOMOPHONE_SETS.map((s) => s.id));
    for (const it of HOMOPHONE_ITEMS) {
      expect(setIds.has(it.setId), `unknown setId: ${it.setId}`).toBe(true);
    }
  });

  it("homophones: every item.answer appears in its set's words list", () => {
    const map = new Map(HOMOPHONE_SETS.map((s) => [s.id, s.words]));
    for (const it of HOMOPHONE_ITEMS) {
      const words = map.get(it.setId)!;
      expect(words.includes(it.answer), `answer "${it.answer}" not in set ${it.setId} words`).toBe(true);
    }
  });

  it("homophones: every sentence has exactly one ____ blank", () => {
    for (const it of HOMOPHONE_ITEMS) {
      const matches = it.sentence.match(/____/g);
      expect(matches?.length, `item with setId=${it.setId} blank count`).toBe(1);
    }
  });

  it("homophones: set ids are unique", () => {
    const seen = new Set<string>();
    for (const s of HOMOPHONE_SETS) {
      expect(seen.has(s.id), `duplicate set id ${s.id}`).toBe(false);
      seen.add(s.id);
    }
  });

  // Grammar
  it("grammar: items have unique ids and answers in choices", () => {
    expect(GRAMMAR_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(GRAMMAR_ITEMS, "grammar");
    expectAnswersInChoices(GRAMMAR_ITEMS, "grammar");
  });

  // Punctuation
  it("punctuation: items have unique ids and answers in choices", () => {
    expect(PUNCTUATION_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(PUNCTUATION_ITEMS, "punctuation");
    expectAnswersInChoices(PUNCTUATION_ITEMS, "punctuation");
  });

  // Phonics
  it("phonics: items have unique ids and answers in choices", () => {
    expect(PHONICS_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(PHONICS_ITEMS, "phonics");
    expectAnswersInChoices(PHONICS_ITEMS, "phonics");
  });

  // Dictionary
  it("dictionary: items have unique ids and answers in choices", () => {
    expect(DICTIONARY_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(DICTIONARY_ITEMS, "dictionary");
    expectAnswersInChoices(DICTIONARY_ITEMS, "dictionary");
  });

  // Thesaurus
  it("thesaurus: items have unique ids and answers in choices", () => {
    expect(THESAURUS_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(THESAURUS_ITEMS, "thesaurus");
    expectAnswersInChoices(THESAURUS_ITEMS, "thesaurus");
  });

  // Vocabulary
  it("vocabulary: items have unique ids and answers in choices", () => {
    expect(VOCABULARY_ITEMS.length).toBeGreaterThan(0);
    expectUniqueIds(VOCABULARY_ITEMS, "vocabulary");
    expectAnswersInChoices(VOCABULARY_ITEMS, "vocabulary");
  });
});
