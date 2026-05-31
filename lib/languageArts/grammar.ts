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

  // ==========================================================================
  // PARTS OF SPEECH — additional MEDIUM (adverbs, pronouns)
  // ==========================================================================

  {
    id: 'pos-m-9',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADVERB?',
    sentence: 'The baby giggled softly.',
    choices: ['baby', 'giggled', 'softly'],
    answer: 'softly',
    rule: 'An ADVERB tells HOW an action happened. "Softly" tells HOW the baby giggled.',
  },
  {
    id: 'pos-m-10',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the PRONOUN?',
    sentence: 'We packed the cooler with snacks.',
    choices: ['We', 'packed', 'cooler', 'snacks'],
    answer: 'We',
    rule: 'A PRONOUN takes the place of a noun. "We" stands in for a group of people.',
  },
  {
    id: 'pos-m-11',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'The sleepy puppy curled up on the rug.',
    choices: ['sleepy', 'puppy', 'curled', 'rug'],
    answer: 'sleepy',
    rule: 'An ADJECTIVE describes a noun. "Sleepy" tells what kind of puppy.',
  },
  {
    id: 'pos-m-12',
    skill: 'parts-of-speech',
    tier: 'medium',
    prompt: 'Which word is the ADVERB?',
    sentence: 'My sister speaks French fluently.',
    choices: ['sister', 'speaks', 'French', 'fluently'],
    answer: 'fluently',
    rule: 'An ADVERB tells HOW an action is done. "Fluently" tells HOW she speaks. (Many adverbs end in -ly.)',
  },

  // ==========================================================================
  // PARTS OF SPEECH — additional HARD
  // (mix of POS in one sentence, conjunction/preposition awareness)
  // ==========================================================================

  {
    id: 'pos-h-5',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the ADVERB?',
    sentence: 'The brave knight fought bravely.',
    choices: ['brave', 'knight', 'fought', 'bravely'],
    answer: 'bravely',
    rule: 'Adjectives describe NOUNS ("brave" describes the knight); adverbs describe VERBS ("bravely" describes HOW he fought).',
    hint: '"Brave" looks like the answer, but it describes the KNIGHT (a noun) — that\'s an adjective. The adverb describes the verb.',
  },
  {
    id: 'pos-h-6',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the ADJECTIVE?',
    sentence: 'The brave knight fought bravely.',
    choices: ['brave', 'knight', 'fought', 'bravely'],
    answer: 'brave',
    rule: 'An ADJECTIVE describes a noun. "Brave" describes the knight — that\'s what kind of knight.',
  },
  {
    id: 'pos-h-7',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the NOUN?',
    sentence: 'The shiny silver coin rolled down the hill.',
    choices: ['shiny', 'silver', 'coin', 'rolled'],
    answer: 'coin',
    rule: 'A NOUN names a thing. The coin is the thing — "shiny" and "silver" describe it (adjectives), and "rolled" is the verb.',
  },
  {
    id: 'pos-h-8',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the VERB?',
    sentence: 'Tiny snowflakes fell silently outside.',
    choices: ['Tiny', 'snowflakes', 'fell', 'silently'],
    answer: 'fell',
    rule: 'A VERB shows action. "Fell" is what the snowflakes did. ("Silently" tells HOW — that\'s an adverb.)',
  },
  {
    id: 'pos-h-9',
    skill: 'parts-of-speech',
    tier: 'hard',
    prompt: 'Which word is the PRONOUN?',
    sentence: 'Grandpa fixed the bike for them.',
    choices: ['Grandpa', 'fixed', 'bike', 'them'],
    answer: 'them',
    rule: 'A PRONOUN takes the place of a noun (a person\'s name here). "Them" stands in for some people.',
  },

  // ==========================================================================
  // SUBJECT-VERB AGREEMENT — additional MEDIUM
  // (more was/were, has/have, doesn't/don't)
  // ==========================================================================

  {
    id: 'agr-m-7',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'My socks ____ wet from the puddle.',
    choices: ['is', 'are'],
    answer: 'are',
    rule: 'Plural subject (socks) → use ARE. "My socks are…"',
  },
  {
    id: 'agr-m-8',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'That puzzle ____ very tricky.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'Singular subject (puzzle) → use IS. "That puzzle is…"',
  },
  {
    id: 'agr-m-9',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'She ____ like spicy food.',
    choices: ["don't", "doesn't"],
    answer: "doesn't",
    rule: 'He / she / it → DOESN\'T. They / we / I / you → DON\'T. "She doesn\'t…"',
  },
  {
    id: 'agr-m-10',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'They ____ have any homework today.',
    choices: ["don't", "doesn't"],
    answer: "don't",
    rule: 'They / we / I / you → DON\'T. "They don\'t…"',
  },
  {
    id: 'agr-m-11',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'My grandparents ____ in another state.',
    choices: ['lives', 'live'],
    answer: 'live',
    rule: 'Plural subject (grandparents) → no -s on the verb. "Grandparents live…"',
  },
  {
    id: 'agr-m-12',
    skill: 'agreement',
    tier: 'medium',
    prompt: 'Pick the word that fits.',
    sentence: 'One of the cookies ____ missing!',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'The subject is "one" (singular), not "cookies". "One … is missing." Watch the real subject, not the nearest noun.',
    hint: 'It sounds like "cookies" should drive the verb, but the subject is actually "one" — singular.',
  },

  // ==========================================================================
  // SUBJECT-VERB AGREEMENT — additional HARD
  // (collective nouns, "either/or", "nobody", subjunctive)
  // ==========================================================================

  {
    id: 'agr-h-5',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Either the cat or the dogs ____ been eating my snack.',
    choices: ['has', 'have'],
    answer: 'have',
    rule: 'With "either/or" or "neither/nor", the verb matches the part CLOSEST to it. "Dogs" is closest and plural → HAVE.',
    hint: 'The trick: look at the part right before the verb. "Dogs have" — plural.',
  },
  {
    id: 'agr-h-6',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Neither the boys nor their dad ____ home yet.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'With "neither/nor", the verb matches the part CLOSEST to it. "Dad" is closest and singular → IS.',
    hint: 'Look at the noun right before the blank — "dad" — singular.',
  },
  {
    id: 'agr-h-7',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Nobody in the cabins ____ a flashlight.',
    choices: ['have', 'has'],
    answer: 'has',
    rule: '"Nobody" is singular (no-BODY = not one person), so it takes HAS, even though "cabins" sounds plural.',
  },
  {
    id: 'agr-h-8',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'The family ____ on a road trip every July.',
    choices: ['go', 'goes'],
    answer: 'goes',
    rule: 'A "family" is one group acting together → singular → GOES. (Collective nouns like family, team, class take a singular verb when acting as one.)',
  },
  {
    id: 'agr-h-9',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'If I ____ you, I would say sorry.',
    choices: ['was', 'were'],
    answer: 'were',
    rule: 'For an imaginary or "wishing" situation ("If I were…"), use WERE — even with I or he/she/it. This is called the subjunctive.',
    hint: 'It SOUNDS like "was" because "I was", but for an imaginary IF, we say "If I were…".',
  },
  {
    id: 'agr-h-10',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'I wish it ____ Saturday already.',
    choices: ['was', 'were'],
    answer: 'were',
    rule: 'For a WISH or imaginary thing, use WERE — "I wish it were…" (subjunctive form).',
  },
  {
    id: 'agr-h-11',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'The herd of cattle ____ crossing the road.',
    choices: ['is', 'are'],
    answer: 'is',
    rule: 'The subject is "herd" (one group), not "cattle". A herd → IS. Collective nouns acting as one take singular verbs.',
  },
  {
    id: 'agr-h-12',
    skill: 'agreement',
    tier: 'hard',
    prompt: 'Pick the word that fits.',
    sentence: 'Each of the players ____ a uniform.',
    choices: ['need', 'needs'],
    answer: 'needs',
    rule: '"Each" is singular (each ONE) → the verb takes -s. "Each needs…"',
  },

  // ==========================================================================
  // VERB TENSE — additional MEDIUM (more irregular verbs)
  // ==========================================================================

  {
    id: 'ten-m-7',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'Grandma ____ me a sweater last winter.',
    choices: ['knits', 'knitted', 'knit'],
    answer: 'knit',
    rule: 'IRREGULAR past tense: KNIT stays KNIT in the past too (no -ed). Some verbs don\'t change!',
  },
  {
    id: 'ten-m-8',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'The little fish ____ in the bowl.',
    choices: ['swims', 'swam', 'swimmed'],
    answer: 'swam',
    rule: 'IRREGULAR past tense: SWIM → SWAM. (Not "swimmed".)',
  },
  {
    id: 'ten-m-9',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'I ____ my dollar in the couch cushions.',
    choices: ['finds', 'found', 'finded'],
    answer: 'found',
    rule: 'IRREGULAR past tense: FIND → FOUND.',
  },
  {
    id: 'ten-m-10',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'My uncle ____ us a story at bedtime.',
    choices: ['tells', 'told', 'telled'],
    answer: 'told',
    rule: 'IRREGULAR past tense: TELL → TOLD. (Not "telled".)',
  },
  {
    id: 'ten-m-11',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'She ____ the present in pretty paper.',
    choices: ['wraps', 'wrapped', 'wrap'],
    answer: 'wrapped',
    rule: 'For regular verbs ending in one short vowel + consonant, DOUBLE the last letter before adding -ed: wrap → wrapped.',
  },
  {
    id: 'ten-m-12',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'My sister ____ her bike across the field.',
    choices: ['rides', 'rode', 'rided'],
    answer: 'rode',
    rule: 'IRREGULAR past tense: RIDE → RODE.',
  },
  {
    id: 'ten-m-13',
    skill: 'tense',
    tier: 'medium',
    prompt: 'Pick the PAST tense.',
    sentence: 'The chef ____ a chocolate cake yesterday.',
    choices: ['makes', 'made', 'maked'],
    answer: 'made',
    rule: 'IRREGULAR past tense: MAKE → MADE.',
  },

  // ==========================================================================
  // VERB TENSE — additional HARD (perfect / progressive)
  // ==========================================================================

  {
    id: 'ten-h-5',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'She ____ been practicing piano since she was four.',
    choices: ['have', 'has', 'had'],
    answer: 'has',
    rule: '"Has been" + -ing = something started in the past and is STILL happening. (Present perfect progressive.) "She has been practicing…"',
  },
  {
    id: 'ten-h-6',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'We ____ already eaten when the pizza arrived.',
    choices: ['have', 'had', 'will have'],
    answer: 'had',
    rule: 'When ONE past event happened BEFORE another past event, use HAD + past form. "Had already eaten" happened before "the pizza arrived."',
  },
  {
    id: 'ten-h-7',
    skill: 'tense',
    tier: 'hard',
    prompt: 'Pick the verb form that fits.',
    sentence: 'By tomorrow night, the workers ____ finished the new playground.',
    choices: ['have', 'had', 'will have'],
    answer: 'will have',
    rule: 'For something done BEFORE a future time, use WILL HAVE + past form. "By tomorrow night, they will have finished…"',
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
