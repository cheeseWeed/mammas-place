'use client';

// Browse-all-rules page for the Spelling section.
//
// Loads the static rules.json (42 rules across L0-L7), groups them by level,
// and renders expandable cards. Each card supports:
//   - click-to-speak example words (via lib/spelling/audio.speakWord)
//   - inline mini-quiz with hint / feedback / next-question
//   - "Related rules" jump links that expand + scroll to the target card
//
// Filters: level chips (All / 0..7) + live title-or-example search box.
// Expanded state mirrors into the URL hash (#rule-<id>) so a back-nav from a
// related-rule jump returns the learner to the same scroll position.
//
// Wrapped in <LoginGate section="spelling"> — same single-account auth used by
// every Spelling page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import rulesData from '@/data/spelling/rules.json';
import { speakWord } from '@/lib/spelling/audio';

// ---------- types ----------

type SpellingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type RuleExample = {
  word: string;
  explain: string;
};

type MiniQuizItem = {
  prompt: string;
  answer: string;
  hint?: string;
};

type SpellingRule = {
  id: string;
  level: SpellingLevel;
  title: string;
  shortRule: string;
  longExplanation: string;
  examples: RuleExample[];
  exceptions: string[];
  miniQuiz: MiniQuizItem[];
  relatedRules: string[];
};

const RULES = rulesData as SpellingRule[];

// ---------- presentation maps ----------

const LEVEL_EMOJI: Record<SpellingLevel, string> = {
  0: '🌱',
  1: '🐣',
  2: '🐝',
  3: '📖',
  4: '🦋',
  5: '🌳',
  6: '🏗️',
  7: '🧙',
};

const LEVEL_LABEL: Record<SpellingLevel, string> = {
  0: 'Level 0 — Letters & Sounds',
  1: 'Level 1 — Short Vowels (CVC)',
  2: 'Level 2 — Digraphs & Blends',
  3: 'Level 3 — Sight Words',
  4: 'Level 4 — Long Vowels & Silent E',
  5: 'Level 5 — Two-Syllable Words',
  6: 'Level 6 — Suffixes & Prefixes',
  7: 'Level 7 — Tricky Words',
};

const LEVEL_SHORT: Record<SpellingLevel, string> = {
  0: 'L0',
  1: 'L1',
  2: 'L2',
  3: 'L3',
  4: 'L4',
  5: 'L5',
  6: 'L6',
  7: 'L7',
};

const LEVELS: SpellingLevel[] = [0, 1, 2, 3, 4, 5, 6, 7];

// ---------- helpers ----------

/** Loose string compare for mini-quiz: trim, lowercase, collapse whitespace. */
function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function ruleMatchesSearch(rule: SpellingRule, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (rule.title.toLowerCase().includes(needle)) return true;
  return rule.examples.some((ex) => ex.word.toLowerCase().includes(needle));
}

/** Parse `#rule-<id>` from the URL hash and return the bare id, or null. */
function readHashRuleId(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash;
  if (!h || !h.startsWith('#rule-')) return null;
  const id = h.slice('#rule-'.length);
  return id || null;
}

// ---------- page ----------

export default function SpellingRulesPage() {
  return (
    <LoginGate section="spelling">
      <RulesBrowser />
    </LoginGate>
  );
}

