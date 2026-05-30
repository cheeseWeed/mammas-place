// Grammar Basics — Language Arts Phase L2 dataset.
//
// One drill, three skill threads tagged on each item:
//   - parts-of-speech : "Which word is the NOUN/VERB/ADJECTIVE/ADVERB/PRONOUN?"
//   - agreement       : subject-verb agreement, fill the blank
//   - tense           : past / present / future, fill the blank
//
// All items are multiple-choice with 2-4 buttons. Whether the kid is picking
// a word inside a sentence (parts-of-speech) or filling a blank (agreement,
// tense), the UI is the same: prompt + choices. Each item carries `skill`
// so wrong-answer analytics can later surface "you keep missing tense."
//
// Tier reflects difficulty of the rule, NOT vocabulary level:
//   - easy   : basic noun/verb in a 4-word sentence; he runs / she eats
//   - medium : adverbs, irregular verbs (go/went), future-tense will + verb
//   - hard   : tricky agreement (neither of them IS), perfect tenses (had been running)
//
// Quality bar (lock-in from L1 lessons learned):
//   - Concrete, age-appropriate context. Kid-readable rules.
//   - UNAMBIGUOUS answers. If a sentence works with two choices, throw it out.
//   - Rules are plain English, not grammar-textbook jargon.

export type GrammarTier = 'easy' | 'medium' | 'hard';

export type GrammarSkill = 'parts-of-speech' | 'agreement' | 'tense';

export type GrammarItem = {
  id: string;
  skill: GrammarSkill;
  tier: GrammarTier;
  // Short instruction shown above the sentence/choices.
  // e.g. "Which word is the VERB?" or "Pick the word that fits."
  prompt: string;
  // The sentence the kid reads. For parts-of-speech items this is the
  // sentence where one word is the answer. For fill-in-blank items this
  // contains one literal `____` token where the answer goes.
  sentence: string;
  // Choice buttons. For parts-of-speech these are usually the words of the
  // sentence (or the content words). For fill-in items these are the verb
  // forms / tenses to choose from.
  choices: string[];
  // The correct choice — must match one of `choices` exactly.
  answer: string;
  // Short rule shown after a wrong answer.
  rule: string;
  // Optional item-specific hint shown after a wrong answer.
  hint?: string;
};

// ----- Items -----
//
// Authoring conventions:
//   - parts-of-speech items: `sentence` is the full sentence; `choices` is the
//     set of words to choose from (filter out function words that aren't the
//     answer category; keep distractors that ARE the wrong category so the
//     kid has to think). NO `____` token.
//   - agreement & tense items: `sentence` contains exactly one `____`.
//     `choices` is the set of verb forms.
//   - 2-4 choices per item. Buttons are big.

