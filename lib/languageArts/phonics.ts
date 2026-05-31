// Phonics & Sounds — Language Arts Phase L4 dataset.
//
// A multi-mode phonics drill. Each item carries its own `mode` so the kid
// rotates through different question shapes within a round instead of doing
// 20 identical "pick the digraph" problems back to back.
//
// Modes:
//   - find-sound:     "Which word starts with /sh/?"      (pick 1 of 4 words)
//   - identify-sound: "What sound does `ee` make?"        (pick 1 of 3-4 word-anchored phonemes)
//   - find-blend:     "Pick the blend you hear in 'truck'." (pick 1 of 4 blends)
//   - long-vs-short:  "Find the word with a LONG vowel."  (pick 1 of 4 words)
//
// Tiers (difficulty of the SOUND distinction, not vocab):
//   - easy:   short vowels, simple consonant sounds
//   - medium: common blends (bl, st, tr), basic digraphs (ch, sh, th)
//   - hard:   vowel teams (ea, oa, ie), tricky digraphs (ph, ng), long vs short
//
// Word choices are kept at 3rd-grade reading level or below. Distractors
// must differ phonetically from the answer, not just orthographically — e.g.
// for /sh/, distractors should clearly NOT start with /sh/ ("ship vs sip vs
// chip vs hip"), so a kid who hears the sound can pick correctly.

export type PhonicsTier = 'easy' | 'medium' | 'hard';

export type PhonicsSkill = 'vowels' | 'blends' | 'digraphs' | 'vowel-teams';

export type PhonicsMode =
  | 'find-sound'
  | 'identify-sound'
  | 'find-blend'
  | 'long-vs-short';

export type PhonicsItem = {
  id: string;
  skill: PhonicsSkill;
  tier: PhonicsTier;
  mode: PhonicsMode;
  prompt: string;
  choices: string[];
  answer: string;
  // Short explanation shown after a wrong answer.
  rule?: string;
};

// ----- Items -----

