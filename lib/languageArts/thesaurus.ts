// Thesaurus skills — Language Arts Phase L6 dataset.
//
// Five skill flavors, each presented as a multiple-choice item the kid can
// answer in a couple seconds:
//   - synonyms:   "Which means about the SAME as ___?"
//   - antonyms:   "Which means the OPPOSITE of ___?"
//   - shade:      pick the BEST synonym for the sentence context
//                 (e.g. "She ____ her secret" → whispered, not yelled)
//   - repetition: a sentence reuses a word; pick the synonym that swaps in
//                 cleanly for one instance
//   - strength:   pick the STRONGEST (or weakest) word from a set of
//                 intensity-related synonyms (cool / cold / chilly / freezing)
//
// Tiering reflects how subtle the distinction is, not vocabulary stretch:
//   - easy:   single-syllable basics (big/small, hot/cold)
//   - medium: multi-syllable synonyms, shade with strong context cues
//   - hard:   subtle nuance (sad/melancholy/glum), register matches
//
// Quality bar: for SHADE items the distractors must be *technical synonyms*
// that nevertheless feel WRONG in the given sentence. For ANTONYMS the
// answer must be unambiguous (no overlapping meanings).

export type ThesaurusTier = 'easy' | 'medium' | 'hard';

export type ThesaurusSkill =
  | 'synonyms'
  | 'antonyms'
  | 'shade'
  | 'repetition'
  | 'strength';

export type ThesaurusItem = {
  id: string;
  skill: ThesaurusSkill;
  tier: ThesaurusTier;
  // Prompt shown above the choices. For shade/repetition this is the
  // instruction; the `context` sentence renders separately.
  prompt: string;
  // Sentence context for shade/repetition items. The blank is `____` if the
  // kid is filling one in; for repetition the repeated word is **bolded**
  // (we just render it as plain text — the prompt explains the task).
  context?: string;
  choices: string[];
  answer: string;
  // Short explanation shown on a miss — what makes the right answer fit.
  rule?: string;
};

// ----- Skill metadata (used by the UI to label tiers + describe the round) --

export const SKILL_META: Record<
  ThesaurusSkill,
  { label: string; blurb: string; emoji: string }
> = {
  synonyms: {
    label: 'Synonyms',
    blurb: 'words that mean about the same',
    emoji: '🟰',
  },
  antonyms: {
    label: 'Antonyms',
    blurb: 'words that mean the opposite',
    emoji: '↔️',
  },
  shade: {
    label: 'Shade of meaning',
    blurb: 'pick the BEST word for the sentence',
    emoji: '🎨',
  },
  repetition: {
    label: 'Avoid repeats',
    blurb: 'swap a synonym in for a repeated word',
    emoji: '🔁',
  },
  strength: {
    label: 'Strength scale',
    blurb: 'which word is strongest (or weakest)',
    emoji: '📏',
  },
};

// ----- Items ----------------------------------------------------------------
//
// Hand-curated. Keep choices 3-4 wide. For antonyms, prefer unambiguous
// pairs (big/small, never tall/long). For shade, all three distractors
// should be valid synonyms in the dictionary sense — they just don't fit
// the sentence vibe.

