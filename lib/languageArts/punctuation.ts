// Punctuation drill — Language Arts Phase L3 dataset.
//
// Each item is one of two shapes:
//   - mode 'fill': sentence has a single `___` blank; the kid picks ONE
//                  punctuation mark from a short set of choices.
//   - mode 'fix' : sentence is shown unpunctuated (or with a specific marked
//                  spot); the kid picks the correctly-punctuated version
//                  from a small set of full-sentence choices.
//
// Quality bar: every item must have ONE objectively correct answer. Style
// preferences (Oxford comma, em-dash spacing) are NOT quizzed.
//
// Tiers:
//   easy   — end punctuation, contractions, comma in a simple list
//   medium — possessive apostrophes, intro-phrase commas, dialog quotes
//   hard   — semicolons, colons, dash vs hyphen, comma before conjunctions

export type PunctuationSkill =
  | 'commas'
  | 'apostrophes'
  | 'quotes'
  | 'end-punct'
  | 'semicolon'
  | 'colon'
  | 'dash-hyphen';

export type PunctuationTier = 'easy' | 'medium' | 'hard';
export type PunctuationMode = 'fill' | 'fix';

export type PunctuationItem = {
  id: string;
  skill: PunctuationSkill;
  tier: PunctuationTier;
  mode: PunctuationMode;
  // For mode='fill', this sentence contains `___` where the mark goes.
  // For mode='fix', this is the bare sentence/phrase being asked about
  // (often shown as a prompt above the choices).
  prompt: string;
  // For 'fill' these are single-char punctuation marks ("," "'" etc.).
  // For 'fix' these are full sentence options.
  choices: string[];
  answer: string;
  rule?: string;
  hint?: string;
};

