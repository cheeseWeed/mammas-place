// Homophones / commonly confused words — Language Arts Phase L1 dataset.
//
// Each item is a fill-in-the-blank prompt where the blank is one of a SET of
// commonly confused words. The kid sees the sentence with `____` and the full
// set of choices; they pick the right one. We track per-set mistakes so we
// can later spotlight the trickiest sets ("you keep missing affect/effect").
//
// Tier reflects difficulty of the distinction, not vocabulary level:
//   - easy: 2-way distinction with strong context cues (its / it's)
//   - medium: 3-way distinction or subtle cues (their / they're / there)
//   - hard: register / shade differences (less / fewer, who / whom)
//
// Data is intentionally small in v1 — easier to curate by hand for a
// homeschool-quality bar than to scrape and clean. Grows organically.

export type HomophoneTier = 'easy' | 'medium' | 'hard';

export type HomophoneSet = {
  id: string;                 // e.g. 'its-its'
  words: string[];            // ordered choices ['its', "it's"]
  tier: HomophoneTier;
  // Short rule the kid can read before / after drilling this set.
  rule: string;
};

export type HomophoneItem = {
  setId: string;
  answer: string;             // must be one of the set's words (case-preserving)
  // Sentence with one literal `____` token where the answer goes.
  sentence: string;
  // Optional one-line hint shown after a wrong answer.
  hint?: string;
};

// ----- Sets (the "rules" the kid learns) -----

export const HOMOPHONE_SETS: HomophoneSet[] = [
  {
    id: 'its-its',
    words: ['its', "it's"],
    tier: 'easy',
    rule: "`it's` means \"it is\" or \"it has\". `its` shows ownership (the dog's bone → its bone).",
  },
  {
    id: 'your-youre',
    words: ['your', "you're"],
    tier: 'easy',
    rule: "`you're` means \"you are\". `your` shows ownership (your hat, your turn).",
  },
  {
    id: 'their-there-theyre',
    words: ['their', 'there', "they're"],
    tier: 'medium',
    rule: '`their` = belongs to them. `there` = a place (over there). `they\'re` = they are.',
  },
  {
    id: 'to-too-two',
    words: ['to', 'too', 'two'],
    tier: 'medium',
    rule: '`two` = the number 2. `too` = also / very. `to` = direction or part of an infinitive verb.',
  },
  {
    id: 'affect-effect',
    words: ['affect', 'effect'],
    tier: 'hard',
    rule: '`affect` is usually a VERB (to influence). `effect` is usually a NOUN (the result).',
  },
  {
    id: 'then-than',
    words: ['then', 'than'],
    tier: 'easy',
    rule: '`then` = time / next step. `than` = comparison (bigger than).',
  },
  {
    id: 'lose-loose',
    words: ['lose', 'loose'],
    tier: 'easy',
    rule: '`lose` = not win, or misplace. `loose` = not tight.',
  },
  {
    id: 'whose-whos',
    words: ['whose', "who's"],
    tier: 'medium',
    rule: "`who's` = who is / who has. `whose` shows ownership (whose backpack is this?).",
  },
  {
    id: 'were-where-wear',
    words: ['were', 'where', 'wear'],
    tier: 'hard',
    rule: '`were` = past-tense be (they were). `where` = a place. `wear` = to put on clothing.',
  },
  {
    id: 'accept-except',
    words: ['accept', 'except'],
    tier: 'hard',
    rule: '`accept` = receive / agree to. `except` = not including (everyone except me).',
  },
];

// ----- Items (the sentences the kid sees) -----
//
// Hand-authored. Keep them concrete, age-appropriate, and unambiguous — the
// distractor should be clearly wrong once the rule is known.

