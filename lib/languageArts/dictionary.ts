// Dictionary Skills — Language Arts Phase L5 dataset.
//
// Six sub-skills, all solvable WITHOUT having a dictionary actually open —
// the drill teaches the SKILL of using one:
//
//   - alpha-order:        which word comes first alphabetically
//   - guide-words:        given page guide words like "frog/giant",
//                         which word would land on this page
//   - pronunciation:      match a respelled pronunciation to the word
//                         (no IPA — "ri-MEM-ber", "boo-TIFF-ul")
//   - multiple-meanings:  pick the meaning that fits the sentence's context
//                         (bank you save money in vs bank of a river)
//   - pos-labels:         given a dictionary entry header, identify the
//                         part of speech (n., v., adj., adv.)
//   - etymology:          which language a word came from (light touch)
//
// Tier is about difficulty of the skill instance, not vocabulary level:
//   - easy   : single-letter alpha-order, obvious guide-word fits,
//              noun vs verb labels
//   - medium : 2-3 letter alpha-order ties, 3-syllable pronunciations,
//              multiple meanings with strong context
//   - hard   : etymology, subtle multiple meanings, pronunciation with
//              stress marks (ree-mem-BER vs ri-MEM-ber)
//
// Hand-curated for a homeschool-quality bar. Real kid-familiar words only —
// no made-up examples.

export type DictionarySkill =
  | 'alpha-order'
  | 'guide-words'
  | 'pronunciation'
  | 'multiple-meanings'
  | 'pos-labels'
  | 'etymology';

export type DictionaryTier = 'easy' | 'medium' | 'hard';

export type DictionaryItem = {
  id: string;
  skill: DictionarySkill;
  tier: DictionaryTier;
  // What the kid sees as the question.
  prompt: string;
  // Optional surrounding sentence (used for multiple-meanings).
  context?: string;
  // Multiple-choice options shown as buttons.
  choices: string[];
  // The correct choice — must be one of `choices`, case-preserving.
  answer: string;
  // Kid-readable explanation shown after a wrong answer. Optional but
  // strongly encouraged so the drill teaches, not just tests.
  rule?: string;
};

// ---------------------------------------------------------------------------
// SKILL LABELS — used in UI badges and the config picker.
// ---------------------------------------------------------------------------

export const DICTIONARY_SKILLS: { key: DictionarySkill; label: string; emoji: string }[] = [
  { key: 'alpha-order',       label: 'Alphabetical order', emoji: '🔤' },
  { key: 'guide-words',       label: 'Guide words',         emoji: '📖' },
  { key: 'pronunciation',     label: 'Pronunciation',       emoji: '🗣️' },
  { key: 'multiple-meanings', label: 'Multiple meanings',   emoji: '🎭' },
  { key: 'pos-labels',        label: 'Parts of speech',     emoji: '🏷️' },
  { key: 'etymology',         label: 'Word origins',        emoji: '🌍' },
];

export function getSkillLabel(skill: DictionarySkill): string {
  return DICTIONARY_SKILLS.find((s) => s.key === skill)?.label ?? skill;
}

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------