export const PUNCTUATION_ITEMS: PunctuationItem[] = [
  // ------------------------------------------------------------------------
  // EASY — end punctuation (fill)
  // ------------------------------------------------------------------------
  {
    id: 'end-easy-1',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'My dog loves to run in the yard___',
    choices: ['.', '?', '!'],
    answer: '.',
    rule: 'A statement (telling sentence) ends with a period.',
  },
  {
    id: 'end-easy-2',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'What time is dinner___',
    choices: ['.', '?', '!'],
    answer: '?',
    rule: 'A sentence that asks something ends with a question mark.',
  },
  {
    id: 'end-easy-3',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'Watch out for that bee___',
    choices: ['.', '?', '!'],
    answer: '!',
    rule: 'A sentence with strong feeling or a warning ends with an exclamation mark.',
  },
  {
    id: 'end-easy-4',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'Where did you put my book___',
    choices: ['.', '?', '!'],
    answer: '?',
    rule: 'Questions start with words like who, what, where, when, why — and end with `?`.',
  },
  {
    id: 'end-easy-5',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'I finished my chores___',
    choices: ['.', '?', '!'],
    answer: '.',
    rule: 'A telling sentence ends with a period.',
  },
  {
    id: 'end-easy-6',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'I can\'t believe we won___',
    choices: ['.', '?', '!'],
    answer: '!',
    rule: 'Big excitement gets an exclamation mark.',
  },
  {
    id: 'end-easy-7',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'Is anyone home___',
    choices: ['.', '?', '!'],
    answer: '?',
  },
  {
    id: 'end-easy-8',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'The book is on the shelf___',
    choices: ['.', '?', '!'],
    answer: '.',
  },

  // ------------------------------------------------------------------------
  // EASY — contractions (fill the apostrophe)
  // ------------------------------------------------------------------------
  {
    id: 'apos-easy-1',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fill',
    prompt: 'I do___nt want to go to bed yet.',
    choices: ["'", ',', '.'],
    answer: "'",
    rule: 'A contraction uses an apostrophe to stand in for missing letters. `don\'t` = `do not` (the apostrophe takes the place of the `o`).',
  },
  {
    id: 'apos-easy-2',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fill',
    prompt: 'We___ll be there soon.',
    choices: ["'", ',', '.'],
    answer: "'",
    rule: '`We\'ll` = `we will`. The apostrophe replaces `wi` in `will`.',
  },
  {
    id: 'apos-easy-3',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fill',
    prompt: 'She is___nt at school today.',
    choices: ["'", ',', '.'],
    answer: "'",
    rule: '`isn\'t` = `is not`. Apostrophe stands in for the missing `o`.',
  },
  {
    id: 'apos-easy-4',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fill',
    prompt: 'It___s sunny outside.',
    choices: ["'", ',', '.'],
    answer: "'",
    rule: '`it\'s` = `it is`. The apostrophe takes the place of the missing `i`.',
  },
  {
    id: 'apos-easy-5',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Which one is the right contraction for "they are"?',
    choices: ['theyre', "they're", 'theyr\'e', 'theyare'],
    answer: "they're",
    rule: 'In `they\'re`, the apostrophe replaces the `a` from `they are`.',
  },
  {
    id: 'apos-easy-6',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Which one is the right contraction for "cannot"?',
    choices: ['cant', "can't", 'can\'not', 'cann\'t'],
    answer: "can't",
    rule: '`can\'t` = `cannot`. The apostrophe replaces the missing letters.',
  },

  // ------------------------------------------------------------------------
  // EASY — comma in a simple list (fix mode)
  // ------------------------------------------------------------------------
  {
    id: 'comma-list-easy-1',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I packed apples bananas and grapes.',
      'I packed apples, bananas and grapes.',
      'I, packed apples bananas, and grapes.',
    ],
    answer: 'I packed apples, bananas and grapes.',
    rule: 'When you list three or more things, put a comma between each item.',
  },
  {
    id: 'comma-list-easy-2',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'My cat is soft fluffy and orange.',
      'My cat is soft, fluffy and orange.',
      'My cat is soft fluffy, and, orange.',
    ],
    answer: 'My cat is soft, fluffy and orange.',
    rule: 'Use commas to separate items in a list of three or more.',
  },
  {
    id: 'comma-list-easy-3',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'We saw lions tigers and bears at the zoo.',
      'We saw lions, tigers and bears at the zoo.',
      'We, saw lions tigers and bears at the zoo.',
    ],
    answer: 'We saw lions, tigers and bears at the zoo.',
    rule: 'Lists of three or more need commas between items.',
  },
  {
    id: 'comma-list-easy-4',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'For lunch I had a sandwich an apple and milk.',
      'For lunch I had a sandwich, an apple and milk.',
      'For lunch, I, had a sandwich an apple and milk.',
    ],
    answer: 'For lunch I had a sandwich, an apple and milk.',
    rule: 'Separate listed items with commas.',
  },

  // ------------------------------------------------------------------------
  // MEDIUM — possessive apostrophes (singular)
  // ------------------------------------------------------------------------
  {
    id: 'apos-poss-1',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which sentence shows that the hat belongs to Sam?',
    choices: [
      'Sams hat is on the chair.',
      "Sam's hat is on the chair.",
      "Sams' hat is on the chair.",
    ],
    answer: "Sam's hat is on the chair.",
    rule: "To show one person owns something, add `'s` to their name. Sam's hat = the hat that belongs to Sam.",
  },
  {
    id: 'apos-poss-2',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which sentence shows that the bone belongs to the dog?',
    choices: [
      "The dogs bone is buried.",
      "The dog's bone is buried.",
      "The dogs' bone is buried.",
    ],
    answer: "The dog's bone is buried.",
    rule: "One dog → add `'s` to show ownership: the dog's bone.",
  },
  {
    id: 'apos-poss-3',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which sentence shows that the car belongs to Dad?',
    choices: [
      "Dads car needs gas.",
      "Dad's car needs gas.",
      "Dads' car needs gas.",
    ],
    answer: "Dad's car needs gas.",
    rule: "Add `'s` to a singular noun to show ownership.",
  },
  // possessive apostrophe — plural ending in s
  {
    id: 'apos-poss-4',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which sentence shows that the toys belong to several boys (more than one)?',
    choices: [
      "The boys toys are in the box.",
      "The boy's toys are in the box.",
      "The boys' toys are in the box.",
    ],
    answer: "The boys' toys are in the box.",
    rule: "When a plural already ends in `s`, just add an apostrophe AFTER the s: the boys' toys = toys belonging to more than one boy.",
  },
  {
    id: 'apos-poss-5',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which sentence shows that the nest belongs to one bird?',
    choices: [
      "The birds nest is high in the tree.",
      "The bird's nest is high in the tree.",
      "The birds' nest is high in the tree.",
    ],
    answer: "The bird's nest is high in the tree.",
    rule: "One bird → add `'s` for ownership.",
  },
  {
    id: 'apos-poss-6',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which one is right?',
    choices: [
      "The two girls bikes are red.",
      "The two girl's bikes are red.",
      "The two girls' bikes are red.",
    ],
    answer: "The two girls' bikes are red.",
    rule: "Two girls (plural) own the bikes — plural that ends in `s` takes an apostrophe after the s: girls'.",
  },

  // ------------------------------------------------------------------------
  // MEDIUM — comma after introductory phrase
  // ------------------------------------------------------------------------
  {
    id: 'comma-intro-1',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'After dinner we went for a walk.',
      'After dinner, we went for a walk.',
      'After, dinner we went for a walk.',
    ],
    answer: 'After dinner, we went for a walk.',
    rule: 'Put a comma after an introductory phrase that sets the scene (when, where, or how something happens).',
  },
  {
    id: 'comma-intro-2',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'When the bell rang the kids ran outside.',
      'When the bell rang, the kids ran outside.',
      'When, the bell rang the kids, ran outside.',
    ],
    answer: 'When the bell rang, the kids ran outside.',
    rule: 'After an opening phrase like "When the bell rang," add a comma before the main sentence begins.',
  },
  {
    id: 'comma-intro-3',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'In the morning I feed the chickens.',
      'In the morning, I feed the chickens.',
      'In, the morning I feed the chickens.',
    ],
    answer: 'In the morning, I feed the chickens.',
    rule: 'Short opening phrases that tell WHEN something happens are followed by a comma.',
  },
  {
    id: 'comma-intro-4',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Before you eat please wash your hands.',
      'Before you eat, please wash your hands.',
      'Before, you eat please wash your hands.',
    ],
    answer: 'Before you eat, please wash your hands.',
    rule: 'A comma goes after an introductory clause like "Before you eat".',
  },
  {
    id: 'comma-intro-5',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Yes I would like more milk.',
      'Yes, I would like more milk.',
      'Yes I would like, more milk.',
    ],
    answer: 'Yes, I would like more milk.',
    rule: 'Use a comma after `Yes`, `No`, or `Well` at the start of a sentence.',
  },

  // ------------------------------------------------------------------------
  // MEDIUM — quotation marks for dialog
  // ------------------------------------------------------------------------
  {
    id: 'quotes-1',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the sentence that correctly shows what Mom said.',
    choices: [
      'Mom said it is time for bed.',
      'Mom said, "It is time for bed."',
      'Mom said, It is time for bed.',
    ],
    answer: 'Mom said, "It is time for bed."',
    rule: 'Put quotation marks around the EXACT words a person says. A comma comes before the opening quote, and the end punctuation goes INSIDE the closing quote.',
  },
  {
    id: 'quotes-2',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the sentence that correctly shows what the teacher asked.',
    choices: [
      'The teacher asked, "Who knows the answer?"',
      'The teacher asked, Who knows the answer?',
      'The teacher asked "who knows the answer?".',
    ],
    answer: 'The teacher asked, "Who knows the answer?"',
    rule: 'Spoken words sit inside quotation marks. The first spoken word is capitalized.',
  },
  {
    id: 'quotes-3',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      '"I love this song!" shouted Lily.',
      'I love this song! shouted Lily.',
      '"I love this song! shouted Lily."',
    ],
    answer: '"I love this song!" shouted Lily.',
    rule: 'The quotation marks wrap ONLY the words actually spoken. The `!` belongs to Lily\'s words, so it sits inside the quote.',
  },
  {
    id: 'quotes-4',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Dad whispered, "Don\'t wake the baby."',
      'Dad whispered, Don\'t wake the baby.',
      'Dad whispered "Don\'t wake the baby".',
    ],
    answer: 'Dad whispered, "Don\'t wake the baby."',
    rule: 'Comma BEFORE the quote, period INSIDE the closing quotation mark.',
  },
  {
    id: 'quotes-5',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'My favorite book is Charlotte\'s Web.',
      'My favorite book is "Charlotte\'s Web."',
      'My favorite book is Charlottes Web.',
    ],
    answer: 'My favorite book is "Charlotte\'s Web."',
    rule: 'Quotation marks can also go around the title of a short work like a story, song, or poem.',
  },

  // ------------------------------------------------------------------------
  // MEDIUM — comma in compound sentences (before and/but/or)
  // ------------------------------------------------------------------------
  {
    id: 'comma-conj-1',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I wanted to play outside but it started to rain.',
      'I wanted to play outside, but it started to rain.',
      'I wanted, to play outside but it started to rain.',
    ],
    answer: 'I wanted to play outside, but it started to rain.',
    rule: 'When you join TWO complete sentences with `and`, `but`, or `or`, put a comma BEFORE the joining word.',
  },
  {
    id: 'comma-conj-2',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I read a book and then I went to bed.',
      'I read a book, and then I went to bed.',
      'I read a book and, then I went to bed.',
    ],
    answer: 'I read a book, and then I went to bed.',
    rule: 'Two full sentences joined by `and` need a comma before the `and`.',
  },
  {
    id: 'comma-conj-3',
    skill: 'commas',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'We can go to the park or we can stay home.',
      'We can go to the park, or we can stay home.',
      'We, can go to the park or we can stay home.',
    ],
    answer: 'We can go to the park, or we can stay home.',
    rule: 'Two complete thoughts joined by `or` get a comma before `or`.',
  },

  // ------------------------------------------------------------------------
  // HARD — semicolons
  // ------------------------------------------------------------------------
  {
    id: 'semi-1',
    skill: 'semicolon',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I wanted to stay up late, I was too tired.',
      'I wanted to stay up late; I was too tired.',
      'I wanted to stay up late I was too tired.',
    ],
    answer: 'I wanted to stay up late; I was too tired.',
    rule: 'A semicolon joins two complete sentences that are closely related. A comma alone would be a comma splice (wrong).',
  },
  {
    id: 'semi-2',
    skill: 'semicolon',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'My brother loves soccer, my sister loves tennis.',
      'My brother loves soccer; my sister loves tennis.',
      'My brother loves soccer my sister loves tennis.',
    ],
    answer: 'My brother loves soccer; my sister loves tennis.',
    rule: 'Two closely-related complete sentences can be joined with a semicolon instead of a period.',
  },
  {
    id: 'semi-3',
    skill: 'semicolon',
    tier: 'hard',
    mode: 'fill',
    prompt: 'It was very cold___ we wore our heaviest coats.',
    choices: [',', ';', ':'],
    answer: ';',
    rule: 'Both sides of the blank are full sentences. A semicolon links them; a comma alone would be wrong.',
  },
  {
    id: 'semi-4',
    skill: 'semicolon',
    tier: 'hard',
    mode: 'fill',
    prompt: 'The sky turned dark___ a storm was coming.',
    choices: [',', ';', ':'],
    answer: ';',
    rule: 'Two complete, related sentences → join with a semicolon.',
  },

  // ------------------------------------------------------------------------
  // HARD — colons (introducing a list or explanation)
  // ------------------------------------------------------------------------
  {
    id: 'colon-1',
    skill: 'colon',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I packed three things, a hat, a book, and a snack.',
      'I packed three things: a hat, a book, and a snack.',
      'I packed three things; a hat, a book, and a snack.',
    ],
    answer: 'I packed three things: a hat, a book, and a snack.',
    rule: 'A colon `:` introduces a list after a complete sentence. Think of it as saying "here it is →".',
  },
  {
    id: 'colon-2',
    skill: 'colon',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'There is one rule, no running in the house.',
      'There is one rule: no running in the house.',
      'There is one rule; no running in the house.',
    ],
    answer: 'There is one rule: no running in the house.',
    rule: 'A colon introduces an explanation or example after a complete sentence.',
  },
  {
    id: 'colon-3',
    skill: 'colon',
    tier: 'hard',
    mode: 'fill',
    prompt: 'Bring these supplies___ paper, pencils, and a ruler.',
    choices: [',', ';', ':'],
    answer: ':',
    rule: 'Use a colon to introduce a list AFTER a complete sentence.',
  },
  {
    id: 'colon-4',
    skill: 'colon',
    tier: 'hard',
    mode: 'fill',
    prompt: 'The clock read___ 8:30.',
    choices: [',', ';', ':'],
    answer: ':',
    hint: 'A colon also separates the hour from the minutes in a time.',
    rule: 'Colons separate hours from minutes when writing the time (8:30).',
  },

  // ------------------------------------------------------------------------
  // HARD — dash vs hyphen
  // ------------------------------------------------------------------------
  {
    id: 'dash-1',
    skill: 'dash-hyphen',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'My ten year old sister won the race.',
      'My ten—year—old sister won the race.',
      'My ten-year-old sister won the race.',
    ],
    answer: 'My ten-year-old sister won the race.',
    rule: 'A HYPHEN (-) joins words to make a single description: ten-year-old, well-known. A DASH (—) is longer and is used like a strong comma.',
  },
  {
    id: 'dash-2',
    skill: 'dash-hyphen',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I knew the answer—but I forgot to raise my hand.',
      'I knew the answer-but I forgot to raise my hand.',
      'I knew the answer but I forgot to raise my hand.',
    ],
    answer: 'I knew the answer—but I forgot to raise my hand.',
    rule: 'A DASH (—) sets off a sudden break or added thought. A hyphen (-) is shorter and only joins words.',
  },
  {
    id: 'dash-3',
    skill: 'dash-hyphen',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Which one needs a HYPHEN (-)?',
    choices: [
      'a well known author',
      'a well-known author',
      'a well—known author',
    ],
    answer: 'a well-known author',
    rule: 'When two words work together to describe a noun (well-known author), join them with a hyphen.',
  },
  {
    id: 'dash-4',
    skill: 'dash-hyphen',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Which one is correct?',
    choices: [
      'My best friend Sara just moved here is in my class.',
      'My best friend—Sara just moved here—is in my class.',
      'My best friend-Sara just moved here-is in my class.',
    ],
    answer: 'My best friend—Sara just moved here—is in my class.',
    rule: 'A pair of DASHES (—) wrap an extra-info phrase in the middle of a sentence.',
  },

  // ------------------------------------------------------------------------
  // EXTRA EASY — direct address comma
  // ------------------------------------------------------------------------
  {
    id: 'comma-address-1',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Mom can I have a snack?',
      'Mom, can I have a snack?',
      'Mom can, I have a snack?',
    ],
    answer: 'Mom, can I have a snack?',
    rule: 'When you speak directly to someone by name, set the name off with a comma.',
  },
  {
    id: 'comma-address-2',
    skill: 'commas',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Thanks Grandpa for the gift.',
      'Thanks, Grandpa, for the gift.',
      'Thanks, Grandpa for the gift.',
    ],
    answer: 'Thanks, Grandpa, for the gift.',
    rule: 'When you address someone by name in the middle of a sentence, set the name off with commas on both sides.',
  },

  // ------------------------------------------------------------------------
  // EXTRA — more contractions
  // ------------------------------------------------------------------------
  {
    id: 'apos-easy-7',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Which one is the right contraction for "I am"?',
    choices: ['Im', "I'm", 'Iam', 'I"m'],
    answer: "I'm",
    rule: '`I\'m` = `I am`. The apostrophe replaces the missing `a`.',
  },
  {
    id: 'apos-easy-8',
    skill: 'apostrophes',
    tier: 'easy',
    mode: 'fix',
    prompt: 'Which one is the right contraction for "will not"?',
    choices: ['willnt', "wil'nt", "won't", 'willn\'t'],
    answer: "won't",
    rule: '`won\'t` is the special contraction for `will not`.',
  },

  // ------------------------------------------------------------------------
  // EXTRA MEDIUM — apostrophes vs plurals (NOT a possession)
  // ------------------------------------------------------------------------
  {
    id: 'apos-plural-1',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which one is right? (More than one cat, no ownership.)',
    choices: [
      'The cats are sleeping.',
      "The cat's are sleeping.",
      "The cats' are sleeping.",
    ],
    answer: 'The cats are sleeping.',
    rule: 'A plain plural (just "more than one") does NOT need an apostrophe. Only ownership or a contraction takes one.',
  },
  {
    id: 'apos-plural-2',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which one is right? (Just plural, no ownership.)',
    choices: [
      'I have three apple\'s.',
      'I have three apples.',
      'I have three apples\'.',
    ],
    answer: 'I have three apples.',
    rule: 'Plural = just add `s`. No apostrophe.',
  },

  // ------------------------------------------------------------------------
  // EXTRA HARD — semicolon vs comma in a list with commas inside
  // ------------------------------------------------------------------------
  {
    id: 'semi-list-1',
    skill: 'semicolon',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'We visited Paris, France, Rome, Italy, and Berlin, Germany.',
      'We visited Paris, France; Rome, Italy; and Berlin, Germany.',
      'We visited Paris France; Rome Italy; and Berlin Germany.',
    ],
    answer: 'We visited Paris, France; Rome, Italy; and Berlin, Germany.',
    rule: 'When list items already have commas inside them, use semicolons to separate the items so the list stays clear.',
  },

  // ------------------------------------------------------------------------
  // EXTRA MEDIUM — quotes around exact title vs nothing
  // ------------------------------------------------------------------------
  {
    id: 'quotes-6',
    skill: 'quotes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'Are you coming with us? asked Ben.',
      '"Are you coming with us?" asked Ben.',
      '"Are you coming with us"? asked Ben.',
    ],
    answer: '"Are you coming with us?" asked Ben.',
    rule: 'The question mark belongs to Ben\'s spoken words, so it sits INSIDE the closing quotation mark.',
  },

  // ------------------------------------------------------------------------
  // EXTRA HARD — comma before conjunction (clear case)
  // ------------------------------------------------------------------------
  {
    id: 'comma-conj-hard-1',
    skill: 'commas',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'I finished my chores and I read a chapter.',
      'I finished my chores, and I read a chapter.',
      'I, finished my chores and I read a chapter.',
    ],
    answer: 'I finished my chores, and I read a chapter.',
    rule: 'Two complete sentences joined with `and` → put a comma before `and`.',
  },
  {
    id: 'comma-conj-hard-2',
    skill: 'commas',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence. (Watch: only ONE complete sentence here.)',
    choices: [
      'I finished my chores, and read a chapter.',
      'I finished my chores and read a chapter.',
    ],
    answer: 'I finished my chores and read a chapter.',
    rule: 'When `and` just joins two VERBS (not two full sentences), do NOT add a comma. "I finished my chores and read a chapter" is one subject doing two things.',
  },

  // ------------------------------------------------------------------------
  // EXTRA EASY — end punct: exclamation vs period
  // ------------------------------------------------------------------------
  {
    id: 'end-easy-9',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'Look at that giant rainbow___',
    choices: ['.', '?', '!'],
    answer: '!',
    rule: 'Strong feeling or excitement → exclamation mark.',
  },
  {
    id: 'end-easy-10',
    skill: 'end-punct',
    tier: 'easy',
    mode: 'fill',
    prompt: 'My pencil is on the desk___',
    choices: ['.', '?', '!'],
    answer: '.',
    rule: 'A plain telling sentence ends with a period.',
  },

  // ------------------------------------------------------------------------
  // EXTRA MEDIUM — apostrophe to show possession with name ending in s
  // (We pick the version using `'s` since that is the standard for personal
  // names like James's — but to avoid style debate we use a name that has
  // only one clean answer.)
  // ------------------------------------------------------------------------
  {
    id: 'apos-poss-7',
    skill: 'apostrophes',
    tier: 'medium',
    mode: 'fix',
    prompt: 'Which one shows the book belongs to Mrs. Lee?',
    choices: [
      "Mrs. Lees book is on the desk.",
      "Mrs. Lee's book is on the desk.",
      "Mrs. Lees' book is on the desk.",
    ],
    answer: "Mrs. Lee's book is on the desk.",
    rule: "One person → add `'s` to show what belongs to them.",
  },

  // ------------------------------------------------------------------------
  // EXTRA HARD — hyphen in compound number
  // ------------------------------------------------------------------------
  {
    id: 'dash-5',
    skill: 'dash-hyphen',
    tier: 'hard',
    mode: 'fix',
    prompt: 'Pick the correctly-punctuated sentence.',
    choices: [
      'There are twenty five chairs in the room.',
      'There are twenty-five chairs in the room.',
      'There are twenty—five chairs in the room.',
    ],
    answer: 'There are twenty-five chairs in the room.',
    rule: 'Numbers between 21 and 99 written as words use a HYPHEN: twenty-five, thirty-seven, ninety-nine.',
  },
];