export const PHONICS_ITEMS: PhonicsItem[] = [
  // ==========================================================================
  // VOWELS — easy (short vowels)
  // ==========================================================================
  {
    id: 'v-short-a-1',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /a/ sound (like in 'cat')?",
    choices: ['cake', 'cat', 'kite', 'cute'],
    answer: 'cat',
    rule: "Short /a/ sounds like the 'a' in 'cat', 'map', and 'hat'.",
  },
  {
    id: 'v-short-e-1',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /e/ sound (like in 'bed')?",
    choices: ['bead', 'bite', 'bed', 'boat'],
    answer: 'bed',
    rule: "Short /e/ sounds like the 'e' in 'bed', 'pen', and 'red'.",
  },
  {
    id: 'v-short-i-1',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /i/ sound (like in 'sit')?",
    choices: ['site', 'sit', 'seat', 'soot'],
    answer: 'sit',
    rule: "Short /i/ sounds like the 'i' in 'sit', 'pig', and 'win'.",
  },
  {
    id: 'v-short-o-1',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /o/ sound (like in 'hot')?",
    choices: ['hope', 'hoot', 'hot', 'hate'],
    answer: 'hot',
    rule: "Short /o/ sounds like the 'o' in 'hot', 'mop', and 'dog'.",
  },
  {
    id: 'v-short-u-1',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /u/ sound (like in 'cup')?",
    choices: ['cute', 'coat', 'cup', 'cape'],
    answer: 'cup',
    rule: "Short /u/ sounds like the 'u' in 'cup', 'sun', and 'bug'.",
  },
  {
    id: 'v-short-a-2',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /a/ sound?",
    choices: ['rain', 'man', 'mean', 'moon'],
    answer: 'man',
  },
  {
    id: 'v-short-e-2',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /e/ sound?",
    choices: ['neat', 'net', 'note', 'nut'],
    answer: 'net',
  },
  {
    id: 'v-short-i-2',
    skill: 'vowels',
    tier: 'easy',
    mode: 'find-sound',
    prompt: "Which word has the short /i/ sound?",
    choices: ['pin', 'pine', 'pane', 'pound'],
    answer: 'pin',
  },
  {
    id: 'v-identify-a',
    skill: 'vowels',
    tier: 'easy',
    mode: 'identify-sound',
    prompt: "What short vowel sound do you hear in 'bag'?",
    choices: ["/a/ like 'cat'", "/e/ like 'bed'", "/i/ like 'sit'", "/o/ like 'hot'"],
    answer: "/a/ like 'cat'",
  },
  {
    id: 'v-identify-u',
    skill: 'vowels',
    tier: 'easy',
    mode: 'identify-sound',
    prompt: "What short vowel sound do you hear in 'jump'?",
    choices: ["/u/ like 'cup'", "/o/ like 'hot'", "/a/ like 'cat'", "/i/ like 'sit'"],
    answer: "/u/ like 'cup'",
  },

  // ==========================================================================
  // BLENDS — medium
  // ==========================================================================
  {
    id: 'b-bl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'blue'?",
    choices: ['bl', 'br', 'pl', 'cl'],
    answer: 'bl',
    rule: "A blend is two consonants whose sounds you can hear separately — 'bl' = /b/ + /l/.",
  },
  {
    id: 'b-br-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'bread'?",
    choices: ['br', 'bl', 'dr', 'pr'],
    answer: 'br',
  },
  {
    id: 'b-cl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'clock'?",
    choices: ['cl', 'cr', 'bl', 'gl'],
    answer: 'cl',
  },
  {
    id: 'b-cr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'crab'?",
    choices: ['cr', 'cl', 'tr', 'br'],
    answer: 'cr',
  },
  {
    id: 'b-dr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'drum'?",
    choices: ['dr', 'tr', 'br', 'gr'],
    answer: 'dr',
  },
  {
    id: 'b-fl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'flag'?",
    choices: ['fl', 'fr', 'pl', 'bl'],
    answer: 'fl',
  },
  {
    id: 'b-fr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'frog'?",
    choices: ['fr', 'fl', 'tr', 'pr'],
    answer: 'fr',
  },
  {
    id: 'b-gl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'glow'?",
    choices: ['gl', 'gr', 'bl', 'cl'],
    answer: 'gl',
  },
  {
    id: 'b-gr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'green'?",
    choices: ['gr', 'gl', 'cr', 'tr'],
    answer: 'gr',
  },
  {
    id: 'b-pl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'plate'?",
    choices: ['pl', 'pr', 'bl', 'cl'],
    answer: 'pl',
  },
  {
    id: 'b-pr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'prize'?",
    choices: ['pr', 'pl', 'br', 'tr'],
    answer: 'pr',
  },
  {
    id: 'b-sk-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'skate'?",
    choices: ['sk', 'sl', 'st', 'sp'],
    answer: 'sk',
  },
  {
    id: 'b-sl-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'sleep'?",
    choices: ['sl', 'sn', 'sm', 'st'],
    answer: 'sl',
  },
  {
    id: 'b-sm-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'smile'?",
    choices: ['sm', 'sn', 'sl', 'sp'],
    answer: 'sm',
  },
  {
    id: 'b-sn-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'snake'?",
    choices: ['sn', 'sm', 'sl', 'sk'],
    answer: 'sn',
  },
  {
    id: 'b-sp-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'spider'?",
    choices: ['sp', 'st', 'sk', 'sw'],
    answer: 'sp',
  },
  {
    id: 'b-st-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'star'?",
    choices: ['st', 'sp', 'sk', 'sl'],
    answer: 'st',
  },
  {
    id: 'b-sw-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'swim'?",
    choices: ['sw', 'sl', 'sm', 'sn'],
    answer: 'sw',
  },
  {
    id: 'b-tr-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'truck'?",
    choices: ['tr', 'dr', 'br', 'cr'],
    answer: 'tr',
  },
  {
    id: 'b-tw-1',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-blend',
    prompt: "Which blend do you hear at the start of 'twin'?",
    choices: ['tw', 'tr', 'sw', 'st'],
    answer: 'tw',
  },
  {
    id: 'b-find-bl',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the 'bl' blend?",
    choices: ['black', 'back', 'pack', 'rack'],
    answer: 'black',
  },
  {
    id: 'b-find-st',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the 'st' blend?",
    choices: ['sand', 'stop', 'soup', 'top'],
    answer: 'stop',
  },
  {
    id: 'b-find-tr',
    skill: 'blends',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the 'tr' blend?",
    choices: ['tree', 'three', 'tea', 'dee'],
    answer: 'tree',
    rule: "'tr' is a blend (/t/ + /r/). 'three' starts with the 'th' digraph instead.",
  },

  // ==========================================================================
  // DIGRAPHS — medium / hard
  // ==========================================================================
  {
    id: 'd-sh-1',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the /sh/ sound?",
    choices: ['ship', 'sip', 'chip', 'hip'],
    answer: 'ship',
    rule: "A digraph is two letters that make ONE sound. 'sh' makes the /sh/ sound, as in 'ship'.",
  },
  {
    id: 'd-ch-1',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the /ch/ sound?",
    choices: ['cheese', 'sheep', 'see', 'tease'],
    answer: 'cheese',
    rule: "'ch' makes the /ch/ sound, as in 'chair' or 'cheese'.",
  },
  {
    id: 'd-th-1',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the /th/ sound?",
    choices: ['thumb', 'sum', 'fun', 'gum'],
    answer: 'thumb',
    rule: "'th' makes the /th/ sound, as in 'thumb' or 'thin'.",
  },
  {
    id: 'd-wh-1',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word starts with the /wh/ sound?",
    choices: ['whale', 'wait', 'tail', 'sail'],
    answer: 'whale',
    rule: "'wh' makes a breathy /w/ sound, as in 'whale' or 'wheel'.",
  },
  {
    id: 'd-sh-2',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word has the /sh/ sound?",
    choices: ['fish', 'fit', 'fist', 'fig'],
    answer: 'fish',
  },
  {
    id: 'd-ch-2',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word has the /ch/ sound?",
    choices: ['lunch', 'lump', 'luck', 'lung'],
    answer: 'lunch',
  },
  {
    id: 'd-th-2',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'find-sound',
    prompt: "Which word has the /th/ sound?",
    choices: ['bath', 'bat', 'back', 'bag'],
    answer: 'bath',
  },
  {
    id: 'd-ph-1',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /f/ sound spelled with 'ph'?",
    choices: ['phone', 'fan', 'pin', 'pan'],
    answer: 'phone',
    rule: "'ph' is a digraph that makes the /f/ sound, like in 'phone' or 'graph'.",
  },
  {
    id: 'd-ph-2',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word uses 'ph' for the /f/ sound?",
    choices: ['graph', 'grab', 'gram', 'grin'],
    answer: 'graph',
  },
  {
    id: 'd-ck-1',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word ends with the 'ck' digraph?",
    choices: ['duck', 'dug', 'dud', 'done'],
    answer: 'duck',
    rule: "'ck' is a digraph at the END of short words for the /k/ sound — duck, sick, back.",
  },
  {
    id: 'd-ck-2',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word ends with 'ck'?",
    choices: ['rock', 'rod', 'rot', 'rope'],
    answer: 'rock',
  },
  {
    id: 'd-ng-1',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word ends with the /ng/ sound?",
    choices: ['ring', 'rim', 'rib', 'rid'],
    answer: 'ring',
    rule: "'ng' makes one nasal sound, like at the end of 'ring' or 'song'.",
  },
  {
    id: 'd-ng-2',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word ends with /ng/?",
    choices: ['king', 'kin', 'kit', 'kid'],
    answer: 'king',
  },
  {
    id: 'd-identify-sh',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'identify-sound',
    prompt: "What sound does 'sh' make?",
    choices: ["/sh/ like 'ship'", "/ch/ like 'chair'", "/s/ like 'sun'", "/h/ like 'hat'"],
    answer: "/sh/ like 'ship'",
  },
  {
    id: 'd-identify-ch',
    skill: 'digraphs',
    tier: 'medium',
    mode: 'identify-sound',
    prompt: "What sound does 'ch' make?",
    choices: ["/ch/ like 'chair'", "/sh/ like 'ship'", "/k/ like 'cat'", "/s/ like 'sun'"],
    answer: "/ch/ like 'chair'",
  },
  {
    id: 'd-identify-ph',
    skill: 'digraphs',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ph' make?",
    choices: ["/f/ like 'fan'", "/p/ like 'pan'", "/ph/ like 'puh-huh'", "/v/ like 'van'"],
    answer: "/f/ like 'fan'",
  },

  // ==========================================================================
  // VOWEL TEAMS — hard
  // ==========================================================================
  {
    id: 'vt-ai-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ai' team make?",
    choices: ["/ay/ like 'rain'", "/i/ like 'sit'", "/ah/ like 'hot'", "/eh/ like 'bed'"],
    answer: "/ay/ like 'rain'",
    rule: "'ai' is a vowel team that says long A — rain, train, mail.",
  },
  {
    id: 'vt-ay-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ay' team make?",
    choices: ["/ay/ like 'day'", "/a/ like 'cat'", "/i/ like 'sit'", "/oy/ like 'boy'"],
    answer: "/ay/ like 'day'",
    rule: "'ay' is a vowel team that says long A, usually at the END of a word — day, play, stay.",
  },
  {
    id: 'vt-ea-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ea' team make in 'team'?",
    choices: ["/ee/ like 'tree'", "/ay/ like 'day'", "/eh/ like 'bed'", "/ah/ like 'hot'"],
    answer: "/ee/ like 'tree'",
    rule: "'ea' usually says long E — team, eat, mean.",
  },
  {
    id: 'vt-ee-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ee' team make?",
    choices: ["/ee/ like 'tree'", "/eh/ like 'bed'", "/ay/ like 'day'", "/i/ like 'sit'"],
    answer: "/ee/ like 'tree'",
    rule: "'ee' always says long E — tree, see, feet.",
  },
  {
    id: 'vt-ie-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ie' make in 'pie'?",
    choices: ["/eye/ like 'pie'", "/ee/ like 'tree'", "/eh/ like 'bed'", "/i/ like 'sit'"],
    answer: "/eye/ like 'pie'",
    rule: "'ie' at the end of short words says long I — pie, tie, lie.",
  },
  {
    id: 'vt-oa-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'oa' team make?",
    choices: ["/oh/ like 'boat'", "/ah/ like 'hot'", "/oo/ like 'moon'", "/aw/ like 'paw'"],
    answer: "/oh/ like 'boat'",
    rule: "'oa' is a vowel team that says long O — boat, coat, road.",
  },
  {
    id: 'vt-oo-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'oo' make in 'moon'?",
    choices: ["/oo/ like 'moon'", "/oh/ like 'boat'", "/uh/ like 'cup'", "/ow/ like 'cow'"],
    answer: "/oo/ like 'moon'",
    rule: "'oo' can say a long /oo/ (moon, room) or a short /oo/ (book, foot).",
  },
  {
    id: 'vt-ou-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ou' make in 'cloud'?",
    choices: ["/ow/ like 'cow'", "/oo/ like 'moon'", "/oh/ like 'boat'", "/uh/ like 'cup'"],
    answer: "/ow/ like 'cow'",
    rule: "'ou' often makes the /ow/ sound — cloud, mouse, out.",
  },
  {
    id: 'vt-ow-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ow' make in 'cow'?",
    choices: ["/ow/ like 'cow'", "/oh/ like 'snow'", "/oo/ like 'moon'", "/uh/ like 'cup'"],
    answer: "/ow/ like 'cow'",
    rule: "'ow' can say /ow/ (cow, now) OR long O (snow, blow). Listen to the word!",
  },
  {
    id: 'vt-ue-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ue' team make in 'blue'?",
    choices: ["/oo/ like 'moon'", "/uh/ like 'cup'", "/eh/ like 'bed'", "/ay/ like 'day'"],
    answer: "/oo/ like 'moon'",
    rule: "'ue' usually says /oo/ — blue, glue, true.",
  },
  {
    id: 'vt-ui-1',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does the 'ui' team make in 'fruit'?",
    choices: ["/oo/ like 'moon'", "/i/ like 'sit'", "/eye/ like 'pie'", "/uh/ like 'cup'"],
    answer: "/oo/ like 'moon'",
    rule: "'ui' usually says /oo/ — fruit, suit, juice.",
  },
  {
    id: 'vt-find-ai',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ai' vowel team?",
    choices: ['rain', 'ran', 'run', 'rip'],
    answer: 'rain',
  },
  {
    id: 'vt-find-ee',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ee' vowel team?",
    choices: ['feet', 'fit', 'fat', 'fan'],
    answer: 'feet',
  },
  {
    id: 'vt-find-oa',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'oa' vowel team?",
    choices: ['goat', 'got', 'gut', 'get'],
    answer: 'goat',
  },
  {
    id: 'vt-find-oo',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'oo' vowel team?",
    choices: ['moon', 'mom', 'man', 'men'],
    answer: 'moon',
  },

  // ==========================================================================
  // LONG vs SHORT vowels — hard
  // ==========================================================================
  {
    id: 'lvs-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a LONG vowel sound?",
    choices: ['cake', 'cat', 'cap', 'cab'],
    answer: 'cake',
    rule: "A long vowel says its own NAME. Silent 'e' at the end usually makes the vowel long — cake, kite, hope.",
  },
  {
    id: 'lvs-2',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a SHORT vowel sound?",
    choices: ['hop', 'hope', 'hole', 'home'],
    answer: 'hop',
    rule: "A short vowel doesn't say its name. 'hop' has short /o/; 'hope/hole/home' have long /o/ (silent e).",
  },
  {
    id: 'lvs-3',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a LONG vowel sound?",
    choices: ['kite', 'kit', 'kin', 'kid'],
    answer: 'kite',
  },
  {
    id: 'lvs-4',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a SHORT vowel sound?",
    choices: ['pet', 'Pete', 'peat', 'peep'],
    answer: 'pet',
  },
  {
    id: 'lvs-5',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a LONG vowel sound?",
    choices: ['cute', 'cut', 'cup', 'cub'],
    answer: 'cute',
  },
  {
    id: 'lvs-6',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a SHORT vowel sound?",
    choices: ['bit', 'bite', 'bike', 'bide'],
    answer: 'bit',
  },
  {
    id: 'lvs-7',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a LONG vowel sound?",
    choices: ['note', 'not', 'nod', 'nob'],
    answer: 'note',
  },
  {
    id: 'lvs-8',
    skill: 'vowels',
    tier: 'hard',
    mode: 'long-vs-short',
    prompt: "Which word has a LONG vowel sound?",
    choices: ['tape', 'tap', 'tab', 'tan'],
    answer: 'tape',
  },

  // ==========================================================================
  // VOWEL TEAMS — additional HARD (more identify-sound + find-sound)
  // ==========================================================================
  {
    id: 'vt-ai-2',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ai' vowel team?",
    choices: ['mail', 'mall', 'mill', 'mole'],
    answer: 'mail',
    rule: "'ai' is a vowel team that says long A — mail, rain, paint.",
  },
  {
    id: 'vt-ay-2',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ay' vowel team?",
    choices: ['play', 'plot', 'plus', 'pal'],
    answer: 'play',
    rule: "'ay' usually says long A at the end of a word — play, day, stay.",
  },
  {
    id: 'vt-ea-2',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ea' vowel team saying long E?",
    choices: ['leaf', 'left', 'lift', 'loft'],
    answer: 'leaf',
    rule: "'ea' often says long E — leaf, eat, sea.",
  },
  {
    id: 'vt-ea-short',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ea' make in 'bread'?",
    choices: ["/eh/ like 'bed'", "/ee/ like 'tree'", "/ay/ like 'day'", "/eye/ like 'pie'"],
    answer: "/eh/ like 'bed'",
    rule: "'ea' USUALLY says long E (eat, mean) but sometimes says short E — bread, head, dead. Listen to the word!",
  },
  {
    id: 'vt-ow-long',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ow' make in 'snow'?",
    choices: ["/oh/ like 'boat'", "/ow/ like 'cow'", "/oo/ like 'moon'", "/uh/ like 'cup'"],
    answer: "/oh/ like 'boat'",
    rule: "'ow' can say /ow/ (cow, plow) OR long O (snow, blow, low). Listen to the word!",
  },
  {
    id: 'vt-oo-short',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'oo' make in 'book'?",
    choices: ["/oo/ short, like 'foot'", "/oo/ long, like 'moon'", "/oh/ like 'boat'", "/uh/ like 'cup'"],
    answer: "/oo/ short, like 'foot'",
    rule: "'oo' has TWO sounds: long /oo/ (moon, room) and short /oo/ (book, foot, look).",
  },
  {
    id: 'vt-find-ea',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ea' vowel team?",
    choices: ['team', 'tan', 'ten', 'tin'],
    answer: 'team',
  },
  {
    id: 'vt-find-ie',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ie' vowel team saying long I?",
    choices: ['tie', 'tin', 'tan', 'top'],
    answer: 'tie',
    rule: "'ie' at the end of short words says long I — tie, pie, lie.",
  },
  {
    id: 'vt-find-ou',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'ou' vowel team saying /ow/?",
    choices: ['mouse', 'most', 'mast', 'must'],
    answer: 'mouse',
    rule: "'ou' often makes the /ow/ sound — mouse, cloud, out.",
  },
  {
    id: 'vt-find-aw',
    skill: 'vowel-teams',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the 'aw' team saying /aw/?",
    choices: ['paw', 'pen', 'pin', 'pan'],
    answer: 'paw',
    rule: "'aw' makes the /aw/ sound — paw, claw, draw, saw.",
  },

  // ==========================================================================
  // R-CONTROLLED VOWELS — hard
  // (When a vowel is followed by R, the R changes the vowel sound.
  //  Categorized under 'vowels' to avoid adding a new skill enum.)
  // ==========================================================================
  {
    id: 'r-ar-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ar' make in 'car'?",
    choices: ["/ar/ like 'car'", "/a/ like 'cat'", "/air/ like 'chair'", "/or/ like 'corn'"],
    answer: "/ar/ like 'car'",
    rule: "When R follows A, you get the /ar/ sound — car, star, farm. The R 'controls' the A.",
  },
  {
    id: 'r-or-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'or' make in 'horn'?",
    choices: ["/or/ like 'corn'", "/o/ like 'hot'", "/oh/ like 'boat'", "/ar/ like 'car'"],
    answer: "/or/ like 'corn'",
    rule: "When R follows O, you get the /or/ sound — horn, corn, fork. The R 'controls' the O.",
  },
  {
    id: 'r-er-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'er' make in 'her'?",
    choices: ["/er/ like 'her'", "/eh/ like 'bed'", "/ee/ like 'tree'", "/ar/ like 'car'"],
    answer: "/er/ like 'her'",
    rule: "When R follows E, you get the /er/ sound — her, fern, herd.",
  },
  {
    id: 'r-ir-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ir' make in 'bird'?",
    choices: ["/er/ like 'her'", "/i/ like 'sit'", "/eye/ like 'pie'", "/ar/ like 'car'"],
    answer: "/er/ like 'her'",
    rule: "'er', 'ir', and 'ur' all make the SAME /er/ sound — bird, hurt, her all rhyme in the middle.",
  },
  {
    id: 'r-ur-1',
    skill: 'vowels',
    tier: 'hard',
    mode: 'identify-sound',
    prompt: "What sound does 'ur' make in 'turn'?",
    choices: ["/er/ like 'her'", "/uh/ like 'cup'", "/oo/ like 'moon'", "/or/ like 'corn'"],
    answer: "/er/ like 'her'",
    rule: "'ur' makes the same /er/ sound — turn, hurt, burn. (Same sound as 'er' and 'ir'.)",
  },
  {
    id: 'r-find-ar',
    skill: 'vowels',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /ar/ sound?",
    choices: ['barn', 'ban', 'born', 'burn'],
    answer: 'barn',
    rule: "/ar/ as in barn, star, farm.",
  },
  {
    id: 'r-find-or',
    skill: 'vowels',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /or/ sound?",
    choices: ['fork', 'far', 'fur', 'fern'],
    answer: 'fork',
    rule: "/or/ as in fork, corn, horn.",
  },
  {
    id: 'r-find-er',
    skill: 'vowels',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /er/ sound (spelled 'er')?",
    choices: ['fern', 'farm', 'fan', 'fun'],
    answer: 'fern',
    rule: "/er/ as in fern, her, herd.",
  },
  {
    id: 'r-find-ir',
    skill: 'vowels',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /er/ sound spelled with 'ir'?",
    choices: ['girl', 'goal', 'gull', 'gear'],
    answer: 'girl',
    rule: "'ir' makes the /er/ sound — girl, bird, sir.",
  },
  {
    id: 'r-find-ur',
    skill: 'vowels',
    tier: 'hard',
    mode: 'find-sound',
    prompt: "Which word has the /er/ sound spelled with 'ur'?",
    choices: ['hurt', 'hat', 'hit', 'hot'],
    answer: 'hurt',
    rule: "'ur' makes the /er/ sound — hurt, turn, burn.",
  },
];

// ----- Helpers -----

export function pickRoundItems(
  options: { tier?: PhonicsTier; skills?: PhonicsSkill[] },
  count: number,
): PhonicsItem[] {
  let pool = PHONICS_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.skills && options.skills.length > 0) {
    pool = pool.filter((it) => options.skills!.includes(it.skill));
  }
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Returns shuffled choices so the answer doesn't always sit in the same slot.
export function shuffleChoices(item: PhonicsItem): string[] {
  const out = item.choices.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