export const DICTIONARY_ITEMS: DictionaryItem[] = [
  // =========================================================================
  // ALPHABETICAL ORDER
  // =========================================================================

  // -- easy: single-letter differences --
  {
    id: 'alpha-e-1',
    skill: 'alpha-order', tier: 'easy',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['cat', 'dog', 'apple', 'bird'],
    answer: 'apple',
    rule: 'Compare first letters: a, b, c, d. "a" comes first.',
  },
  {
    id: 'alpha-e-2',
    skill: 'alpha-order', tier: 'easy',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['zebra', 'monkey', 'lion', 'tiger'],
    answer: 'lion',
    rule: 'l, m, t, z — l comes first.',
  },
  {
    id: 'alpha-e-3',
    skill: 'alpha-order', tier: 'easy',
    prompt: 'Which word comes LAST in alphabetical order?',
    choices: ['apple', 'banana', 'cherry', 'date'],
    answer: 'date',
    rule: 'a, b, c, d — d is the last letter, so date is last.',
  },
  {
    id: 'alpha-e-4',
    skill: 'alpha-order', tier: 'easy',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['rock', 'sand', 'mud', 'tree'],
    answer: 'mud',
    rule: 'm comes before r, s, and t.',
  },
  {
    id: 'alpha-e-5',
    skill: 'alpha-order', tier: 'easy',
    prompt: 'Which word comes FIRST?',
    choices: ['fish', 'horse', 'goat', 'eagle'],
    answer: 'eagle',
    rule: 'e, f, g, h — e is earliest.',
  },

  // -- medium: same first letter, look at the 2nd or 3rd --
  {
    id: 'alpha-m-1',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['stone', 'star', 'storm', 'stick'],
    answer: 'star',
    rule: 'All start with "st". Compare the 3rd letter: a, i, o, o. "star" (a) wins.',
  },
  {
    id: 'alpha-m-2',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['plate', 'plant', 'place', 'plain'],
    answer: 'place',
    rule: 'All start with "pl". 3rd letters: a, a, a, a (tie). 4th letters: c, i, n, t. "place" (c) wins.',
  },
  {
    id: 'alpha-m-3',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes LAST in alphabetical order?',
    choices: ['brown', 'broad', 'brave', 'brick'],
    answer: 'brown',
    rule: 'All start with "br". 3rd letters: a, i, o, o — "brown" and "broad" tie. 4th letters: a, w. "brown" wins.',
  },
  {
    id: 'alpha-m-4',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['chair', 'cheese', 'cherry', 'child'],
    answer: 'chair',
    rule: 'All start with "ch". 3rd letters: a, e, e, i. "a" comes first.',
  },
  {
    id: 'alpha-m-5',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes SECOND in alphabetical order?',
    choices: ['rabbit', 'racoon', 'rake', 'rain'],
    answer: 'racoon',
    rule: 'All start with "ra". 3rd letters: b, c, i, k. Order: rabbit, racoon, rain, rake.',
  },
  {
    id: 'alpha-m-6',
    skill: 'alpha-order', tier: 'medium',
    prompt: 'Which word comes FIRST in alphabetical order?',
    choices: ['friend', 'fresh', 'fright', 'french'],
    answer: 'french',
    rule: 'All start with "fr". 3rd letters: e, e, e, i. The "e" group ties. 4th letters: n, n, s, — "french" and "friend" still tie at "n". 5th: c vs d. "french" wins.',
  },

  // =========================================================================
  // GUIDE WORDS
  // =========================================================================
  // Guide words are the two words printed at the top of a dictionary page —
  // first entry and last entry. A word is on that page if it falls between
  // them alphabetically (inclusive).

  // -- easy: clear matches, far apart --
  {
    id: 'guide-e-1',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: frog / giant. Which word is on this page?',
    choices: ['apple', 'fudge', 'horse', 'zebra'],
    answer: 'fudge',
    rule: '"fudge" comes after "frog" and before "giant", so it lands on this page.',
  },
  {
    id: 'guide-e-2',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: cat / cup. Which word is on this page?',
    choices: ['cave', 'apple', 'dog', 'zoo'],
    answer: 'cave',
    rule: '"cave" (ca-v) comes after "cat" (ca-t) and before "cup" (cu-). It lands on this page.',
  },
  {
    id: 'guide-e-3',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: apple / arrow. Which word is on this page?',
    choices: ['ant', 'arctic', 'August', 'banana'],
    answer: 'arctic',
    rule: '"arctic" comes after "apple" (ap < ar) and before "arrow" (arc < arr). On the page.',
  },
  {
    id: 'guide-e-4',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: sand / stop. Which word is on this page?',
    choices: ['rain', 'sleep', 'tree', 'puppy'],
    answer: 'sleep',
    rule: '"sleep" starts with "sl" — between "sa" (sand) and "st" (stop). On the page.',
  },
  {
    id: 'guide-e-5',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: bear / book. Which word would you find on this page?',
    choices: ['ant', 'bird', 'cat', 'dog'],
    answer: 'bird',
    rule: '"bird" starts with "bi" — between "be" (bear) and "bo" (book). On the page.',
  },
  {
    id: 'guide-e-6',
    skill: 'guide-words', tier: 'easy',
    prompt: 'Page guide words: mouse / nest. Which word is on this page?',
    choices: ['monkey', 'music', 'octopus', 'apple'],
    answer: 'music',
    rule: '"music" (mu-s) comes after "mouse" (mo-u) and before "nest" (n-). It lands on the page. (monkey is "mo-n" — earlier than "mouse".)',
  },

  // -- medium: closer guide words, requires careful comparison --
  {
    id: 'guide-m-1',
    skill: 'guide-words', tier: 'medium',
    prompt: 'Page guide words: garden / glass. Which word is on this page?',
    choices: ['gate', 'goat', 'fall', 'happy'],
    answer: 'gate',
    rule: '"gate" (ga-t) comes after "garden" (ga-r) and before "glass" (gl-). On the page.',
  },
  {
    id: 'guide-m-2',
    skill: 'guide-words', tier: 'medium',
    prompt: 'Page guide words: paint / party. Which word is on this page?',
    choices: ['pancake', 'parent', 'pencil', 'puppy'],
    answer: 'parent',
    rule: '"parent" (pa-r-e) comes after "paint" (pa-i) and before "party" (pa-r-t). On the page.',
  },
  {
    id: 'guide-m-3',
    skill: 'guide-words', tier: 'medium',
    prompt: 'Page guide words: river / rocket. Which word is on this page?',
    choices: ['rain', 'robin', 'rope', 'apple'],
    answer: 'robin',
    rule: '"robin" (ro-b) comes after "river" (ri-) and before "rocket" (ro-c). On the page.',
  },
  {
    id: 'guide-m-4',
    skill: 'guide-words', tier: 'medium',
    prompt: 'Page guide words: dance / dinner. Which word is on this page?',
    choices: ['dad', 'desk', 'dog', 'duck'],
    answer: 'desk',
    rule: '"desk" (de-) comes after "dance" (da-) and before "dinner" (di-). On the page.',
  },
  {
    id: 'guide-m-5',
    skill: 'guide-words', tier: 'medium',
    prompt: 'Page guide words: smile / snow. Which word would be on this page?',
    choices: ['small', 'snake', 'spider', 'sun'],
    answer: 'snake',
    rule: '"snake" (sn-a) comes after "smile" (sm-) and before "snow" (sn-o). On the page.',
  },

  // =========================================================================
  // PRONUNCIATION GUIDES
  // =========================================================================
  // Simple respellings, NOT IPA. Capitals = stressed syllable.

  // -- easy: 2-syllable, obvious --
  {
    id: 'pron-e-1',
    skill: 'pronunciation', tier: 'easy',
    prompt: 'Which word is pronounced "HAP-ee"?',
    choices: ['happy', 'help', 'hippo', 'hope'],
    answer: 'happy',
    rule: '"HAP-ee" — first syllable HAP (rhymes with "cap"), second is "ee". That spells happy.',
  },
  {
    id: 'pron-e-2',
    skill: 'pronunciation', tier: 'easy',
    prompt: 'Which word is pronounced "MUN-kee"?',
    choices: ['mummy', 'monkey', 'money', 'munch'],
    answer: 'monkey',
    rule: '"MUN-kee" = monkey. (Money is "MUN-ee" — no "k" sound.)',
  },
  {
    id: 'pron-e-3',
    skill: 'pronunciation', tier: 'easy',
    prompt: 'Which word is pronounced "WIN-doh"?',
    choices: ['winter', 'window', 'wind', 'wonder'],
    answer: 'window',
    rule: '"doh" sounds like "dough" — that\'s the "dow" in win-dow.',
  },
  {
    id: 'pron-e-4',
    skill: 'pronunciation', tier: 'easy',
    prompt: 'Which word is pronounced "RAB-it"?',
    choices: ['robot', 'rabbit', 'ribbon', 'racket'],
    answer: 'rabbit',
    rule: '"RAB-it" — RAB (like "cab" with R) + "it". That\'s rabbit.',
  },
  {
    id: 'pron-e-5',
    skill: 'pronunciation', tier: 'easy',
    prompt: 'Which word is pronounced "JUM-pur"?',
    choices: ['jumper', 'jumped', 'jumping', 'jelly'],
    answer: 'jumper',
    rule: '"JUM-pur" ends with the "-er" sound spelled "pur". That\'s jumper.',
  },

  // -- medium: 3-syllable --
  {
    id: 'pron-m-1',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "el-uh-fant"?',
    choices: ['element', 'elephant', 'eleven', 'elevator'],
    answer: 'elephant',
    rule: '3 syllables: el + uh + fant. The "ph" sounds like "f". That\'s elephant.',
  },
  {
    id: 'pron-m-2',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "ba-NAN-uh"?',
    choices: ['bandana', 'banana', 'banjo', 'bandit'],
    answer: 'banana',
    rule: '3 syllables, stress on the middle: ba-NAN-uh = banana.',
  },
  {
    id: 'pron-m-3',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "TEL-uh-fohn"?',
    choices: ['telegram', 'telescope', 'telephone', 'television'],
    answer: 'telephone',
    rule: '"fohn" = "phone" (the "ph" sound). TEL-uh-fohn is telephone.',
  },
  {
    id: 'pron-m-4',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "boo-TIFF-ul"?',
    choices: ['beautiful', 'butterfly', 'beetle', 'bountiful'],
    answer: 'beautiful',
    rule: '"boo" (the "beau") + "TIFF" (the "ti") + "ul" (the "ful"). Spells beautiful.',
  },
  {
    id: 'pron-m-5',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "AN-uh-mul"?',
    choices: ['animal', 'admiral', 'almond', 'antenna'],
    answer: 'animal',
    rule: 'AN-uh-mul = animal. The middle "uh" is a soft, unstressed vowel.',
  },
  {
    id: 'pron-m-6',
    skill: 'pronunciation', tier: 'medium',
    prompt: 'Which word is pronounced "fa-MIL-ee"?',
    choices: ['familiar', 'family', 'famous', 'farming'],
    answer: 'family',
    rule: 'fa-MIL-ee = family. (Familiar is longer: fa-MIL-yur.)',
  },

  // -- hard: stress marks matter; same letters, different stress --
  {
    id: 'pron-h-1',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "ri-MEM-ber" (stress on MEM)?',
    choices: ['remember', 'remainder', 'reminder', 'reminded'],
    answer: 'remember',
    rule: 'ri-MEM-ber = remember. The middle syllable MEM gets the stress.',
  },
  {
    id: 'pron-h-2',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "PRE-zent" (stress on PRE — a gift)?',
    choices: ['present (a gift)', 'present (to give)', 'pretend', 'prevent'],
    answer: 'present (a gift)',
    rule: 'Same spelling, different stress! PRE-zent (noun) = a gift. pre-ZENT (verb) = to give/show. Stress changes the meaning.',
  },
  {
    id: 'pron-h-3',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "pre-ZENT" (stress on ZENT — to give a speech)?',
    choices: ['present (a gift)', 'present (to give)', 'prevent', 'pretend'],
    answer: 'present (to give)',
    rule: 'pre-ZENT (verb) = to give or show. Stressing the second syllable turns the gift into the action of giving.',
  },
  {
    id: 'pron-h-4',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "REK-urd" (stress on REK — like a vinyl)?',
    choices: ['record (a disc)', 'record (to tape)', 'reckon', 'reckless'],
    answer: 'record (a disc)',
    rule: 'REK-urd (noun) = a disc or written history. ri-KORD (verb) = to capture. Stress moves to the end for the verb.',
  },
  {
    id: 'pron-h-5',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "ri-KORD" (stress on KORD — to tape something)?',
    choices: ['record (a disc)', 'record (to tape)', 'recall', 'reward'],
    answer: 'record (to tape)',
    rule: 'ri-KORD (verb) = to tape or write down. REK-urd (noun) = the disc or the saved info.',
  },
  {
    id: 'pron-h-6',
    skill: 'pronunciation', tier: 'hard',
    prompt: 'Which word is pronounced "kuh-LEK-shun"?',
    choices: ['collection', 'connection', 'correction', 'conviction'],
    answer: 'collection',
    rule: 'kuh-LEK-shun = collection. The "-tion" ending is always "shun".',
  },

  // =========================================================================
  // MULTIPLE MEANINGS
  // =========================================================================
  // The kid sees a sentence using a word that has many meanings, then picks
  // the meaning that fits THIS sentence.

  // -- medium: strong context, common multi-meaning words --
  {
    id: 'multi-m-1',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "bank" fits this sentence?',
    context: 'I keep my allowance in the bank.',
    choices: [
      'a place that holds money',
      'the side of a river',
      'a row of switches',
      'to tilt an airplane',
    ],
    answer: 'a place that holds money',
    rule: 'The word "allowance" tells you this is about money — so "bank" means the money place.',
  },
  {
    id: 'multi-m-2',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "bank" fits this sentence?',
    context: 'We fished from the grassy bank of the river.',
    choices: [
      'a place that holds money',
      'the side of a river',
      'a row of switches',
      'to tilt sideways',
    ],
    answer: 'the side of a river',
    rule: '"Grassy" and "river" point to land — the bank is the river\'s edge.',
  },
  {
    id: 'multi-m-3',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "bat" fits this sentence?',
    context: 'A bat flew out of the cave at sunset.',
    choices: [
      'a flying mammal',
      'a wooden stick for hitting baseballs',
      'to blink quickly',
      'to take a turn hitting',
    ],
    answer: 'a flying mammal',
    rule: '"Flew" and "cave" point to the animal kind of bat.',
  },
  {
    id: 'multi-m-4',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "bat" fits this sentence?',
    context: 'She swung the bat and hit a home run.',
    choices: [
      'a flying mammal',
      'a wooden stick for hitting baseballs',
      'to blink quickly',
      'a heavy blanket',
    ],
    answer: 'a wooden stick for hitting baseballs',
    rule: '"Swung" and "home run" mean baseball — the bat is the stick.',
  },
  {
    id: 'multi-m-5',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "spring" fits this sentence?',
    context: 'Tulips bloom in the spring.',
    choices: [
      'the season after winter',
      'a coiled metal piece',
      'a small water source',
      'to jump up suddenly',
    ],
    answer: 'the season after winter',
    rule: '"Tulips bloom" — that\'s the season of spring, when flowers come out.',
  },
  {
    id: 'multi-m-6',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "spring" fits this sentence?',
    context: 'The cat will spring at the dangling string.',
    choices: [
      'the season after winter',
      'a coiled metal piece',
      'a small water source',
      'to jump up suddenly',
    ],
    answer: 'to jump up suddenly',
    rule: 'A cat at a string — the action is leaping or pouncing. That\'s "spring" as a verb.',
  },
  {
    id: 'multi-m-7',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "fly" fits this sentence?',
    context: 'A fly landed on my sandwich.',
    choices: [
      'a small buzzing insect',
      'to travel through the air',
      'the front opening of pants',
      'a fishing lure',
    ],
    answer: 'a small buzzing insect',
    rule: '"Landed on a sandwich" — that\'s the bug, not the verb.',
  },
  {
    id: 'multi-m-8',
    skill: 'multiple-meanings', tier: 'medium',
    prompt: 'Which meaning of "trunk" fits this sentence?',
    context: 'The elephant lifted the log with its trunk.',
    choices: [
      'an elephant\'s long nose',
      'the main stem of a tree',
      'a large storage box',
      'the back of a car',
    ],
    answer: 'an elephant\'s long nose',
    rule: '"Elephant" — that\'s the long nose meaning of trunk.',
  },

  // -- hard: subtle context --
  {
    id: 'multi-h-1',
    skill: 'multiple-meanings', tier: 'hard',
    prompt: 'Which meaning of "light" fits this sentence?',
    context: 'This bag is very light — I can carry it with one finger.',
    choices: [
      'not heavy',
      'brightness from the sun or a lamp',
      'pale in color',
      'to set on fire',
    ],
    answer: 'not heavy',
    rule: '"One finger" tells you weight is the point — light means not heavy here.',
  },
  {
    id: 'multi-h-2',
    skill: 'multiple-meanings', tier: 'hard',
    prompt: 'Which meaning of "light" fits this sentence?',
    context: 'She wore a light blue dress.',
    choices: [
      'not heavy',
      'brightness from the sun',
      'pale in color',
      'to ignite',
    ],
    answer: 'pale in color',
    rule: '"Light blue" describes the shade — pale blue, not weight or brightness.',
  },
  {
    id: 'multi-h-3',
    skill: 'multiple-meanings', tier: 'hard',
    prompt: 'Which meaning of "run" fits this sentence?',
    context: 'There\'s a run in my stocking.',
    choices: [
      'to move fast on foot',
      'a long tear in fabric',
      'to operate a machine',
      'a small stream',
    ],
    answer: 'a long tear in fabric',
    rule: 'A "run" in stockings is a vertical tear — common laundry word that catches people off guard.',
  },
  {
    id: 'multi-h-4',
    skill: 'multiple-meanings', tier: 'hard',
    prompt: 'Which meaning of "play" fits this sentence?',
    context: 'We watched a play about pilgrims at the theater.',
    choices: [
      'to have fun',
      'a story performed by actors',
      'to make music with an instrument',
      'a turn in a game',
    ],
    answer: 'a story performed by actors',
    rule: '"At the theater" — a play is a live show with actors.',
  },
  {
    id: 'multi-h-5',
    skill: 'multiple-meanings', tier: 'hard',
    prompt: 'Which meaning of "park" fits this sentence?',
    context: 'Dad will park the car in the garage.',
    choices: [
      'an area of grass with playground equipment',
      'to leave a vehicle in a spot',
      'a stretch of national land',
      'a sports stadium',
    ],
    answer: 'to leave a vehicle in a spot',
    rule: '"The car in the garage" makes "park" the action of stopping a car.',
  },

  // =========================================================================
  // PARTS OF SPEECH LABELS
  // =========================================================================
  // Dictionary entries usually abbreviate the part of speech:
  //   n. = noun, v. = verb, adj. = adjective, adv. = adverb,
  //   pron. = pronoun, prep. = preposition, conj. = conjunction

  // -- easy: classic noun / verb / adj distinction --
  {
    id: 'pos-e-1',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "apple, n." — what kind of word is "apple"?',
    choices: ['a noun (thing)', 'a verb (action)', 'an adjective (description)', 'an adverb (how)'],
    answer: 'a noun (thing)',
    rule: '"n." is short for noun — a person, place, or thing. An apple is a thing.',
  },
  {
    id: 'pos-e-2',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "run, v." — what kind of word is "run"?',
    choices: ['a noun (thing)', 'a verb (action)', 'an adjective (description)', 'an adverb (how)'],
    answer: 'a verb (action)',
    rule: '"v." is short for verb — an action word. Running is something you do.',
  },
  {
    id: 'pos-e-3',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "happy, adj." — what kind of word is "happy"?',
    choices: ['a noun', 'a verb', 'an adjective (description)', 'an adverb'],
    answer: 'an adjective (description)',
    rule: '"adj." is short for adjective — a describing word. "Happy" describes how someone feels.',
  },
  {
    id: 'pos-e-4',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "quickly, adv." — what kind of word is "quickly"?',
    choices: ['a noun', 'a verb', 'an adjective', 'an adverb (how something is done)'],
    answer: 'an adverb (how something is done)',
    rule: '"adv." is short for adverb — tells HOW, WHEN, or WHERE an action happens. "Quickly" tells how.',
  },
  {
    id: 'pos-e-5',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "garden, n." — what kind of word is "garden"?',
    choices: ['a noun (a place)', 'a verb', 'an adjective', 'an adverb'],
    answer: 'a noun (a place)',
    rule: '"n." = noun. A garden is a place — that\'s a noun.',
  },
  {
    id: 'pos-e-6',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "jump, v." — what kind of word is "jump"?',
    choices: ['a noun', 'a verb (an action)', 'an adjective', 'an adverb'],
    answer: 'a verb (an action)',
    rule: '"v." = verb = action. Jumping is something you do.',
  },
  {
    id: 'pos-e-7',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "tall, adj." — what kind of word is "tall"?',
    choices: ['a noun', 'a verb', 'an adjective (a description)', 'an adverb'],
    answer: 'an adjective (a description)',
    rule: '"adj." = adjective. "Tall" describes a noun — a tall tree, a tall person.',
  },
  {
    id: 'pos-e-8',
    skill: 'pos-labels', tier: 'easy',
    prompt: 'Dictionary entry: "slowly, adv." — what kind of word is "slowly"?',
    choices: ['a noun', 'a verb', 'an adjective', 'an adverb (tells how)'],
    answer: 'an adverb (tells how)',
    rule: '"adv." = adverb. "Slowly" tells HOW an action is done — most words ending in "-ly" are adverbs.',
  },

  // =========================================================================
  // ETYMOLOGY / WORD ORIGINS
  // =========================================================================
  // Light touch — kid-familiar words with well-known origins. The point is
  // to know dictionaries often tell you what language a word came from.

  {
    id: 'etym-h-1',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "pizza" come from?',
    choices: ['Italian', 'French', 'Spanish', 'German'],
    answer: 'Italian',
    rule: 'Pizza is from Italy — the word "pizza" came into English from Italian in the 1800s.',
  },
  {
    id: 'etym-h-2',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "kindergarten" come from?',
    choices: ['English', 'German', 'French', 'Latin'],
    answer: 'German',
    rule: 'Kindergarten is German — "kinder" means children and "garten" means garden. A "garden of children".',
  },
  {
    id: 'etym-h-3',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "ballet" come from?',
    choices: ['Italian', 'French', 'Russian', 'English'],
    answer: 'French',
    rule: 'Ballet is from French — that\'s why the "t" is silent at the end.',
  },
  {
    id: 'etym-h-4',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "taco" come from?',
    choices: ['Italian', 'Spanish', 'French', 'Portuguese'],
    answer: 'Spanish',
    rule: 'Taco is from Spanish, originally from Mexico.',
  },
  {
    id: 'etym-h-5',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "ketchup" come from?',
    choices: ['English', 'French', 'Chinese', 'Italian'],
    answer: 'Chinese',
    rule: 'Surprise! Ketchup comes from a Chinese word "kê-tsiap" — a fish sauce. Tomato ketchup came later.',
  },
  {
    id: 'etym-h-6',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "pajamas" come from?',
    choices: ['English', 'French', 'Hindi/Urdu', 'Japanese'],
    answer: 'Hindi/Urdu',
    rule: 'Pajamas come from "pae jama" in Hindi/Urdu — loose pants worn in South Asia.',
  },
  {
    id: 'etym-h-7',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "karate" come from?',
    choices: ['Chinese', 'Korean', 'Japanese', 'Thai'],
    answer: 'Japanese',
    rule: 'Karate is Japanese — "kara" means empty and "te" means hand. "Empty hand" fighting.',
  },
  {
    id: 'etym-h-8',
    skill: 'etymology', tier: 'hard',
    prompt: 'Which language did the word "safari" come from?',
    choices: ['Arabic/Swahili', 'French', 'Spanish', 'Portuguese'],
    answer: 'Arabic/Swahili',
    rule: '"Safari" comes from a Swahili word (borrowed from Arabic) meaning "journey".',
  },
];

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------

// Pull `count` items, optionally filtered by tier and/or skill. Random
// sample with no replacement within a single round (same Fisher-Yates as
// the homophones drill).
export function pickRoundItems(
  options: { tier?: DictionaryTier; skill?: DictionarySkill },
  count: number,
): DictionaryItem[] {
  let pool = DICTIONARY_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.skill) {
    pool = pool.filter((it) => it.skill === options.skill);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function getItem(id: string): DictionaryItem | undefined {
  return DICTIONARY_ITEMS.find((it) => it.id === id);
}