export const THESAURUS_ITEMS: ThesaurusItem[] = [
  // ===== SYNONYMS — easy =================================================
  {
    id: 'syn-big',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as BIG?',
    choices: ['large', 'small', 'tiny', 'short'],
    answer: 'large',
  },
  {
    id: 'syn-happy',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as HAPPY?',
    choices: ['glad', 'angry', 'sleepy', 'sad'],
    answer: 'glad',
  },
  {
    id: 'syn-fast',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as FAST?',
    choices: ['quick', 'slow', 'lazy', 'heavy'],
    answer: 'quick',
  },
  {
    id: 'syn-smart',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as SMART?',
    choices: ['clever', 'silly', 'tired', 'mean'],
    answer: 'clever',
  },
  {
    id: 'syn-pretty',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as PRETTY?',
    choices: ['beautiful', 'ugly', 'plain', 'loud'],
    answer: 'beautiful',
  },
  {
    id: 'syn-mad',
    skill: 'synonyms',
    tier: 'easy',
    prompt: 'Which word means about the SAME as MAD?',
    choices: ['angry', 'happy', 'kind', 'gentle'],
    answer: 'angry',
  },

  // ===== SYNONYMS — medium ===============================================
  {
    id: 'syn-furious',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as FURIOUS?',
    choices: ['enraged', 'pleased', 'puzzled', 'curious'],
    answer: 'enraged',
    rule: '`furious` means very angry — `enraged` means the same.',
  },
  {
    id: 'syn-enormous',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as ENORMOUS?',
    choices: ['gigantic', 'tiny', 'common', 'narrow'],
    answer: 'gigantic',
  },
  {
    id: 'syn-brave',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as BRAVE?',
    choices: ['courageous', 'scared', 'shy', 'rude'],
    answer: 'courageous',
  },
  {
    id: 'syn-begin',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as BEGIN?',
    choices: ['start', 'finish', 'pause', 'forget'],
    answer: 'start',
  },
  {
    id: 'syn-tired',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as TIRED?',
    choices: ['exhausted', 'eager', 'awake', 'thrilled'],
    answer: 'exhausted',
  },

  // ===== SYNONYMS — hard =================================================
  {
    id: 'syn-melancholy',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as MELANCHOLY?',
    choices: ['gloomy', 'cheerful', 'curious', 'eager'],
    answer: 'gloomy',
    rule: '`melancholy` is a quiet, thoughtful sadness — `gloomy` is the closest fit.',
  },
  {
    id: 'syn-ponder',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as PONDER?',
    choices: ['think', 'shout', 'run', 'eat'],
    answer: 'think',
    rule: 'To `ponder` is to think carefully about something.',
  },
  {
    id: 'syn-vast',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as VAST?',
    choices: ['huge', 'narrow', 'crowded', 'shallow'],
    answer: 'huge',
  },
  {
    id: 'syn-weary',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as WEARY?',
    choices: ['exhausted', 'excited', 'angry', 'kind'],
    answer: 'exhausted',
  },

  // ===== ANTONYMS — easy =================================================
  {
    id: 'ant-hot',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of HOT?',
    choices: ['cold', 'warm', 'sunny', 'dry'],
    answer: 'cold',
  },
  {
    id: 'ant-big',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of BIG?',
    choices: ['small', 'large', 'wide', 'huge'],
    answer: 'small',
  },
  {
    id: 'ant-day',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of DAY?',
    choices: ['night', 'morning', 'noon', 'week'],
    answer: 'night',
  },
  {
    id: 'ant-up',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of UP?',
    choices: ['down', 'over', 'around', 'beside'],
    answer: 'down',
  },
  {
    id: 'ant-happy',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of HAPPY?',
    choices: ['sad', 'glad', 'merry', 'cheery'],
    answer: 'sad',
  },
  {
    id: 'ant-fast',
    skill: 'antonyms',
    tier: 'easy',
    prompt: 'Which word means the OPPOSITE of FAST?',
    choices: ['slow', 'quick', 'speedy', 'sudden'],
    answer: 'slow',
  },

  // ===== ANTONYMS — medium ===============================================
  {
    id: 'ant-brave',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of BRAVE?',
    choices: ['cowardly', 'bold', 'daring', 'fearless'],
    answer: 'cowardly',
  },
  {
    id: 'ant-generous',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of GENEROUS?',
    choices: ['stingy', 'giving', 'kind', 'caring'],
    answer: 'stingy',
  },
  {
    id: 'ant-ancient',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of ANCIENT?',
    choices: ['modern', 'old', 'worn', 'dusty'],
    answer: 'modern',
  },
  {
    id: 'ant-friend',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of FRIEND?',
    choices: ['enemy', 'buddy', 'pal', 'neighbor'],
    answer: 'enemy',
  },

  // ===== ANTONYMS — hard =================================================
  {
    id: 'ant-humble',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of HUMBLE?',
    choices: ['boastful', 'kind', 'quiet', 'modest'],
    answer: 'boastful',
    rule: '`humble` means modest about yourself — `boastful` is the opposite.',
  },
  {
    id: 'ant-clever',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of CLEVER?',
    choices: ['foolish', 'smart', 'sharp', 'bright'],
    answer: 'foolish',
  },
  {
    id: 'ant-permit',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of PERMIT?',
    choices: ['forbid', 'allow', 'accept', 'agree'],
    answer: 'forbid',
    rule: 'To `permit` is to allow — to `forbid` is to not allow.',
  },
  {
    id: 'ant-scarce',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of SCARCE?',
    choices: ['plentiful', 'rare', 'few', 'limited'],
    answer: 'plentiful',
  },

  // ===== SHADE OF MEANING — easy =========================================
  {
    id: 'shade-whisper',
    skill: 'shade',
    tier: 'easy',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'She ____ her secret so no one else would hear.',
    choices: ['whispered', 'yelled', 'screamed', 'shouted'],
    answer: 'whispered',
    rule: 'A secret is told quietly — `whispered` fits best. The others are all loud.',
  },
  {
    id: 'shade-gobbled',
    skill: 'shade',
    tier: 'easy',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The hungry puppy ____ his food in two seconds.',
    choices: ['gobbled', 'nibbled', 'tasted', 'sipped'],
    answer: 'gobbled',
    rule: 'A hungry puppy eats fast and big — `gobbled` matches; the others are small and slow.',
  },
  {
    id: 'shade-strolled',
    skill: 'shade',
    tier: 'easy',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'On a lazy summer evening, we ____ along the lake.',
    choices: ['strolled', 'sprinted', 'dashed', 'raced'],
    answer: 'strolled',
    rule: '`Lazy evening` means slow and easy — `strolled` fits; the others are fast.',
  },
  {
    id: 'shade-giggled',
    skill: 'shade',
    tier: 'easy',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The toddler ____ when the puppy licked her nose.',
    choices: ['giggled', 'roared', 'snorted', 'cackled'],
    answer: 'giggled',
    rule: 'Toddlers `giggle` — the others are bigger, harsher kinds of laughing.',
  },

  // ===== SHADE OF MEANING — medium =======================================
  {
    id: 'shade-glared',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'When her brother broke the toy, Mia ____ at him.',
    choices: ['glared', 'glanced', 'peeked', 'winked'],
    answer: 'glared',
    rule: '`Glared` is an angry look — fits when she\'s upset. The others are quick or friendly.',
  },
  {
    id: 'shade-trudged',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'Tired and muddy, the hikers ____ up the last hill.',
    choices: ['trudged', 'skipped', 'pranced', 'bounded'],
    answer: 'trudged',
    rule: '`Trudged` means walked with heavy, tired steps — fits exhausted hikers.',
  },
  {
    id: 'shade-pleaded',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: '"Please, just five more minutes!" the boy ____.',
    choices: ['pleaded', 'demanded', 'ordered', 'commanded'],
    answer: 'pleaded',
    rule: '`Please` is begging — `pleaded` fits. The others are bossy.',
  },
  {
    id: 'shade-mumbled',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'Half asleep, he ____ his answer into his pillow.',
    choices: ['mumbled', 'announced', 'proclaimed', 'declared'],
    answer: 'mumbled',
    rule: '`Mumbled` means spoke unclearly — fits a half-asleep voice. The others are big and clear.',
  },
  {
    id: 'shade-sparkled',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The fresh snow ____ in the morning sun.',
    choices: ['sparkled', 'burned', 'blazed', 'flared'],
    answer: 'sparkled',
    rule: 'Snow doesn\'t burn — `sparkled` is the gentle shine that fits.',
  },

  // ===== SHADE OF MEANING — hard =========================================
  {
    id: 'shade-melancholy',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'On the last day of summer, Grandpa felt a quiet, ____ mood.',
    choices: ['melancholy', 'furious', 'frantic', 'panicked'],
    answer: 'melancholy',
    rule: '`Melancholy` is a soft, thoughtful sadness — fits a quiet end-of-summer mood.',
  },
  {
    id: 'shade-curious',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The ____ kitten poked her nose into every box she found.',
    choices: ['curious', 'cautious', 'fearful', 'timid'],
    answer: 'curious',
    rule: 'Poking into boxes shows interest — `curious` fits. The others would hide.',
  },
  {
    id: 'shade-stern',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The coach gave a ____ but fair warning after the foul.',
    choices: ['stern', 'playful', 'cheerful', 'jolly'],
    answer: 'stern',
    rule: 'A warning needs to feel serious — `stern` fits; the others are too light.',
  },
  {
    id: 'shade-frantic',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'When she realized the bus was leaving, Maya made a ____ dash to the door.',
    choices: ['frantic', 'casual', 'relaxed', 'leisurely'],
    answer: 'frantic',
    rule: 'A missed bus is a panic — `frantic` fits; the others are calm.',
  },

  // ===== REPETITION FIXES — easy =========================================
  {
    id: 'rep-said',
    skill: 'repetition',
    tier: 'easy',
    prompt: 'Replace the second "said" with a better word:',
    context: '"Look at this!" Mia said. "I found a frog," she said again.',
    choices: ['exclaimed', 'said', 'said again', 'told'],
    answer: 'exclaimed',
    rule: '`Exclaimed` works because she\'s excited about the frog — and it isn\'t a repeat of "said".',
  },
  {
    id: 'rep-big',
    skill: 'repetition',
    tier: 'easy',
    prompt: 'Replace the second "big" with a better word:',
    context: 'The big elephant lived in a big jungle.',
    choices: ['huge', 'big', 'small', 'tall'],
    answer: 'huge',
  },
  {
    id: 'rep-nice',
    skill: 'repetition',
    tier: 'easy',
    prompt: 'Replace the second "nice" with a better word:',
    context: 'It was a nice day, and we had a nice picnic.',
    choices: ['lovely', 'nice', 'okay', 'fine'],
    answer: 'lovely',
  },
  {
    id: 'rep-good',
    skill: 'repetition',
    tier: 'easy',
    prompt: 'Replace the second "good" with a better word:',
    context: 'That was a good book, and the ending was good too.',
    choices: ['excellent', 'good', 'bad', 'long'],
    answer: 'excellent',
  },

  // ===== REPETITION FIXES — medium =======================================
  {
    id: 'rep-walked',
    skill: 'repetition',
    tier: 'medium',
    prompt: 'Replace the second "walked" with a better word:',
    context: 'We walked to the park, then walked around the pond.',
    choices: ['strolled', 'walked', 'jumped', 'sat'],
    answer: 'strolled',
    rule: '`Strolled` is a kind of walking — fits the second sentence without repeating.',
  },
  {
    id: 'rep-scared',
    skill: 'repetition',
    tier: 'medium',
    prompt: 'Replace the second "scared" with a better word:',
    context: 'The thunder scared the dog, and the lightning scared him even more.',
    choices: ['terrified', 'scared', 'amused', 'pleased'],
    answer: 'terrified',
  },
  {
    id: 'rep-pretty',
    skill: 'repetition',
    tier: 'medium',
    prompt: 'Replace the second "pretty" with a better word:',
    context: 'The pretty garden was full of pretty flowers.',
    choices: ['colorful', 'pretty', 'plain', 'wide'],
    answer: 'colorful',
  },
  {
    id: 'rep-happy',
    skill: 'repetition',
    tier: 'medium',
    prompt: 'Replace the second "happy" with a better word:',
    context: 'Grandma was happy to see us, and we were happy to visit.',
    choices: ['delighted', 'happy', 'tired', 'busy'],
    answer: 'delighted',
  },

  // ===== REPETITION FIXES — hard =========================================
  {
    id: 'rep-looked',
    skill: 'repetition',
    tier: 'hard',
    prompt: 'Replace the second "looked" with a better word:',
    context: 'Sam looked at the map, then looked closely at one trail.',
    choices: ['studied', 'looked', 'ignored', 'forgot'],
    answer: 'studied',
    rule: '`Studied` means looked carefully — fits "closely" without repeating.',
  },
  {
    id: 'rep-told',
    skill: 'repetition',
    tier: 'hard',
    prompt: 'Replace the second "told" with a better word:',
    context: 'Dad told us a joke, then told the whole story about his trip.',
    choices: ['narrated', 'told', 'asked', 'sang'],
    answer: 'narrated',
  },
  {
    id: 'rep-asked',
    skill: 'repetition',
    tier: 'hard',
    prompt: 'Replace the second "asked" with a better word:',
    context: 'The teacher asked a question, then asked again when no one answered.',
    choices: ['repeated', 'asked', 'shouted', 'whispered'],
    answer: 'repeated',
  },

  // ===== STRENGTH SCALE — easy ===========================================
  {
    id: 'str-cold-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the COLDEST?',
    choices: ['cool', 'chilly', 'cold', 'freezing'],
    answer: 'freezing',
    rule: 'Order: cool → chilly → cold → freezing. `Freezing` is the strongest.',
  },
  {
    id: 'str-hot-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the HOTTEST?',
    choices: ['warm', 'hot', 'toasty', 'scorching'],
    answer: 'scorching',
    rule: 'Order: warm → toasty → hot → scorching. `Scorching` is the strongest.',
  },
  {
    id: 'str-big-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the BIGGEST?',
    choices: ['big', 'large', 'huge', 'gigantic'],
    answer: 'gigantic',
  },
  {
    id: 'str-small-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the SMALLEST?',
    choices: ['small', 'little', 'tiny', 'microscopic'],
    answer: 'microscopic',
    rule: '`Microscopic` means so small you need a microscope — the strongest "small".',
  },

  // ===== STRENGTH SCALE — medium =========================================
  {
    id: 'str-happy-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the MOST happiness?',
    choices: ['glad', 'pleased', 'happy', 'overjoyed'],
    answer: 'overjoyed',
    rule: '`Overjoyed` means SO happy you can hardly contain it — stronger than glad/pleased.',
  },
  {
    id: 'str-mad-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the MOST anger?',
    choices: ['annoyed', 'mad', 'angry', 'furious'],
    answer: 'furious',
    rule: 'Order: annoyed → mad → angry → furious. `Furious` is rage-level.',
  },
  {
    id: 'str-tired-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows being the MOST tired?',
    choices: ['sleepy', 'tired', 'weary', 'exhausted'],
    answer: 'exhausted',
  },
  {
    id: 'str-cold-weakest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word means the LEAST cold (just a tiny bit cold)?',
    choices: ['cool', 'cold', 'freezing', 'frigid'],
    answer: 'cool',
    rule: 'Order: cool → cold → freezing → frigid. `Cool` is the gentlest.',
  },

  // ===== STRENGTH SCALE — hard ===========================================
  {
    id: 'str-sad-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word shows the DEEPEST sadness?',
    choices: ['blue', 'sad', 'gloomy', 'devastated'],
    answer: 'devastated',
    rule: '`Devastated` means crushed by grief — much stronger than blue or sad.',
  },
  {
    id: 'str-good-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word means the BEST?',
    choices: ['okay', 'good', 'great', 'excellent'],
    answer: 'excellent',
  },
  {
    id: 'str-scared-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word shows the MOST fear?',
    choices: ['nervous', 'scared', 'afraid', 'terrified'],
    answer: 'terrified',
    rule: 'Order: nervous → scared/afraid → terrified. `Terrified` is full-blown panic.',
  },
  {
    id: 'str-funny-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word means the FUNNIEST?',
    choices: ['amusing', 'funny', 'hilarious', 'silly'],
    answer: 'hilarious',
    rule: '`Hilarious` means SO funny you can\'t stop laughing — stronger than amusing/funny.',
  },

  // ===== STRENGTH SCALE — additional (focus area: had only 12) ===========

  // -- easy --
  {
    id: 'str-wet-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the WETTEST?',
    choices: ['damp', 'wet', 'soaked', 'drenched'],
    answer: 'drenched',
    rule: 'Order: damp → wet → soaked → drenched. `Drenched` means dripping wet all over.',
  },
  {
    id: 'str-dry-strongest',
    skill: 'strength',
    tier: 'easy',
    prompt: 'Which word means the DRIEST?',
    choices: ['dry', 'dusty', 'parched', 'bone-dry'],
    answer: 'bone-dry',
    rule: '`Bone-dry` means as dry as a bone — there\'s no moisture left at all.',
  },

  // -- medium --
  {
    id: 'str-rain-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the HEAVIEST rain?',
    choices: ['drizzle', 'rain', 'pour', 'downpour'],
    answer: 'downpour',
    rule: 'Order: drizzle (lightest) → rain → pour → downpour (heaviest). A downpour is buckets coming down.',
  },
  {
    id: 'str-loud-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the LOUDEST sound?',
    choices: ['quiet', 'loud', 'noisy', 'deafening'],
    answer: 'deafening',
    rule: '`Deafening` means so loud you almost can\'t hear afterwards — stronger than just "loud".',
  },
  {
    id: 'str-hunger-strongest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the MOST hunger?',
    choices: ['peckish', 'hungry', 'famished', 'starving'],
    answer: 'starving',
    rule: 'Order: peckish (just a little) → hungry → famished → starving (could eat anything!).',
  },
  {
    id: 'str-mad-weakest',
    skill: 'strength',
    tier: 'medium',
    prompt: 'Which word shows the LEAST anger (just a tiny bit upset)?',
    choices: ['annoyed', 'angry', 'mad', 'furious'],
    answer: 'annoyed',
    rule: 'Order: annoyed → mad → angry → furious. `Annoyed` is the gentlest — a small bother.',
  },

  // -- hard --
  {
    id: 'str-pretty-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word shows the GREATEST beauty?',
    choices: ['cute', 'pretty', 'beautiful', 'stunning'],
    answer: 'stunning',
    rule: 'Order: cute → pretty → beautiful → stunning. `Stunning` is so beautiful it stops you in your tracks.',
  },
  {
    id: 'str-clean-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word means the CLEANEST?',
    choices: ['tidy', 'clean', 'spotless', 'sparkling'],
    answer: 'sparkling',
    rule: 'Order: tidy → clean → spotless → sparkling. `Sparkling` means shining-clean, no dirt anywhere.',
  },
  {
    id: 'str-bad-strongest',
    skill: 'strength',
    tier: 'hard',
    prompt: 'Which word means the WORST?',
    choices: ['not great', 'bad', 'terrible', 'awful'],
    answer: 'awful',
    rule: 'Order: not great → bad → terrible → awful. `Awful` is the heaviest — really, really bad.',
  },

  // ===== SHADE OF MEANING — additional (medium/hard focus) ===============

  // -- medium --
  {
    id: 'shade-snickered',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The students ____ when the teacher\'s pen squeaked.',
    choices: ['snickered', 'wept', 'sobbed', 'wailed'],
    answer: 'snickered',
    rule: '`Snickered` is a small, sneaky laugh — fits a classroom moment. The others are crying.',
  },
  {
    id: 'shade-marched',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'Angry about losing, Jack ____ straight to his room.',
    choices: ['marched', 'skipped', 'tiptoed', 'wandered'],
    answer: 'marched',
    rule: '`Marched` means walked stiffly with purpose — fits being upset. The others are calm or playful.',
  },
  {
    id: 'shade-clutched',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The little girl ____ her teddy bear during the storm.',
    choices: ['clutched', 'dropped', 'tossed', 'flung'],
    answer: 'clutched',
    rule: '`Clutched` means held tightly — fits a scared girl. The others are letting go.',
  },
  {
    id: 'shade-shimmered',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The calm lake ____ in the moonlight.',
    choices: ['shimmered', 'crashed', 'roared', 'thundered'],
    answer: 'shimmered',
    rule: '`Shimmered` is a soft, wavy shine — fits a calm lake. The others are loud and violent.',
  },
  {
    id: 'shade-tumbled',
    skill: 'shade',
    tier: 'medium',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The puppy ____ down the hill, paws over ears.',
    choices: ['tumbled', 'glided', 'soared', 'drifted'],
    answer: 'tumbled',
    rule: '`Tumbled` means rolling head over heels — fits a puppy rolling. The others are smooth or floating.',
  },

  // -- hard --
  {
    id: 'shade-ancient',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The museum had ____ pottery from 3,000 years ago.',
    choices: ['ancient', 'used', 'aged', 'mature'],
    answer: 'ancient',
    rule: '`Ancient` means SUPER old (thousands of years) — fits 3,000-year-old pottery. The others mean just somewhat old.',
  },
  {
    id: 'shade-savored',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'Grandma slowly ____ each bite of her birthday cake.',
    choices: ['savored', 'gulped', 'gobbled', 'devoured'],
    answer: 'savored',
    rule: '`Savored` means enjoyed slowly, tasting each bit — fits a special slow moment. The others are fast eating.',
  },
  {
    id: 'shade-vast',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'From the mountain top we looked over the ____ valley below.',
    choices: ['vast', 'cramped', 'narrow', 'crowded'],
    answer: 'vast',
    rule: '`Vast` means huge and wide-open — fits a valley seen from a mountain. The others mean tight or full.',
  },
  {
    id: 'shade-startled',
    skill: 'shade',
    tier: 'hard',
    prompt: 'Pick the BEST word for the sentence:',
    context: 'The deer was ____ by the snap of a twig.',
    choices: ['startled', 'amused', 'bored', 'delighted'],
    answer: 'startled',
    rule: '`Startled` means suddenly surprised in a jumpy way — fits a deer hearing a noise. The others are positive or calm.',
  },

  // ===== SYNONYMS — additional medium/hard ==============================
  {
    id: 'syn-rapid',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as RAPID?',
    choices: ['quick', 'slow', 'heavy', 'gentle'],
    answer: 'quick',
    rule: '`Rapid` means fast — `quick` is its closest match.',
  },
  {
    id: 'syn-jolly',
    skill: 'synonyms',
    tier: 'medium',
    prompt: 'Which word means about the SAME as JOLLY?',
    choices: ['cheerful', 'tired', 'rude', 'silent'],
    answer: 'cheerful',
    rule: '`Jolly` means happy and full of fun — `cheerful` is the close match.',
  },
  {
    id: 'syn-frigid',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as FRIGID?',
    choices: ['freezing', 'warm', 'breezy', 'mild'],
    answer: 'freezing',
    rule: '`Frigid` means extremely cold — `freezing` is the close match.',
  },
  {
    id: 'syn-quarrel',
    skill: 'synonyms',
    tier: 'hard',
    prompt: 'Which word means about the SAME as QUARREL?',
    choices: ['argue', 'agree', 'help', 'whisper'],
    answer: 'argue',
    rule: 'To `quarrel` is to argue — they\'re both about fighting with words.',
  },

  // ===== ANTONYMS — additional medium/hard ===============================
  {
    id: 'ant-shallow',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of SHALLOW?',
    choices: ['deep', 'narrow', 'wide', 'flat'],
    answer: 'deep',
    rule: '`Shallow` means not very deep — `deep` is the opposite.',
  },
  {
    id: 'ant-arrive',
    skill: 'antonyms',
    tier: 'medium',
    prompt: 'Which word means the OPPOSITE of ARRIVE?',
    choices: ['leave', 'enter', 'return', 'stay'],
    answer: 'leave',
    rule: 'To `arrive` is to come somewhere; to `leave` is to go away.',
  },
  {
    id: 'ant-fragile',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of FRAGILE?',
    choices: ['sturdy', 'delicate', 'thin', 'breakable'],
    answer: 'sturdy',
    rule: '`Fragile` means easily broken — `sturdy` means strong and tough to break.',
  },
  {
    id: 'ant-victory',
    skill: 'antonyms',
    tier: 'hard',
    prompt: 'Which word means the OPPOSITE of VICTORY?',
    choices: ['defeat', 'win', 'success', 'reward'],
    answer: 'defeat',
    rule: '`Victory` is winning — `defeat` is losing.',
  },
];

// ----- Helpers --------------------------------------------------------------

export function getItem(id: string): ThesaurusItem | undefined {
  return THESAURUS_ITEMS.find((it) => it.id === id);
}

// Pull `count` items from the pool, filtered by tier and/or skill.
// Random sample, no replacement within a single round.
export function pickRoundItems(
  options: { tier?: ThesaurusTier; skill?: ThesaurusSkill | 'mixed' },
  count: number,
): ThesaurusItem[] {
  let pool = THESAURUS_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.skill && options.skill !== 'mixed') {
    pool = pool.filter((it) => it.skill === options.skill);
  }
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Per-item shuffled choices (so position of the answer changes each round).
export function shuffledChoices(item: ThesaurusItem): string[] {
  const arr = item.choices.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