export const GRAMMAR_ITEMS: GrammarItem[] = [
  // ==========================================================================
  // PARTS OF SPEECH — EASY
  // Basic noun / verb identification in short, concrete sentences.
  // ==========================================================================

  {
    id: 'pos-e-1',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the NOUN?',
    sentence: 'The dog ran fast.',
    choices: ['The', 'dog', 'ran', 'fast'],
    answer: 'dog',
    rule: 'A NOUN names a person, place, animal, or thing. "Dog" is a thing — an animal.',
  },
  {
    id: 'pos-e-2',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the VERB?',
    sentence: 'Sam jumps high.',
    choices: ['Sam', 'jumps', 'high'],
    answer: 'jumps',
    rule: 'A VERB shows action — what someone DOES. "Jumps" is the action.',
  },
  {
    id: 'pos-e-3',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the NOUN?',
    sentence: 'My sister sang loudly.',
    choices: ['sister', 'sang', 'loudly'],
    answer: 'sister',
    rule: 'A NOUN names a person, place, animal, or thing. "Sister" is a person.',
  },
  {
    id: 'pos-e-4',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the VERB?',
    sentence: 'The cat sleeps on the bed.',
    choices: ['cat', 'sleeps', 'bed'],
    answer: 'sleeps',
    rule: 'A VERB shows action OR a state of being. Sleeping is something the cat is doing.',
  },
  {
    id: 'pos-e-5',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'I have a red ball.',
    choices: ['have', 'red', 'ball'],
    answer: 'red',
    rule: 'An ADJECTIVE describes a noun — it tells what KIND, what COLOR, or how MANY. "Red" tells what color the ball is.',
  },
  {
    id: 'pos-e-6',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'Mom baked a big cake.',
    choices: ['Mom', 'big', 'cake'],
    answer: 'big',
    rule: 'An ADJECTIVE describes a noun. "Big" tells you what kind of cake.',
  },
  {
    id: 'pos-e-7',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the NOUN?',
    sentence: 'We walked to the park.',
    choices: ['walked', 'to', 'park'],
    answer: 'park',
    rule: 'A NOUN names a person, place, or thing. A park is a place.',
  },
  {
    id: 'pos-e-8',
    skill: 'parts-of-speech',
    tier: 'easy',
    prompt: 'Which word is the VERB?',
    sentence: 'Dad cooks dinner every night.',
    choices: ['Dad', 'cooks', 'dinner', 'night'],
    answer: 'cooks',
    rule: 'A VERB shows action. "Cooks" is what Dad is doing.',
  },

  // ==========================================================================
  // PARTS OF SPEECH — MEDIUM
  // Adverbs, pronouns, harder noun/verb cases.
  // ==========================================================================

  {
    id: 'pos-m-1',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADVERB?',
    sentence: 'The turtle moved slowly.',
    choices: ['turtle', 'moved', 'slowly'],
    answer: 'slowly',
    rule: 'An ADVERB describes a VERB — it tells HOW, WHEN, or WHERE something happened. Many end in -ly. "Slowly" tells HOW the turtle moved.',
  },
  {
    id: 'pos-m-2',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADVERB?',
    sentence: 'She sang loudly at the show.',
    choices: ['sang', 'loudly', 'show'],
    answer: 'loudly',
    rule: 'An ADVERB describes HOW the action happened. "Loudly" tells HOW she sang.',
  },
  {
    id: 'pos-m-3',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the PRONOUN?',
    sentence: 'She rode the bike to school.',
    choices: ['She', 'rode', 'bike', 'school'],
    answer: 'She',
    rule: 'A PRONOUN takes the place of a noun — words like he, she, it, we, they, I, you. "She" stands in for a person.',
  },
  {
    id: 'pos-m-4',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the PRONOUN?',
    sentence: 'They built a fort in the yard.',
    choices: ['They', 'built', 'fort', 'yard'],
    answer: 'They',
    rule: 'A PRONOUN takes the place of a noun. "They" stands in for some people.',
  },
  {
    id: 'pos-m-5',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADVERB?',
    sentence: 'The bus arrived early.',
    choices: ['bus', 'arrived', 'early'],
    answer: 'early',
    rule: 'An ADVERB tells HOW, WHEN, or WHERE. "Early" tells WHEN the bus arrived.',
  },
  {
    id: 'pos-m-6',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'A noisy crow sat on the fence.',
    choices: ['noisy', 'crow', 'sat', 'fence'],
    answer: 'noisy',
    rule: 'An ADJECTIVE describes a NOUN. "Noisy" tells what kind of crow.',
  },
  {
    id: 'pos-m-7',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the VERB?',
    sentence: 'The runners stretched before the race.',
    choices: ['runners', 'stretched', 'race'],
    answer: 'stretched',
    rule: 'A VERB shows action. Stretching is what the runners did.',
  },
  {
    id: 'pos-m-8',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the PRONOUN?',
    sentence: 'Mom gave the toy to him.',
    choices: ['Mom', 'gave', 'toy', 'him'],
    answer: 'him',
    rule: 'A PRONOUN takes the place of a noun — words like he, she, it, him, her, them. "Him" stands in for a person\'s name.',
  },

  // ==========================================================================
  // PARTS OF SPEECH — HARD
  // Multiple parts of speech in one sentence; trickier distinctions.
  // ==========================================================================

  {
    id: 'pos-h-1',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'The clever fox quickly escaped.',
    choices: ['clever', 'fox', 'quickly', 'escaped'],
    answer: 'clever',
    rule: 'An ADJECTIVE describes a NOUN; an ADVERB describes a VERB. "Clever" describes the FOX (noun) — that makes it an adjective.',
    hint: '"Quickly" ends in -ly so it\'s an adverb (describing HOW the fox escaped). The adjective describes the FOX.',
  },
  {
    id: 'pos-h-2',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the ADVERB?',
    sentence: 'The clever fox quickly escaped.',
    choices: ['clever', 'fox', 'quickly', 'escaped'],
    answer: 'quickly',
    rule: 'An ADVERB describes HOW an action happened. "Quickly" tells HOW the fox escaped.',
  },
  {
    id: 'pos-h-3',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the VERB?',
    sentence: 'My grandpa builds wooden boats.',
    choices: ['grandpa', 'builds', 'wooden', 'boats'],
    answer: 'builds',
    rule: 'A VERB shows action. Building is what grandpa does. ("Wooden" describes the boats — that\'s an adjective.)',
  },
  {
    id: 'pos-h-4',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the NOUN?',
    sentence: 'A loud thunderclap startled us.',
    choices: ['loud', 'thunderclap', 'startled', 'us'],
    answer: 'thunderclap',
    rule: 'A NOUN names a thing. A thunderclap is a thing — a loud sound. ("Loud" describes it, "startled" is the verb, "us" is a pronoun.)',
  },

  // ==========================================================================
  // SUBJECT-VERB AGREEMENT — EASY
  // Singular subject → singular verb. Plural subject → plural verb.
  // ==========================================================================

  {
    id: 'agr-e-1',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'He ____ to school.',
    choices: ['run', 'runs'],
    answer: 'runs',
    rule: 'When the subject is HE, SHE, or IT (one person/thing), the verb usually adds -s. He runs. She runs. It runs.',
  },
  {
    id: 'agr-e-2',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'They ____ at the park.',
    choices: ['play', 'plays'],
    answer: 'play',
    rule: 'When the subject is plural (more than one) or "they", the verb has NO -s. They play. We play. The kids play.',
  },
  {
    id: 'agr-e-3',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'The dog ____ loudly.',
    choices: ['bark', 'barks'],
    answer: 'barks',
    rule: 'One dog = singular subject = verb gets -s. The dog barks.',
  },
  {
    id: 'agr-e-4',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'My friends ____ pizza.',
    choices: ['like', 'likes'],
    answer: 'like',
    rule: 'Plural subject (friends) → verb has NO -s. My friends like pizza.',
  },
  {
    id: 'agr-e-5',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'She ____ a song.',
    choices: ['sing', 'sings'],
    answer: 'sings',
    rule: 'She / he / it → verb gets -s. She sings.',
  },
  {
    id: 'agr-e-6',
    skill: 'agreement',
    tier: 'easy',
    prompt: 'Pick the word that fits.',
    sentence: 'The babies ____ in their cribs.',
    choices: ['sleep', 'sleeps'],
    answer: 'sleep',
    rule: 'Plural subject (babies) → no -s on the verb. The babies sleep.',
  },

  // ==========================================================================
  // SUBJECT-VERB AGREEMENT — MEDIUM
  // is/are, was/were, has/have.
  // ==========================================================================

  {
    id: 'agr-m-1',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'The cookies ____ on the counter.',
    choices: ['is', 'are'],
    answer: 'are',
    rule: 'Plural subject (cookies) → use ARE. Singular subject → use IS. "The cookies are…"',
  },
  {
    id: 'agr-m-2',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'My brother ____ a new bike.',
    choices: ['have', 'has'],
    answer: 'has',
    rule: 'He / she / it → uses HAS. They / we / I → use HAVE. "My brother has…"',
  },
  {
    id: 'agr-m-3',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'The puppy ____ very small.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'Singular subject (puppy) → use IS. "The puppy is…"',
  },
  {
    id: 'agr-m-4',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'We ____ at the beach yesterday.',
    choices: ['was', 'were'],
    answer: 'were',
    rule: 'WE / YOU / THEY / plural subjects → use WERE. He / she / it / I → use WAS. "We were…"',
  },
  {
    id: 'agr-m-5',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'My grandma ____ a big garden.',
    choices: ['have', 'has'],
    answer: 'has',
    rule: 'Singular subject (grandma / she) → HAS. "My grandma has…"',
  },
  {
    id: 'agr-m-6',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'The kids ____ excited about the trip.',
    choices: ['is', 'are'],
    answer: 'are',
    rule: 'Plural subject (kids) → use ARE. "The kids are…"',
  },

  // ==========================================================================
  // SUBJECT-VERB AGREEMENT — HARD
  // Tricky subjects: "neither of them IS", "everyone HAS", collective nouns.
  // ==========================================================================

  {
    id: 'agr-h-1',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Neither of the boys ____ here.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: '"Neither" is treated as singular — it means "not one." Even when followed by "of the boys", the subject is still NEITHER, so use IS.',
    hint: 'It feels like "are" because of "boys", but the subject is actually "neither" — singular.',
  },
  {
    id: 'agr-h-2',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Everyone in the class ____ their book.',
    choices: ['have', 'has'],
    answer: 'has',
    rule: '"Everyone" is singular (every-ONE), so it takes the singular verb HAS — even though it FEELS like many people.',
  },
  {
    id: 'agr-h-3',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Each of the kids ____ a snack.',
    choices: ['get', 'gets'],
    answer: 'gets',
    rule: '"Each" is singular (each ONE), so the verb gets -s. Each gets.',
    hint: 'The subject is "each" — not "kids". "Each" means one at a time.',
  },
  {
    id: 'agr-h-4',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'The team ____ winning the game.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'A "team" is one group acting together, so it\'s singular → use IS. "The team is winning."',
  },

  // ==========================================================================
  // VERB TENSE — EASY
  // Past vs present, regular verbs.
  // ==========================================================================

  {
    id: 'ten-e-1',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the PAST tense.',
    sentence: 'Yesterday I ____ to the store.',
    choices: ['walk', 'walked'],
    answer: 'walked',
    rule: 'PAST tense = already happened. Most verbs add -ed for past: walk → walked. The clue "yesterday" tells you it\'s past.',
  },
  {
    id: 'ten-e-2',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the PRESENT tense.',
    sentence: 'Right now, she ____ a book.',
    choices: ['reads', 'read', 'will read'],
    answer: 'reads',
    rule: 'PRESENT tense = happening now. "Right now" tells you it\'s present.',
  },
  {
    id: 'ten-e-3',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the FUTURE tense.',
    sentence: 'Tomorrow we ____ swim.',
    choices: ['swim', 'swam', 'will swim'],
    answer: 'will swim',
    rule: 'FUTURE tense = hasn\'t happened yet. Use WILL + the verb. "Will swim." The clue "tomorrow" tells you it\'s future.',
  },
  {
    id: 'ten-e-4',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the PAST tense.',
    sentence: 'Last week, my dad ____ a cake.',
    choices: ['bakes', 'baked', 'will bake'],
    answer: 'baked',
    rule: 'PAST tense for regular verbs adds -ed. "Last week" tells you it already happened.',
  },
  {
    id: 'ten-e-5',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the FUTURE tense.',
    sentence: 'Next year, I ____ in 3rd grade.',
    choices: ['am', 'was', 'will be'],
    answer: 'will be',
    rule: 'FUTURE tense uses WILL. "Next year" tells you it\'s future.',
  },
  {
    id: 'ten-e-6',
    skill: 'tense',
    tier: 'easy',
    prompt: 'Pick the PRESENT tense.',
    sentence: 'Every day, she ____ her teeth.',
    choices: ['brushed', 'brushes', 'will brush'],
    answer: 'brushes',
    rule: 'PRESENT tense for things that happen regularly. "Every day" = present habit.',
  },

  // ==========================================================================
  // VERB TENSE — MEDIUM
  // Irregular past tenses: go→went, eat→ate, run→ran.
  // ==========================================================================

  {
    id: 'ten-m-1',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'Last night we ____ to the movies.',
    choices: ['go', 'goed', 'went'],
    answer: 'went',
    rule: 'Some verbs are IRREGULAR — they don\'t just add -ed. The past tense of GO is WENT. (Not "goed".)',
  },
  {
    id: 'ten-m-2',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'I ____ all my cereal this morning.',
    choices: ['eat', 'ate', 'eated'],
    answer: 'ate',
    rule: 'IRREGULAR past tense: EAT → ATE. (Not "eated".)',
  },
  {
    id: 'ten-m-3',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'The horse ____ across the field.',
    choices: ['runs', 'ran', 'runned'],
    answer: 'ran',
    rule: 'IRREGULAR past tense: RUN → RAN. (Not "runned".)',
  },
  {
    id: 'ten-m-4',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'She ____ a song at the talent show.',
    choices: ['sings', 'sang', 'singed'],
    answer: 'sang',
    rule: 'IRREGULAR past tense: SING → SANG.',
  },
  {
    id: 'ten-m-5',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'I ____ my book on the bus.',
    choices: ['leave', 'left', 'leaved'],
    answer: 'left',
    rule: 'IRREGULAR past tense: LEAVE → LEFT. (Not "leaved".)',
  },
  {
    id: 'ten-m-6',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'Mom ____ a picture of us.',
    choices: ['takes', 'took', 'taked'],
    answer: 'took',
    rule: 'IRREGULAR past tense: TAKE → TOOK.',
  },

  // ==========================================================================
  // VERB TENSE — HARD
  // Perfect / progressive tenses: had been, has been, will have, was running.
  // ==========================================================================

  {
    id: 'ten-h-1',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'By the time we got there, the show ____ already started.',
    choices: ['has', 'had', 'will have'],
    answer: 'had',
    rule: 'When ONE past thing happened BEFORE another past thing, use "had" + the verb. "Had already started" happened before "we got there."',
    hint: 'Both events are in the past. "Had started" is the EARLIER one — that\'s the past perfect.',
  },
  {
    id: 'ten-h-2',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'I ____ been waiting for an hour when she finally arrived.',
    choices: ['have', 'had', 'will have'],
    answer: 'had',
    rule: 'When you were doing something for a while BEFORE another past event, use "had been + -ing". "Had been waiting" — the waiting was happening up until "she arrived".',
  },
  {
    id: 'ten-h-3',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'While I was reading, my brother ____ a snack.',
    choices: ['makes', 'made', 'will make'],
    answer: 'made',
    rule: 'Both actions are in the past. "Was reading" was going on; "made" is what happened during it. Use simple past for the completed action.',
  },
  {
    id: 'ten-h-4',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'By next summer, she ____ finished the whole series.',
    choices: ['has', 'had', 'will have'],
    answer: 'will have',
    rule: 'For something that WILL be done BEFORE a future time, use "will have + -ed". "By next summer, she will have finished…"',
    hint: 'The action gets completed at some point BEFORE "next summer" — that\'s future perfect: WILL HAVE + past form.',
  },
];

// ----- Helpers -----

export function pickRoundItems(
  options: { tier?: GrammarTier; skills?: GrammarSkill[] },
  count: number,
): GrammarItem[] {
  let pool = GRAMMAR_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.skills && options.skills.length > 0) {
    const set = new Set(options.skills);
    pool = pool.filter((it) => set.has(it.skill));
  }
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Distribution summary (handy for sanity-checking content balance).
export function itemDistribution(): {
  total: number;
  byTier: Record<GrammarTier, number>;
  bySkill: Record<GrammarSkill, number>;
} {
  const byTier: Record<GrammarTier, number> = { easy: 0, medium: 0, hard: 0 };
  const bySkill: Record<GrammarSkill, number> = {
    'parts-of-speech': 0,
    agreement: 0,
    tense: 0,
  };
  for (const it of GRAMMAR_ITEMS) {
    byTier[it.tier]++;
    bySkill[it.skill]++;
  }
  return { total: GRAMMAR_ITEMS.length, byTier, bySkill };
}