function RulesBrowser() {
  const [search, setSearch] = useState('');
  const [activeLevel, setActiveLevel] = useState<SpellingLevel | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // ---- URL-hash sync (expand the rule referenced in the hash on mount or
  // when the user uses back/forward).
  useEffect(() => {
    const apply = () => {
      const id = readHashRuleId();
      if (id) {
        setExpandedId(id);
        // Defer scroll so the card has rendered its expanded body.
        window.setTimeout(() => {
          const el = cardRefs.current.get(id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  // Update the URL hash silently when expand state changes (so a back nav from
  // a related-rule jump returns to the same card).
  const setExpanded = useCallback((id: string | null) => {
    setExpandedId(id);
    if (typeof window === 'undefined') return;
    const newHash = id ? `#rule-${id}` : '';
    if (window.location.hash !== newHash) {
      const url = `${window.location.pathname}${window.location.search}${newHash}`;
      window.history.replaceState(null, '', url);
    }
  }, []);

  const toggleExpanded = useCallback(
    (id: string) => {
      setExpanded(expandedId === id ? null : id);
    },
    [expandedId, setExpanded],
  );

  // Jump to a related rule: expand it, scroll into view, update hash via
  // pushState so the learner can "back" out of it.
  const jumpToRule = useCallback((id: string) => {
    setExpandedId(id);
    if (typeof window !== 'undefined') {
      const url = `${window.location.pathname}${window.location.search}#rule-${id}`;
      window.history.pushState(null, '', url);
    }
    window.setTimeout(() => {
      const el = cardRefs.current.get(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  // ---- Filter + group rules ----
  const grouped = useMemo(() => {
    const filtered = RULES.filter((r) => {
      if (activeLevel !== 'all' && r.level !== activeLevel) return false;
      if (!ruleMatchesSearch(r, search)) return false;
      return true;
    });
    const byLevel = new Map<SpellingLevel, SpellingRule[]>();
    LEVELS.forEach((lvl) => byLevel.set(lvl, []));
    filtered.forEach((r) => {
      const bucket = byLevel.get(r.level);
      if (bucket) bucket.push(r);
    });
    return byLevel;
  }, [search, activeLevel]);

  const totalShown = useMemo(
    () => Array.from(grouped.values()).reduce((acc, arr) => acc + arr.length, 0),
    [grouped],
  );

  // ---- Render ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/spelling"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
          >
            ← Back to Spelling
          </Link>
        </div>

        <header className="text-center mb-8">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-3xl md:text-4xl font-black text-amber-900">
            Spelling Rules
          </h1>
          <p className="text-amber-700 text-sm mt-1">
            42 rules across 8 levels. Tap any card to dig in.
          </p>
        </header>

        {/* Search */}
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules or example words…"
            className="w-full rounded-xl border-2 border-amber-200 bg-white focus:outline-none focus:border-amber-500 px-4 py-2 text-amber-900 placeholder:text-amber-400"
          />
        </div>

        {/* Level filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <LevelChip
            active={activeLevel === 'all'}
            label="All"
            onClick={() => setActiveLevel('all')}
          />
          {LEVELS.map((lvl) => (
            <LevelChip
              key={lvl}
              active={activeLevel === lvl}
              label={`${LEVEL_EMOJI[lvl]} ${LEVEL_SHORT[lvl]}`}
              onClick={() => setActiveLevel(lvl)}
            />
          ))}
        </div>

        {/* Result count */}
        <p className="text-xs text-amber-700 mb-4">
          Showing {totalShown} of {RULES.length} rules
          {search ? ` matching "${search}"` : ''}
        </p>

        {/* Grouped rule list */}
        {totalShown === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-amber-100 p-8 text-center">
            <p className="text-amber-900 font-semibold">No rules match.</p>
            <p className="text-amber-700 text-sm mt-1">
              Try a different search term or pick another level.
            </p>
          </div>
        ) : (
          LEVELS.map((lvl) => {
            const rules = grouped.get(lvl) ?? [];
            if (rules.length === 0) return null;
            return (
              <section key={lvl} className="mb-8">
                <h2 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
                  <span aria-hidden="true">{LEVEL_EMOJI[lvl]}</span>
                  <span>{LEVEL_LABEL[lvl]}</span>
                  <span className="text-xs font-normal text-amber-600">
                    ({rules.length})
                  </span>
                </h2>
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      expanded={expandedId === rule.id}
                      onToggle={() => toggleExpanded(rule.id)}
                      onJumpToRule={jumpToRule}
                      registerRef={(el) => {
                        if (el) cardRefs.current.set(rule.id, el);
                        else cardRefs.current.delete(rule.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------- level chip ----------

function LevelChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
        active
          ? 'bg-amber-900 text-white border-amber-900'
          : 'bg-white text-amber-900 border-amber-200 hover:border-amber-400'
      }`}
    >
      {label}
    </button>
  );
}

// ---------- rule card ----------

function RuleCard({
  rule,
  expanded,
  onToggle,
  onJumpToRule,
  registerRef,
}: {
  rule: SpellingRule;
  expanded: boolean;
  onToggle: () => void;
  onJumpToRule: (id: string) => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <article
      id={`rule-${rule.id}`}
      ref={registerRef}
      className="bg-amber-50/60 rounded-2xl border-2 border-amber-200 overflow-hidden shadow-sm"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-amber-100/60 transition-colors"
      >
        <span className="inline-flex items-center gap-1 shrink-0 bg-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full">
          <span aria-hidden="true">{LEVEL_EMOJI[rule.level]}</span>
          {LEVEL_SHORT[rule.level]}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-amber-900 leading-snug">{rule.title}</h3>
          {!expanded && (
            <p className="text-sm text-amber-800/80 mt-0.5 line-clamp-1">
              {rule.shortRule}
            </p>
          )}
        </div>
        <span
          aria-hidden="true"
          className={`shrink-0 text-amber-700 text-lg transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ⌄
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-1 border-t border-amber-200 bg-white">
          <p className="text-amber-800 text-sm italic mt-3">{rule.shortRule}</p>
          <p className="text-gray-800 mt-3 leading-relaxed">
            {rule.longExplanation}
          </p>

          {/* Examples */}
          {rule.examples.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                Examples
              </h4>
              <div className="grid sm:grid-cols-3 gap-3">
                {rule.examples.map((ex, i) => (
                  <ExampleCard key={`${ex.word}-${i}`} example={ex} />
                ))}
              </div>
            </div>
          )}

          {/* Exceptions */}
          {rule.exceptions.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                Exceptions
              </h4>
              <div className="flex flex-wrap gap-2">
                {rule.exceptions.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => speakWord(ex)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-100 border border-yellow-300 text-amber-900 text-sm hover:bg-yellow-200 transition-colors"
                    aria-label={`Hear ${ex}`}
                  >
                    <span aria-hidden="true">🔊</span> {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mini-quiz */}
          {rule.miniQuiz.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                Mini-quiz
              </h4>
              <MiniQuiz items={rule.miniQuiz} />
            </div>
          )}

          {/* Related rules */}
          {rule.relatedRules.length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                Related rules
              </h4>
              <div className="flex flex-wrap gap-2">
                {rule.relatedRules.map((rid) => {
                  const target = RULES.find((r) => r.id === rid);
                  if (!target) return null;
                  return (
                    <button
                      key={rid}
                      type="button"
                      onClick={() => onJumpToRule(rid)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border-2 border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-100 transition-colors"
                    >
                      <span aria-hidden="true">{LEVEL_EMOJI[target.level]}</span>
                      {target.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- example card ----------

function ExampleCard({ example }: { example: RuleExample }) {
  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => speakWord(example.word)}
        className="inline-flex items-center gap-2 self-start font-bold text-amber-900 hover:text-amber-700 transition-colors"
        aria-label={`Hear ${example.word}`}
      >
        <span aria-hidden="true" className="text-lg">🔊</span>
        <span className="text-base">{example.word}</span>
      </button>
      <p className="text-sm text-gray-700 leading-snug">{example.explain}</p>
    </div>
  );
}

// ---------- mini-quiz ----------

type Feedback =
  | { kind: 'idle' }
  | { kind: 'correct' }
  | { kind: 'wrong'; correctAnswer: string };

function MiniQuiz({ items }: { items: MiniQuizItem[] }) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });

  const current = items[idx];

  // Reset transient state whenever the items list (different rule expanded) or
  // index changes.
  useEffect(() => {
    setValue('');
    setShowHint(false);
    setFeedback({ kind: 'idle' });
  }, [idx, items]);

  if (!current) return null;

  const submit = () => {
    if (!value.trim()) return;
    if (normalizeAnswer(value) === normalizeAnswer(current.answer)) {
      setFeedback({ kind: 'correct' });
    } else {
      setFeedback({ kind: 'wrong', correctAnswer: current.answer });
    }
  };

  const next = () => {
    setIdx((i) => (i + 1) % items.length);
  };

  return (
    <div className="bg-amber-50 rounded-xl border-2 border-amber-200 p-4">
      <p className="text-xs text-amber-700 mb-1">
        Question {idx + 1} of {items.length}
      </p>
      <p className="text-gray-900 font-medium mb-3">{current.prompt}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={feedback.kind !== 'idle'}
          placeholder="Type your answer…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 min-w-[140px] rounded-xl border-2 border-amber-200 bg-white focus:outline-none focus:border-amber-500 px-3 py-2 text-amber-900 placeholder:text-amber-400 disabled:bg-amber-100"
        />
        {feedback.kind === 'idle' ? (
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 transition-colors"
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="px-4 py-2 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 transition-colors"
          >
            Next →
          </button>
        )}
        {current.hint && feedback.kind === 'idle' && (
          <button
            type="button"
            onClick={() => setShowHint(true)}
            className="px-3 py-2 rounded-xl bg-yellow-100 border-2 border-yellow-300 text-amber-900 text-sm font-semibold hover:bg-yellow-200 transition-colors"
          >
            Hint
          </button>
        )}
      </form>

      {showHint && current.hint && feedback.kind === 'idle' && (
        <p className="mt-3 text-sm text-amber-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          💡 {current.hint}
        </p>
      )}

      {feedback.kind === 'correct' && (
        <p className="mt-3 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ Got it!
        </p>
      )}

      {feedback.kind === 'wrong' && (
        <p className="mt-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ✗ Not quite — the answer is{' '}
          <span className="font-bold">{feedback.correctAnswer}</span>.
        </p>
      )}
    </div>
  );
}