// ----- Helpers -----

export const ALL_SKILLS: PunctuationSkill[] = [
  'commas',
  'apostrophes',
  'quotes',
  'end-punct',
  'semicolon',
  'colon',
  'dash-hyphen',
];

export const SKILL_LABELS: Record<PunctuationSkill, string> = {
  commas: 'Commas',
  apostrophes: 'Apostrophes',
  quotes: 'Quotation marks',
  'end-punct': 'End punctuation',
  semicolon: 'Semicolons',
  colon: 'Colons',
  'dash-hyphen': 'Dash vs hyphen',
};

export function pickRoundItems(
  options: { tier?: PunctuationTier; skills?: PunctuationSkill[] },
  count: number,
): PunctuationItem[] {
  let pool = PUNCTUATION_ITEMS.slice();
  if (options.tier) {
    pool = pool.filter((it) => it.tier === options.tier);
  }
  if (options.skills && options.skills.length > 0) {
    const allowed = new Set(options.skills);
    pool = pool.filter((it) => allowed.has(it.skill));
  }
  // Fisher–Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function itemCountByTier(): Record<PunctuationTier, number> {
  const out: Record<PunctuationTier, number> = { easy: 0, medium: 0, hard: 0 };
  for (const it of PUNCTUATION_ITEMS) out[it.tier]++;
  return out;
}
