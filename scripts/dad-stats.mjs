// Print exact Dad outcome rates per scenario. Pure-JS port of the test
// scenarios using vitest's already-bundled deps. Just shows the numbers
// — no assertions.
//
// Usage:  node scripts/dad-stats.mjs

import { decideOutcome, scoreReason } from '../lib/money/dad.ts';

const N = 10000;

function rollMany(args) {
  const c = {
    yes_full: 0, yes_partial: 0, pickup_tab: 0,
    maybe_later: 0, no: 0, bad_luck: 0, greedy: 0,
  };
  for (let i = 0; i < N; i++) {
    const { outcome } = decideOutcome(args);
    c[outcome]++;
  }
  return c;
}

function fmt(c) {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const anyYes = ((c.yes_full + c.yes_partial + c.pickup_tab) / total) * 100;
  const f = (k) => ((c[k] / total) * 100).toFixed(1).padStart(5);
  return [
    `yes_full ${f('yes_full')}%`,
    `yes_part ${f('yes_partial')}%`,
    `pickup   ${f('pickup_tab')}%`,
    `maybe    ${f('maybe_later')}%`,
    `no       ${f('no')}%`,
    `bad_luck ${f('bad_luck')}%`,
    `greedy   ${f('greedy')}%`,
    `── ANY YES: ${anyYes.toFixed(1)}%`,
  ].join('  |  ');
}

const scenarios = [
  {
    name: 'BASELINE — first ask, generic reason, 5 MP',
    args: {
      context: 'portal',
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: 5,
      centsAsked: 500,
    },
  },
  {
    name: 'POLITE — "please dad I cleaned my room", first ask, 5 MP',
    args: {
      context: 'portal',
      reasonScore: scoreReason('please dad I cleaned my room'),
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: 5,
      centsAsked: 500,
    },
  },
  {
    name: 'LAZY — "gimme plz", first ask, 5 MP',
    args: {
      context: 'portal',
      reasonScore: scoreReason('gimme plz'),
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: 5,
      centsAsked: 500,
    },
  },
  {
    name: 'REPEAT — 2nd ask today',
    args: {
      context: 'portal',
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: -5, lastAskMs: 60 * 60_000, asksToday: 2 },
      amountDelta: 5,
      centsAsked: 500,
    },
  },
  {
    name: 'REPEAT — 3rd ask today, within 10 min',
    args: {
      context: 'portal',
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: -25 - 20, lastAskMs: 10 * 60_000, asksToday: 3 },
      amountDelta: 5,
      centsAsked: 500,
    },
  },
  {
    name: 'BIG ASK — 50,000 MP, first ask, polite reason',
    args: {
      context: 'portal',
      reasonScore: scoreReason('saving for a real bike — please dad'),
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: -15,
      centsAsked: 5_000_000,
    },
  },
  {
    name: 'HUGE — 100,000 MP, first ask, polite',
    args: {
      context: 'portal',
      reasonScore: scoreReason('saving for a car — please dad, I helped mom'),
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: -20,
      centsAsked: 10_000_000,
    },
  },
  {
    name: 'CHECKOUT — reasonable shortfall, polite',
    args: {
      context: 'checkout',
      reasonScore: scoreReason('I need help finishing this order, please'),
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: 5,
      centsAsked: 500,
      cartTotalCents: 1500,
      shortfallCents: 500,
    },
  },
  {
    name: 'CHECKOUT GREEDY — cart 10 MP, asking 1000 MP',
    args: {
      context: 'checkout',
      reasonScore: { delta: 0, spammy: false },
      cadence: { delta: 4, lastAskMs: null, asksToday: 0 },
      amountDelta: -10,
      centsAsked: 100_000,
      cartTotalCents: 1000,
      shortfallCents: 1000,
    },
  },
];

console.log(`Dad outcome distribution — ${N} rolls per scenario\n`);
for (const s of scenarios) {
  const c = rollMany(s.args);
  console.log(`  ${s.name}`);
  console.log(`    ${fmt(c)}\n`);
}
