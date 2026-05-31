// Vocabulary Builder — Language Arts Phase L7 dataset.
//
// Three mode flavors, each presented as a multiple-choice item the kid can
// answer in a couple seconds:
//   - word-to-def: "What does ARID mean?" → pick from 4 definitions
//   - def-to-word: "Which word means 'extremely dry'?" → pick from 4 words
//   - fill-blank:  the word is shown in a sentence with the WORD highlighted;
//                  kid picks the meaning that fits the sentence
//
// Tiering reflects word complexity (grade-band), NOT subtle nuance:
//   - easy:   1-2 syllable words a 1st-2nd grader could learn
//             (BRAVE, GENTLE, CURIOUS, GIGANTIC, FRIGID)
//   - medium: 3rd-4th grade vocabulary
//             (FEROCIOUS, GENEROUS, RELUCTANT, DEMOLISH, EAGER)
//   - hard:   5th grade+ stretch words
//             (ABUNDANT, METICULOUS, DILIGENT, TRANQUIL, PERILOUS)
//
// Quality bar:
//   - Definitions are short, kid-readable, and concrete.
//   - Distractor definitions are *plausible-but-clearly-wrong*. For
//     "ARID = extremely dry" the distractors should also be "extremely X"
//     things (hot, old, loud) so the kid can't shortcut on sentence shape —
//     they have to know the actual meaning.
//   - For def-to-word, distractor words should be the SAME part of speech
//     and rough register, never a giveaway (no random words).
//   - For fill-blank, the example sentence has to make the meaning derivable
//     even if the kid has never seen the word.
//
// Different skill from L6 Thesaurus: L6 = synonyms / antonyms / shade.
// L7 = the actual meaning of a stretch word.

export type VocabularyTier = 'easy' | 'medium' | 'hard';

export type VocabularyMode = 'word-to-def' | 'def-to-word' | 'fill-blank';

export type VocabularyPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb';

export type VocabularyDrillItem = {
  id: string;
  mode: VocabularyMode;
  tier: VocabularyTier;
  partOfSpeech: VocabularyPartOfSpeech;
  // The vocabulary word being drilled. Kept on the item so the play UI can
  // show "Hard · adjective · ARID" style metadata even for def-to-word items
  // (where the kid doesn't see the word until after they pick).
  word: string;
  // The drill prompt shown above the choices. For fill-blank items the
  // sentence renders separately via `context`.
  prompt: string;
  // Sentence shown for fill-blank items. The target word is wrapped in
  // **double asterisks** so the renderer can highlight it.
  context?: string;
  choices: string[];
  answer: string;
  // Short explanation shown on a miss — usually the definition.
  rule?: string;
};

// ----- Mode metadata (used by the UI) --------------------------------------

export const MODE_META: Record<
  VocabularyMode,
  { label: string; blurb: string; emoji: string }
> = {
  'word-to-def': {
    label: 'Word → meaning',
    blurb: 'pick what the word means',
    emoji: '🔍',
  },
  'def-to-word': {
    label: 'Meaning → word',
    blurb: 'pick the word for the meaning',
    emoji: '🎯',
  },
  'fill-blank': {
    label: 'In a sentence',
    blurb: 'pick the meaning that fits',
    emoji: '✏️',
  },
};

// ----- Items ----------------------------------------------------------------
//
// Hand-curated for quality. The pattern for each vocabulary word: write it
// once as word-to-def, write it once as def-to-word with different
// distractor words, and (for ~half the items) write it once as fill-blank
// with a sentence the kid can lean on. This gives the round natural variety
// without feeling repetitive — the kid sees the word from 2-3 angles.