export const HOMOPHONE_ITEMS: HomophoneItem[] = [
  // its / it's
  { setId: 'its-its', answer: "it's", sentence: "____ raining outside today." },
  { setId: 'its-its', answer: 'its', sentence: 'The cat licked ____ paw.' },
  { setId: 'its-its', answer: "it's", sentence: "____ been a long week." },
  { setId: 'its-its', answer: 'its', sentence: 'Every dog has ____ own bowl.' },
  { setId: 'its-its', answer: "it's", sentence: "____ time for dinner." },

  // your / you're
  { setId: 'your-youre', answer: 'your', sentence: 'Did you bring ____ lunchbox?' },
  { setId: 'your-youre', answer: "you're", sentence: "____ going to love this book." },
  { setId: 'your-youre', answer: 'your', sentence: 'I like ____ new shoes.' },
  { setId: 'your-youre', answer: "you're", sentence: "Mom says ____ doing a great job." },
  { setId: 'your-youre', answer: 'your', sentence: 'Don\'t forget ____ jacket.' },

  // their / there / they're
  { setId: 'their-there-theyre', answer: 'their', sentence: 'The kids forgot ____ backpacks.' },
  { setId: 'their-there-theyre', answer: 'there', sentence: 'Put the books over ____.' },
  { setId: 'their-there-theyre', answer: "they're", sentence: "I think ____ already here." },
  { setId: 'their-there-theyre', answer: 'their', sentence: 'My grandparents love ____ garden.' },
  { setId: 'their-there-theyre', answer: 'there', sentence: 'Is anyone ____?' },
  { setId: 'their-there-theyre', answer: "they're", sentence: "When ____ ready, we'll leave." },

  // to / too / two
  { setId: 'to-too-two', answer: 'two', sentence: 'I have ____ apples in my bag.' },
  { setId: 'to-too-two', answer: 'too', sentence: 'That cake is ____ sweet for me.' },
  { setId: 'to-too-two', answer: 'to', sentence: 'We are going ____ the park.' },
  { setId: 'to-too-two', answer: 'too', sentence: 'Can I come ____?' },
  { setId: 'to-too-two', answer: 'two', sentence: 'My brother is ____ years old.' },
  { setId: 'to-too-two', answer: 'to', sentence: 'I love ____ paint.' },

  // affect / effect
  { setId: 'affect-effect', answer: 'affect', sentence: 'Rain can ____ the soccer game.',
    hint: 'A verb fits here — what does rain DO to the game?' },
  { setId: 'affect-effect', answer: 'effect', sentence: 'The medicine had a quick ____.',
    hint: 'A noun fits here — the result of the medicine.' },
  { setId: 'affect-effect', answer: 'affect', sentence: 'Loud music can ____ your hearing.' },
  { setId: 'affect-effect', answer: 'effect', sentence: 'Practice has a big ____ on your skill.' },

  // then / than
  { setId: 'then-than', answer: 'than', sentence: 'My dad is taller ____ my mom.' },
  { setId: 'then-than', answer: 'then', sentence: 'First brush your teeth, ____ go to bed.' },
  { setId: 'then-than', answer: 'than', sentence: 'I would rather read ____ watch TV.' },
  { setId: 'then-than', answer: 'then', sentence: 'We ate dinner, and ____ played a game.' },

  // lose / loose
  { setId: 'lose-loose', answer: 'lose', sentence: "Don't ____ your homework!" },
  { setId: 'lose-loose', answer: 'loose', sentence: 'My tooth is wiggly and ____.' },
  { setId: 'lose-loose', answer: 'lose', sentence: 'I hate to ____ at checkers.' },
  { setId: 'lose-loose', answer: 'loose', sentence: 'These pants feel a little ____.' },

  // whose / who's
  { setId: 'whose-whos', answer: 'whose', sentence: '____ jacket is on the floor?' },
  { setId: 'whose-whos', answer: "who's", sentence: "____ coming to the picnic?" },
  { setId: 'whose-whos', answer: 'whose', sentence: 'I asked ____ turn it was.' },
  { setId: 'whose-whos', answer: "who's", sentence: "____ ready for ice cream?" },

  // were / where / wear
  { setId: 'were-where-wear', answer: 'where', sentence: '____ did you put my book?' },
  { setId: 'were-where-wear', answer: 'were', sentence: 'They ____ playing in the yard.' },
  { setId: 'were-where-wear', answer: 'wear', sentence: 'I will ____ my red hat today.' },
  { setId: 'were-where-wear', answer: 'where', sentence: 'Show me ____ you found it.' },
  { setId: 'were-where-wear', answer: 'were', sentence: 'My friends ____ at the park.' },
  { setId: 'were-where-wear', answer: 'wear', sentence: 'You should ____ a coat — it\'s cold!' },

  // accept / except
  { setId: 'accept-except', answer: 'accept', sentence: 'I gladly ____ your gift.' },
  { setId: 'accept-except', answer: 'except', sentence: 'Everyone came ____ Sam.' },
  { setId: 'accept-except', answer: 'accept', sentence: 'Please ____ my apology.' },
  { setId: 'accept-except', answer: 'except', sentence: 'I like all veggies ____ peas.' },
];

// Convenience: index items by setId.
export function itemsBySet(): Record<string, HomophoneItem[]> {
  const map: Record<string, HomophoneItem[]> = {};
  for (const item of HOMOPHONE_ITEMS) {
    if (!map[item.setId]) map[item.setId] = [];
    map[item.setId].push(item);
  }
  return map;
}

export function getSet(id: string): HomophoneSet | undefined {
  return HOMOPHONE_SETS.find((s) => s.id === id);
}

// Pull `count` items from a tier (or from a specific set). Random sample,
// no replacement within a single round.
export function pickRoundItems(
  options: { tier?: HomophoneTier; setIds?: string[] },
  count: number,
): HomophoneItem[] {
  let pool = HOMOPHONE_ITEMS.slice();
  if (options.setIds && options.setIds.length > 0) {
    pool = pool.filter((it) => options.setIds!.includes(it.setId));
  } else if (options.tier) {
    const setIdsForTier = new Set(
      HOMOPHONE_SETS.filter((s) => s.tier === options.tier).map((s) => s.id),
    );
    pool = pool.filter((it) => setIdsForTier.has(it.setId));
  }
  // Shuffle (Fisher-Yates) then take first N.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