export const VOCABULARY_ITEMS: VocabularyDrillItem[] = [
  // ==========================================================================
  // ===== EASY (1st-2nd grade) ===============================================
  // ==========================================================================

  // ----- BRAVE (adj) -----
  {
    id: 'easy-brave-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'BRAVE',
    prompt: 'What does BRAVE mean?',
    choices: [
      'not afraid to face danger',
      'feeling very tired',
      'extremely small',
      'wanting to be alone',
    ],
    answer: 'not afraid to face danger',
    rule: '`Brave` means showing courage — willing to face danger or pain.',
  },
  {
    id: 'easy-brave-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'BRAVE',
    prompt: 'Which word means "not afraid to face danger"?',
    choices: ['brave', 'shy', 'sleepy', 'cheerful'],
    answer: 'brave',
  },
  {
    id: 'easy-brave-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'BRAVE',
    prompt: 'What does the bold word mean here?',
    context: 'The **brave** firefighter ran into the burning house to save the puppy.',
    choices: [
      'not afraid of danger',
      'wearing a helmet',
      'very fast',
      'sleeping deeply',
    ],
    answer: 'not afraid of danger',
  },

  // ----- GENTLE (adj) -----
  {
    id: 'easy-gentle-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GENTLE',
    prompt: 'What does GENTLE mean?',
    choices: ['soft and kind', 'very loud', 'extremely fast', 'covered in mud'],
    answer: 'soft and kind',
  },
  {
    id: 'easy-gentle-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GENTLE',
    prompt: 'Which word means "soft and kind"?',
    choices: ['gentle', 'rough', 'noisy', 'angry'],
    answer: 'gentle',
  },

  // ----- CURIOUS (adj) -----
  {
    id: 'easy-curious-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'CURIOUS',
    prompt: 'What does CURIOUS mean?',
    choices: [
      'wanting to learn or know more',
      'feeling very sad',
      'covered in feathers',
      'standing very still',
    ],
    answer: 'wanting to learn or know more',
    rule: 'A `curious` person asks questions and wants to find things out.',
  },
  {
    id: 'easy-curious-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'CURIOUS',
    prompt: 'What does the bold word mean here?',
    context: 'The **curious** kitten peeked into every cabinet she could find.',
    choices: [
      'wanting to find things out',
      'fast asleep',
      'angry and growling',
      'covered in mud',
    ],
    answer: 'wanting to find things out',
  },

  // ----- GIGANTIC (adj) -----
  {
    id: 'easy-gigantic-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GIGANTIC',
    prompt: 'What does GIGANTIC mean?',
    choices: ['extremely big', 'extremely small', 'extremely cold', 'extremely shiny'],
    answer: 'extremely big',
  },
  {
    id: 'easy-gigantic-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GIGANTIC',
    prompt: 'Which word means "extremely big"?',
    choices: ['gigantic', 'tiny', 'ancient', 'quiet'],
    answer: 'gigantic',
  },

  // ----- FRIGID (adj) -----
  {
    id: 'easy-frigid-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'FRIGID',
    prompt: 'What does FRIGID mean?',
    choices: [
      'extremely cold',
      'extremely warm',
      'extremely loud',
      'extremely sweet',
    ],
    answer: 'extremely cold',
    rule: '`Frigid` means freezing cold — colder than just "cold".',
  },
  {
    id: 'easy-frigid-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'FRIGID',
    prompt: 'What does the bold word mean here?',
    context: 'We bundled up in heavy coats before stepping into the **frigid** winter air.',
    choices: [
      'extremely cold',
      'a little dusty',
      'full of smoke',
      'very sticky',
    ],
    answer: 'extremely cold',
  },

  // ----- SHIVER (verb) -----
  {
    id: 'easy-shiver-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'SHIVER',
    prompt: 'What does SHIVER mean?',
    choices: [
      'to shake from cold or fear',
      'to sleep deeply',
      'to whisper softly',
      'to jump high',
    ],
    answer: 'to shake from cold or fear',
  },
  {
    id: 'easy-shiver-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'SHIVER',
    prompt: 'Which word means "to shake from cold or fear"?',
    choices: ['shiver', 'glance', 'whisper', 'stretch'],
    answer: 'shiver',
  },

  // ----- GLOOMY (adj) -----
  {
    id: 'easy-gloomy-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GLOOMY',
    prompt: 'What does GLOOMY mean?',
    choices: ['dark and sad-feeling', 'bright and sunny', 'very tall', 'very heavy'],
    answer: 'dark and sad-feeling',
  },
  {
    id: 'easy-gloomy-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GLOOMY',
    prompt: 'What does the bold word mean here?',
    context: 'The **gloomy** rainy afternoon made everyone want a nap.',
    choices: ['dark and sad-feeling', 'hot and sunny', 'loud and busy', 'cold but cheerful'],
    answer: 'dark and sad-feeling',
  },

  // ----- WANDER (verb) -----
  {
    id: 'easy-wander-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'WANDER',
    prompt: 'What does WANDER mean?',
    choices: [
      'to walk around without a set path',
      'to sit perfectly still',
      'to shout loudly',
      'to read silently',
    ],
    answer: 'to walk around without a set path',
  },
  {
    id: 'easy-wander-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'WANDER',
    prompt: 'Which word means "to walk around with no set path"?',
    choices: ['wander', 'sprint', 'leap', 'march'],
    answer: 'wander',
  },

  // ----- CLEVER (adj) -----
  {
    id: 'easy-clever-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'CLEVER',
    prompt: 'What does CLEVER mean?',
    choices: ['quick to learn or figure things out', 'very strong', 'very tall', 'covered in fur'],
    answer: 'quick to learn or figure things out',
  },
  {
    id: 'easy-clever-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'CLEVER',
    prompt: 'What does the bold word mean here?',
    context: 'The **clever** fox figured out how to open the gate with his paw.',
    choices: ['quick to figure things out', 'fast asleep', 'extremely big', 'covered in spots'],
    answer: 'quick to figure things out',
  },

  // ----- GRUMPY (adj) -----
  {
    id: 'easy-grumpy-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GRUMPY',
    prompt: 'What does GRUMPY mean?',
    choices: ['in a bad mood', 'in a great mood', 'soaking wet', 'newly born'],
    answer: 'in a bad mood',
  },
  {
    id: 'easy-grumpy-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'GRUMPY',
    prompt: 'Which word means "in a bad mood"?',
    choices: ['grumpy', 'cheerful', 'curious', 'gentle'],
    answer: 'grumpy',
  },

  // ----- WEARY (adj) -----
  {
    id: 'easy-weary-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'WEARY',
    prompt: 'What does WEARY mean?',
    choices: ['very tired', 'very excited', 'very tall', 'very rich'],
    answer: 'very tired',
  },

  // ----- SHIMMER (verb) -----
  {
    id: 'easy-shimmer-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'SHIMMER',
    prompt: 'What does SHIMMER mean?',
    choices: [
      'to shine with a soft, wavy light',
      'to crash loudly',
      'to swim deeply',
      'to dig a hole',
    ],
    answer: 'to shine with a soft, wavy light',
  },
  {
    id: 'easy-shimmer-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'SHIMMER',
    prompt: 'What does the bold word mean here?',
    context: 'The lake began to **shimmer** as the morning sun touched the water.',
    choices: [
      'shine with a soft, wavy light',
      'freeze suddenly solid',
      'overflow its banks',
      'turn dark and muddy',
    ],
    answer: 'shine with a soft, wavy light',
  },

  // ----- TIDY (adj) -----
  {
    id: 'easy-tidy-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'TIDY',
    prompt: 'What does TIDY mean?',
    choices: ['neat and in order', 'completely messy', 'very tall', 'newly painted'],
    answer: 'neat and in order',
  },
  {
    id: 'easy-tidy-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'TIDY',
    prompt: 'Which word means "neat and in order"?',
    choices: ['tidy', 'messy', 'wild', 'noisy'],
    answer: 'tidy',
  },

  // ----- FETCH (verb) -----
  {
    id: 'easy-fetch-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'FETCH',
    prompt: 'What does FETCH mean?',
    choices: [
      'to go get something and bring it back',
      'to bury something in the yard',
      'to bark very loudly',
      'to fall fast asleep',
    ],
    answer: 'to go get something and bring it back',
  },

  // ----- CHATTER (verb) -----
  {
    id: 'easy-chatter-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'CHATTER',
    prompt: 'What does CHATTER mean?',
    choices: [
      'to talk quickly about small things',
      'to whisper a secret',
      'to write a story',
      'to bake a pie',
    ],
    answer: 'to talk quickly about small things',
  },
  {
    id: 'easy-chatter-fb',
    mode: 'fill-blank',
    tier: 'easy',
    partOfSpeech: 'verb',
    word: 'CHATTER',
    prompt: 'What does the bold word mean here?',
    context: 'The squirrels began to **chatter** in the tree above us.',
    choices: [
      'talk quickly about small things',
      'sleep through the day',
      'crash to the ground',
      'glow in the dark',
    ],
    answer: 'talk quickly about small things',
  },

  // ----- STURDY (adj) -----
  {
    id: 'easy-sturdy-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'STURDY',
    prompt: 'What does STURDY mean?',
    choices: ['strong and not easily broken', 'soft and squishy', 'pale and dusty', 'tiny and light'],
    answer: 'strong and not easily broken',
  },
  {
    id: 'easy-sturdy-d2w',
    mode: 'def-to-word',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'STURDY',
    prompt: 'Which word means "strong and not easily broken"?',
    choices: ['sturdy', 'fragile', 'sleepy', 'rusty'],
    answer: 'sturdy',
  },

  // ----- DRENCHED (adj) -----
  {
    id: 'easy-drenched-w2d',
    mode: 'word-to-def',
    tier: 'easy',
    partOfSpeech: 'adjective',
    word: 'DRENCHED',
    prompt: 'What does DRENCHED mean?',
    choices: ['completely wet', 'completely dry', 'completely silent', 'completely empty'],
    answer: 'completely wet',
  },

  // ==========================================================================
  // ===== MEDIUM (3rd-4th grade) =============================================
  // ==========================================================================

  // ----- FEROCIOUS (adj) -----
  {
    id: 'med-ferocious-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'FEROCIOUS',
    prompt: 'What does FEROCIOUS mean?',
    choices: ['fierce and dangerous', 'small and shy', 'old and wise', 'thin and weak'],
    answer: 'fierce and dangerous',
    rule: 'A `ferocious` animal is wildly fierce — like a tiger on the hunt.',
  },
  {
    id: 'med-ferocious-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'FEROCIOUS',
    prompt: 'Which word means "fierce and dangerous"?',
    choices: ['ferocious', 'graceful', 'curious', 'cautious'],
    answer: 'ferocious',
  },
  {
    id: 'med-ferocious-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'FEROCIOUS',
    prompt: 'What does the bold word mean here?',
    context: 'The **ferocious** lion roared until the whole jungle went quiet.',
    choices: ['fierce and dangerous', 'small and shy', 'old and slow', 'sleepy and full'],
    answer: 'fierce and dangerous',
  },

  // ----- GENEROUS (adj) -----
  {
    id: 'med-generous-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'GENEROUS',
    prompt: 'What does GENEROUS mean?',
    choices: [
      'willing to give freely to others',
      'wanting to keep everything for yourself',
      'tired all the time',
      'speaking a foreign language',
    ],
    answer: 'willing to give freely to others',
  },
  {
    id: 'med-generous-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'GENEROUS',
    prompt: 'What does the bold word mean here?',
    context: 'Our **generous** neighbor brought soup over every day she was sick.',
    choices: [
      'willing to give freely',
      'feeling jealous',
      'speaking very softly',
      'driving an old car',
    ],
    answer: 'willing to give freely',
  },

  // ----- RELUCTANT (adj) -----
  {
    id: 'med-reluctant-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'RELUCTANT',
    prompt: 'What does RELUCTANT mean?',
    choices: [
      'not wanting to do something',
      'very excited to do something',
      'making a loud noise',
      'wearing a uniform',
    ],
    answer: 'not wanting to do something',
    rule: 'A `reluctant` kid holds back from doing what they\'re asked.',
  },
  {
    id: 'med-reluctant-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'RELUCTANT',
    prompt: 'Which word means "not wanting to do something"?',
    choices: ['reluctant', 'eager', 'curious', 'patient'],
    answer: 'reluctant',
  },

  // ----- DEMOLISH (verb) -----
  {
    id: 'med-demolish-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'DEMOLISH',
    prompt: 'What does DEMOLISH mean?',
    choices: ['to tear something down completely', 'to build something new', 'to clean something up', 'to paint something bright'],
    answer: 'to tear something down completely',
  },
  {
    id: 'med-demolish-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'DEMOLISH',
    prompt: 'What does the bold word mean here?',
    context: 'The crew came with a giant wrecking ball to **demolish** the old factory.',
    choices: ['tear it down completely', 'paint it a new color', 'add a second floor', 'rent it out'],
    answer: 'tear it down completely',
  },

  // ----- EAGER (adj) -----
  {
    id: 'med-eager-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'EAGER',
    prompt: 'What does EAGER mean?',
    choices: [
      'very excited and wanting to do something',
      'sad and slow-moving',
      'covered in feathers',
      'unable to hear well',
    ],
    answer: 'very excited and wanting to do something',
  },
  {
    id: 'med-eager-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'EAGER',
    prompt: 'Which word means "very excited and wanting to do something"?',
    choices: ['eager', 'reluctant', 'weary', 'gloomy'],
    answer: 'eager',
  },

  // ----- CAUTIOUS (adj) -----
  {
    id: 'med-cautious-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'CAUTIOUS',
    prompt: 'What does CAUTIOUS mean?',
    choices: ['careful, to avoid problems', 'wildly bold', 'fast asleep', 'newly painted'],
    answer: 'careful, to avoid problems',
  },
  {
    id: 'med-cautious-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'CAUTIOUS',
    prompt: 'What does the bold word mean here?',
    context: 'Be **cautious** crossing the icy bridge — one slip and you\'re down.',
    choices: ['careful, to avoid problems', 'feeling super brave', 'wearing warm boots', 'going very fast'],
    answer: 'careful, to avoid problems',
  },

  // ----- GRUMBLE (verb) -----
  {
    id: 'med-grumble-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'GRUMBLE',
    prompt: 'What does GRUMBLE mean?',
    choices: ['to complain in a low voice', 'to laugh loudly', 'to dance happily', 'to dig a hole'],
    answer: 'to complain in a low voice',
  },
  {
    id: 'med-grumble-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'GRUMBLE',
    prompt: 'Which word means "to complain in a low voice"?',
    choices: ['grumble', 'cheer', 'whistle', 'announce'],
    answer: 'grumble',
  },

  // ----- VANISH (verb) -----
  {
    id: 'med-vanish-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'VANISH',
    prompt: 'What does VANISH mean?',
    choices: ['to disappear suddenly', 'to appear suddenly', 'to grow taller', 'to turn bright red'],
    answer: 'to disappear suddenly',
  },
  {
    id: 'med-vanish-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'VANISH',
    prompt: 'What does the bold word mean here?',
    context: 'The magician snapped his fingers and watched the coin **vanish** from his hand.',
    choices: ['disappear suddenly', 'grow much larger', 'turn into gold', 'fly across the room'],
    answer: 'disappear suddenly',
  },

  // ----- STRUT (verb) -----
  {
    id: 'med-strut-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'STRUT',
    prompt: 'What does STRUT mean?',
    choices: [
      'to walk in a proud, showy way',
      'to walk with a slow limp',
      'to crawl on hands and knees',
      'to swim through deep water',
    ],
    answer: 'to walk in a proud, showy way',
  },

  // ----- SLY (adj) -----
  {
    id: 'med-sly-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'SLY',
    prompt: 'What does SLY mean?',
    choices: ['clever in a sneaky way', 'loud and bossy', 'very slow', 'covered in snow'],
    answer: 'clever in a sneaky way',
  },
  {
    id: 'med-sly-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'SLY',
    prompt: 'Which word means "clever in a sneaky way"?',
    choices: ['sly', 'noble', 'humble', 'proud'],
    answer: 'sly',
  },

  // ----- FRAGILE (adj) -----
  {
    id: 'med-fragile-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'FRAGILE',
    prompt: 'What does FRAGILE mean?',
    choices: [
      'easily broken or damaged',
      'made of solid metal',
      'extremely heavy',
      'shaped like a circle',
    ],
    answer: 'easily broken or damaged',
  },
  {
    id: 'med-fragile-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'FRAGILE',
    prompt: 'What does the bold word mean here?',
    context: 'Mom labeled the box **fragile** before the movers loaded the dishes.',
    choices: ['easily broken', 'extremely heavy', 'made of cardboard', 'recently painted'],
    answer: 'easily broken',
  },

  // ----- HOLLOW (adj) -----
  {
    id: 'med-hollow-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'HOLLOW',
    prompt: 'What does HOLLOW mean?',
    choices: ['empty inside', 'completely full', 'rough on the outside', 'painted black'],
    answer: 'empty inside',
  },

  // ----- BLUNDER (noun) -----
  {
    id: 'med-blunder-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'noun',
    word: 'BLUNDER',
    prompt: 'What does BLUNDER mean?',
    choices: ['a careless mistake', 'a small song', 'a winter storm', 'a kind of cake'],
    answer: 'a careless mistake',
  },
  {
    id: 'med-blunder-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'noun',
    word: 'BLUNDER',
    prompt: 'What does the bold word mean here?',
    context: 'Spelling the team name wrong on the trophy was a huge **blunder**.',
    choices: ['careless mistake', 'expensive trophy', 'great victory', 'team cheer'],
    answer: 'careless mistake',
  },

  // ----- WEARY (verb-ish — keep as adj) — already easy. SKIP.

  // ----- BOAST (verb) -----
  {
    id: 'med-boast-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'BOAST',
    prompt: 'What does BOAST mean?',
    choices: [
      'to brag about yourself',
      'to feel ashamed',
      'to hide quietly',
      'to apologize politely',
    ],
    answer: 'to brag about yourself',
  },
  {
    id: 'med-boast-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'BOAST',
    prompt: 'Which word means "to brag about yourself"?',
    choices: ['boast', 'whisper', 'apologize', 'forgive'],
    answer: 'boast',
  },

  // ----- HUMBLE (adj) -----
  {
    id: 'med-humble-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'HUMBLE',
    prompt: 'What does HUMBLE mean?',
    choices: [
      'modest, not bragging',
      'loud and proud',
      'covered in dust',
      'over a hundred years old',
    ],
    answer: 'modest, not bragging',
  },
  {
    id: 'med-humble-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'HUMBLE',
    prompt: 'What does the bold word mean here?',
    context: 'Even after winning the race, Ana stayed **humble** and praised her teammates.',
    choices: ['modest, not bragging', 'angry and rude', 'covered in mud', 'speaking very loudly'],
    answer: 'modest, not bragging',
  },

  // ----- LINGER (verb) -----
  {
    id: 'med-linger-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'LINGER',
    prompt: 'What does LINGER mean?',
    choices: [
      'to stay longer than expected',
      'to leave very quickly',
      'to climb a ladder',
      'to whisper softly',
    ],
    answer: 'to stay longer than expected',
  },
  {
    id: 'med-linger-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'LINGER',
    prompt: 'Which word means "to stay longer than expected"?',
    choices: ['linger', 'rush', 'dash', 'flee'],
    answer: 'linger',
  },

  // ----- DRIZZLE (noun) -----
  {
    id: 'med-drizzle-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'noun',
    word: 'DRIZZLE',
    prompt: 'What does DRIZZLE mean?',
    choices: [
      'a light, gentle rain',
      'a heavy snowstorm',
      'a loud thunderclap',
      'a deep puddle',
    ],
    answer: 'a light, gentle rain',
  },
  {
    id: 'med-drizzle-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'noun',
    word: 'DRIZZLE',
    prompt: 'What does the bold word mean here?',
    context: 'A soft morning **drizzle** dampened the sidewalks but no one needed an umbrella.',
    choices: ['light, gentle rain', 'heavy thunderstorm', 'snow flurry', 'patch of fog'],
    answer: 'light, gentle rain',
  },

  // ----- WHIMPER (verb) -----
  {
    id: 'med-whimper-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'WHIMPER',
    prompt: 'What does WHIMPER mean?',
    choices: [
      'to make small, soft crying sounds',
      'to bark very loudly',
      'to swing a bat',
      'to fall asleep fast',
    ],
    answer: 'to make small, soft crying sounds',
  },

  // ----- STERN (adj) -----
  {
    id: 'med-stern-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'STERN',
    prompt: 'What does STERN mean?',
    choices: ['serious and strict', 'playful and silly', 'covered in mud', 'made of glass'],
    answer: 'serious and strict',
  },
  {
    id: 'med-stern-fb',
    mode: 'fill-blank',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'STERN',
    prompt: 'What does the bold word mean here?',
    context: 'Dad gave us a **stern** look when we tracked mud across the carpet.',
    choices: ['serious and strict', 'happy and surprised', 'tired and sleepy', 'kind and gentle'],
    answer: 'serious and strict',
  },

  // ----- BUSTLING (adj) -----
  {
    id: 'med-bustling-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'adjective',
    word: 'BUSTLING',
    prompt: 'What does BUSTLING mean?',
    choices: ['full of busy activity', 'totally empty', 'extremely quiet', 'painted bright red'],
    answer: 'full of busy activity',
  },

  // ----- JOLT (verb) -----
  {
    id: 'med-jolt-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'JOLT',
    prompt: 'What does JOLT mean?',
    choices: ['to move with a sudden jerk', 'to glide smoothly', 'to whisper softly', 'to sleep deeply'],
    answer: 'to move with a sudden jerk',
  },

  // ----- DEFY (verb) -----
  {
    id: 'med-defy-w2d',
    mode: 'word-to-def',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'DEFY',
    prompt: 'What does DEFY mean?',
    choices: [
      'to refuse to obey',
      'to obey carefully',
      'to walk in circles',
      'to ask a question',
    ],
    answer: 'to refuse to obey',
  },
  {
    id: 'med-defy-d2w',
    mode: 'def-to-word',
    tier: 'medium',
    partOfSpeech: 'verb',
    word: 'DEFY',
    prompt: 'Which word means "to refuse to obey"?',
    choices: ['defy', 'agree', 'whisper', 'apologize'],
    answer: 'defy',
  },

  // ==========================================================================
  // ===== HARD (5th grade+) ==================================================
  // ==========================================================================

  // ----- ABUNDANT (adj) -----
  {
    id: 'hard-abundant-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'ABUNDANT',
    prompt: 'What does ABUNDANT mean?',
    choices: [
      'existing in very large amounts',
      'extremely rare',
      'made of metal',
      'badly damaged',
    ],
    answer: 'existing in very large amounts',
    rule: 'An `abundant` supply is more than enough — plentiful.',
  },
  {
    id: 'hard-abundant-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'ABUNDANT',
    prompt: 'Which word means "existing in very large amounts"?',
    choices: ['abundant', 'scarce', 'meager', 'fragile'],
    answer: 'abundant',
  },
  {
    id: 'hard-abundant-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'ABUNDANT',
    prompt: 'What does the bold word mean here?',
    context: 'After the rainy spring, wildflowers were **abundant** all over the meadow.',
    choices: ['in very large amounts', 'extremely rare', 'a strange color', 'tiny and weak'],
    answer: 'in very large amounts',
  },

  // ----- METICULOUS (adj) -----
  {
    id: 'hard-meticulous-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'METICULOUS',
    prompt: 'What does METICULOUS mean?',
    choices: [
      'very careful about small details',
      'extremely careless',
      'always in a hurry',
      'happy and laughing',
    ],
    answer: 'very careful about small details',
  },
  {
    id: 'hard-meticulous-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'METICULOUS',
    prompt: 'What does the bold word mean here?',
    context: 'The artist was **meticulous**, fixing each tiny brushstroke for hours.',
    choices: ['very careful about small details', 'extremely fast', 'covered in paint', 'over 100 years old'],
    answer: 'very careful about small details',
  },

  // ----- DILIGENT (adj) -----
  {
    id: 'hard-diligent-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'DILIGENT',
    prompt: 'What does DILIGENT mean?',
    choices: [
      'working hard with steady care',
      'taking it easy and goofing off',
      'covered in flowers',
      'wearing a uniform',
    ],
    answer: 'working hard with steady care',
  },
  {
    id: 'hard-diligent-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'DILIGENT',
    prompt: 'Which word means "working hard with steady care"?',
    choices: ['diligent', 'lazy', 'reluctant', 'frantic'],
    answer: 'diligent',
  },

  // ----- TRANQUIL (adj) -----
  {
    id: 'hard-tranquil-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TRANQUIL',
    prompt: 'What does TRANQUIL mean?',
    choices: ['peaceful and calm', 'loud and busy', 'cold and snowy', 'small and shy'],
    answer: 'peaceful and calm',
  },
  {
    id: 'hard-tranquil-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TRANQUIL',
    prompt: 'What does the bold word mean here?',
    context: 'Early morning at the lake was **tranquil** — no wind, no voices, just stillness.',
    choices: ['peaceful and calm', 'wildly windy', 'loud with traffic', 'crowded with people'],
    answer: 'peaceful and calm',
  },

  // ----- PERILOUS (adj) -----
  {
    id: 'hard-perilous-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'PERILOUS',
    prompt: 'What does PERILOUS mean?',
    choices: ['full of danger', 'completely safe', 'very colorful', 'extremely funny'],
    answer: 'full of danger',
    rule: 'A `perilous` journey is one where danger is everywhere — peril = danger.',
  },
  {
    id: 'hard-perilous-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'PERILOUS',
    prompt: 'Which word means "full of danger"?',
    choices: ['perilous', 'tranquil', 'humble', 'abundant'],
    answer: 'perilous',
  },

  // ----- ARID (adj) -----
  {
    id: 'hard-arid-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'ARID',
    prompt: 'What does ARID mean?',
    choices: [
      'extremely dry',
      'extremely hot',
      'extremely old',
      'extremely loud',
    ],
    answer: 'extremely dry',
    rule: '`Arid` describes a place — like a desert — with almost no rain.',
  },
  {
    id: 'hard-arid-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'ARID',
    prompt: 'What does the bold word mean here?',
    context: 'The **arid** desert had not seen a drop of rain in over a year.',
    choices: ['extremely dry', 'extremely cold', 'extremely crowded', 'extremely shiny'],
    answer: 'extremely dry',
  },

  // ----- INDUSTRIOUS (adj) -----
  {
    id: 'hard-industrious-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'INDUSTRIOUS',
    prompt: 'What does INDUSTRIOUS mean?',
    choices: ['hardworking and busy', 'always sleeping', 'made of iron', 'covered in soot'],
    answer: 'hardworking and busy',
  },

  // ----- VIGILANT (adj) -----
  {
    id: 'hard-vigilant-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'VIGILANT',
    prompt: 'What does VIGILANT mean?',
    choices: [
      'watching carefully for danger',
      'fast asleep',
      'completely lost',
      'too tired to move',
    ],
    answer: 'watching carefully for danger',
  },
  {
    id: 'hard-vigilant-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'VIGILANT',
    prompt: 'Which word means "watching carefully for danger"?',
    choices: ['vigilant', 'careless', 'sleepy', 'cheerful'],
    answer: 'vigilant',
  },

  // ----- WEARISOME (adj) skip — too close to weary -----

  // ----- IMMENSE (adj) -----
  {
    id: 'hard-immense-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'IMMENSE',
    prompt: 'What does IMMENSE mean?',
    choices: ['extremely large', 'extremely small', 'extremely fast', 'extremely warm'],
    answer: 'extremely large',
  },
  {
    id: 'hard-immense-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'IMMENSE',
    prompt: 'What does the bold word mean here?',
    context: 'Standing on the beach, we felt small next to the **immense** ocean.',
    choices: ['extremely large', 'extremely warm', 'extremely loud', 'extremely fresh'],
    answer: 'extremely large',
  },

  // ----- PONDER (verb) -----
  {
    id: 'hard-ponder-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'PONDER',
    prompt: 'What does PONDER mean?',
    choices: [
      'to think carefully about something',
      'to shout an answer',
      'to forget on purpose',
      'to bake a pie',
    ],
    answer: 'to think carefully about something',
  },

  // ----- LURK (verb) -----
  {
    id: 'hard-lurk-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'LURK',
    prompt: 'What does LURK mean?',
    choices: [
      'to wait quietly out of sight',
      'to dance in the open',
      'to sing very loudly',
      'to swim very fast',
    ],
    answer: 'to wait quietly out of sight',
  },
  {
    id: 'hard-lurk-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'LURK',
    prompt: 'What does the bold word mean here?',
    context: 'The cat liked to **lurk** behind the curtain, waiting for the perfect moment to pounce.',
    choices: ['wait quietly out of sight', 'jump up and down', 'meow very loudly', 'sleep all day'],
    answer: 'wait quietly out of sight',
  },

  // ----- TIMID (adj) -----
  {
    id: 'hard-timid-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TIMID',
    prompt: 'What does TIMID mean?',
    choices: ['shy and easily scared', 'bold and loud', 'old and wise', 'fast and strong'],
    answer: 'shy and easily scared',
  },
  {
    id: 'hard-timid-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TIMID',
    prompt: 'Which word means "shy and easily scared"?',
    choices: ['timid', 'bold', 'fierce', 'proud'],
    answer: 'timid',
  },

  // ----- SCARCE (adj) -----
  {
    id: 'hard-scarce-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'SCARCE',
    prompt: 'What does SCARCE mean?',
    choices: [
      'in short supply, hard to find',
      'in huge amounts',
      'very colorful',
      'made of stone',
    ],
    answer: 'in short supply, hard to find',
  },
  {
    id: 'hard-scarce-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'SCARCE',
    prompt: 'What does the bold word mean here?',
    context: 'In the long winter, fresh fruit was **scarce** — we ate apples from the cellar.',
    choices: ['hard to find', 'extremely common', 'covered in frost', 'priced very low'],
    answer: 'hard to find',
  },

  // ----- BEWILDER (verb) -----
  {
    id: 'hard-bewilder-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'BEWILDER',
    prompt: 'What does BEWILDER mean?',
    choices: ['to confuse completely', 'to make laugh', 'to put to sleep', 'to make warm'],
    answer: 'to confuse completely',
  },

  // ----- ENDEAVOR (verb) -----
  {
    id: 'hard-endeavor-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'ENDEAVOR',
    prompt: 'What does ENDEAVOR mean?',
    choices: ['to try hard to do something', 'to give up easily', 'to fall asleep', 'to whisper softly'],
    answer: 'to try hard to do something',
  },
  {
    id: 'hard-endeavor-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'ENDEAVOR',
    prompt: 'Which word means "to try hard to do something"?',
    choices: ['endeavor', 'surrender', 'forget', 'ignore'],
    answer: 'endeavor',
  },

  // ----- FORLORN (adj) -----
  {
    id: 'hard-forlorn-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'FORLORN',
    prompt: 'What does FORLORN mean?',
    choices: ['sad and lonely', 'loud and proud', 'warm and cozy', 'bright and shiny'],
    answer: 'sad and lonely',
  },
  {
    id: 'hard-forlorn-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'FORLORN',
    prompt: 'What does the bold word mean here?',
    context: 'The lost puppy gave a **forlorn** look from the rainy doorstep.',
    choices: ['sad and lonely', 'angry and growling', 'warm and dry', 'fast asleep'],
    answer: 'sad and lonely',
  },

  // ----- BENEVOLENT (adj) -----
  {
    id: 'hard-benevolent-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'BENEVOLENT',
    prompt: 'What does BENEVOLENT mean?',
    choices: ['kind and wanting to help others', 'mean and cruel', 'completely silent', 'painted gold'],
    answer: 'kind and wanting to help others',
  },

  // ----- TRIVIAL (adj) -----
  {
    id: 'hard-trivial-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TRIVIAL',
    prompt: 'What does TRIVIAL mean?',
    choices: ['not important; small in value', 'extremely important', 'very expensive', 'extremely heavy'],
    answer: 'not important; small in value',
  },
  {
    id: 'hard-trivial-d2w',
    mode: 'def-to-word',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TRIVIAL',
    prompt: 'Which word means "not important; small in value"?',
    choices: ['trivial', 'crucial', 'massive', 'sacred'],
    answer: 'trivial',
  },

  // ----- OBSERVE (verb) -----
  {
    id: 'hard-observe-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'OBSERVE',
    prompt: 'What does OBSERVE mean?',
    choices: [
      'to watch something carefully',
      'to ignore something on purpose',
      'to break something',
      'to throw something',
    ],
    answer: 'to watch something carefully',
  },
  {
    id: 'hard-observe-fb',
    mode: 'fill-blank',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'OBSERVE',
    prompt: 'What does the bold word mean here?',
    context: 'The scientist would **observe** the ants for hours, writing down everything they did.',
    choices: ['watch carefully', 'feed quickly', 'capture in a jar', 'chase away'],
    answer: 'watch carefully',
  },

  // ----- TREACHEROUS (adj) -----
  {
    id: 'hard-treacherous-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'adjective',
    word: 'TREACHEROUS',
    prompt: 'What does TREACHEROUS mean?',
    choices: ['dangerous and not to be trusted', 'safe and predictable', 'old and dusty', 'small and shy'],
    answer: 'dangerous and not to be trusted',
  },

  // ----- DWELL (verb) -----
  {
    id: 'hard-dwell-w2d',
    mode: 'word-to-def',
    tier: 'hard',
    partOfSpeech: 'verb',
    word: 'DWELL',
    prompt: 'What does DWELL mean?',
    choices: ['to live in a place', 'to leave a place', 'to dig a hole', 'to climb a tree'],
    answer: 'to live in a place',
  },
];

// ----- Helpers --------------------------------------------------------------

export function getItem(id: string): VocabularyDrillItem | undefined {
  return VOCABULARY_ITEMS.find((it) => it.id === id);
}

export type VocabularyModeFilter = VocabularyMode | 'mixed';

// Pull `count` items from the pool, filtered by tier and/or mode.
// Random sample, no replacement within a single round.
export function pickRoundItems(
  options: { tier?: VocabularyTier; mode?: VocabularyModeFilter },
  count: number,
): VocabularyDrillItem[] {
  let pool = VOCABULARY_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.mode && options.mode !== 'mixed') {
    pool = pool.filter((it) => it.mode === options.mode);
  }
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Per-item shuffled choices (so the answer slot changes each round).
export function shuffledChoices(item: VocabularyDrillItem): string[] {
  const arr = item.choices.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
