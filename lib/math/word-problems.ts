// Word problems item bank — Math Phase 3.
//
// Hand-authored, NOT auto-generated. Each problem reads like something a
// 6-9 year old would actually say out loud. Names, objects, and numbers
// are concrete and age-appropriate; no abstractions like "let x be…".
//
// Each item has a single numeric answer. The kid reads, pictures, solves,
// types a number.
//
// Tiers:
//   easy:   single op, small numbers, one step
//   medium: bigger numbers, sometimes two-step (add then subtract)
//   hard:   multi-step or trickier wording (groups of, equal share, etc.)
//
// `op` tags the dominant operation. 'mix' = multi-step / multiple ops.
// Filtering by op lets us build "just multiplication" rounds.

export type WordOp = 'add' | 'sub' | 'mul' | 'div' | 'mix';
export type WordDifficulty = 'easy' | 'medium' | 'hard';

export type WordProblem = {
  id: string;
  text: string;
  answer: number;
  op: WordOp;
  difficulty: WordDifficulty;
};

// ----- Item bank -----
// Goal: ~40 problems spread roughly evenly across difficulty + op.
// Quality > quantity. Each one is intentionally written.

export const WORD_PROBLEMS: WordProblem[] = [
  // ============ EASY (one step, small numbers) ============

  // -- add --
  { id: 'e-add-1', op: 'add', difficulty: 'easy',
    text: 'Sam has 5 apples. His mom gives him 3 more. How many apples does Sam have now?',
    answer: 8 },
  { id: 'e-add-2', op: 'add', difficulty: 'easy',
    text: 'Lilly read 4 books in January and 6 books in February. How many books did she read in all?',
    answer: 10 },
  { id: 'e-add-3', op: 'add', difficulty: 'easy',
    text: 'There are 7 ducks on the pond. 5 more ducks land on the water. How many ducks are on the pond now?',
    answer: 12 },
  { id: 'e-add-4', op: 'add', difficulty: 'easy',
    text: 'Sarah has 9 stickers. Her friend gives her 4 more stickers. How many stickers does Sarah have now?',
    answer: 13 },

  // -- sub --
  { id: 'e-sub-1', op: 'sub', difficulty: 'easy',
    text: 'Sam has 12 apples. He gives 4 to his sister. How many apples does he have left?',
    answer: 8 },
  { id: 'e-sub-2', op: 'sub', difficulty: 'easy',
    text: 'Lilly baked 10 cookies. Her brother ate 3 of them. How many cookies are left?',
    answer: 7 },
  { id: 'e-sub-3', op: 'sub', difficulty: 'easy',
    text: 'There were 15 birds on a fence. 6 birds flew away. How many birds are still on the fence?',
    answer: 9 },
  { id: 'e-sub-4', op: 'sub', difficulty: 'easy',
    text: 'Sarah had 20 marbles. She lost 8 in the grass. How many marbles does she have now?',
    answer: 12 },

  // -- mul --
  { id: 'e-mul-1', op: 'mul', difficulty: 'easy',
    text: 'Each pack of gum has 5 pieces. Sam buys 3 packs. How many pieces of gum does he have?',
    answer: 15 },
  { id: 'e-mul-2', op: 'mul', difficulty: 'easy',
    text: 'Lilly puts 4 cookies on each plate. She fills 2 plates. How many cookies did she use?',
    answer: 8 },
  { id: 'e-mul-3', op: 'mul', difficulty: 'easy',
    text: 'There are 6 wheels on each toy car. How many wheels are on 3 toy cars?',
    answer: 18 },

  // -- div --
  { id: 'e-div-1', op: 'div', difficulty: 'easy',
    text: 'Sam has 12 candies. He shares them equally with 3 friends (so 4 kids total). How many candies does each kid get?',
    answer: 3 },
  { id: 'e-div-2', op: 'div', difficulty: 'easy',
    text: 'Lilly has 10 markers. She puts them into 2 equal boxes. How many markers go in each box?',
    answer: 5 },
  { id: 'e-div-3', op: 'div', difficulty: 'easy',
    text: 'There are 18 cookies. Sarah puts 6 cookies on each plate. How many plates does she fill?',
    answer: 3 },

  // ============ MEDIUM (bigger numbers, sometimes 2-step) ============

  // -- add --
  { id: 'm-add-1', op: 'add', difficulty: 'medium',
    text: 'The library had 24 books on Monday. They got 18 new books on Tuesday. How many books are in the library now?',
    answer: 42 },
  { id: 'm-add-2', op: 'add', difficulty: 'medium',
    text: 'Sam saved 15 dollars in May and 27 dollars in June. How many dollars did he save in total?',
    answer: 42 },

  // -- sub --
  { id: 'm-sub-1', op: 'sub', difficulty: 'medium',
    text: 'There were 50 sheep in the field. The farmer moved 17 of them to a different pasture. How many sheep are left in the field?',
    answer: 33 },
  { id: 'm-sub-2', op: 'sub', difficulty: 'medium',
    text: 'Lilly had 64 beads. She used 28 of them to make a bracelet. How many beads does she have left?',
    answer: 36 },

  // -- mul --
  { id: 'm-mul-1', op: 'mul', difficulty: 'medium',
    text: 'Each box of crayons has 8 crayons. Sarah buys 6 boxes. How many crayons does she have in all?',
    answer: 48 },
  { id: 'm-mul-2', op: 'mul', difficulty: 'medium',
    text: 'There are 7 days in a week. How many days are there in 9 weeks?',
    answer: 63 },
  { id: 'm-mul-3', op: 'mul', difficulty: 'medium',
    text: 'A baker puts 12 muffins in each tray. He bakes 5 trays. How many muffins did he bake?',
    answer: 60 },

  // -- div --
  { id: 'm-div-1', op: 'div', difficulty: 'medium',
    text: 'Sam has 36 marbles. He puts them into 4 equal bags. How many marbles go in each bag?',
    answer: 9 },
  { id: 'm-div-2', op: 'div', difficulty: 'medium',
    text: 'A teacher has 48 pencils. She gives 6 pencils to each student. How many students get pencils?',
    answer: 8 },
  { id: 'm-div-3', op: 'div', difficulty: 'medium',
    text: 'Lilly is reading a book that has 56 pages. If she reads 8 pages a day, how many days will it take her to finish?',
    answer: 7 },

  // -- mix (two-step) --
  { id: 'm-mix-1', op: 'mix', difficulty: 'medium',
    text: 'Sam had 20 dollars. He bought a toy for 7 dollars and a book for 5 dollars. How many dollars does Sam have left?',
    answer: 8 },
  { id: 'm-mix-2', op: 'mix', difficulty: 'medium',
    text: 'There were 15 birds in the tree. 6 flew away, then 4 more came back. How many birds are in the tree now?',
    answer: 13 },
  { id: 'm-mix-3', op: 'mix', difficulty: 'medium',
    text: 'Lilly bought 3 packs of stickers with 8 stickers in each pack. She gave 4 stickers to her brother. How many stickers does she have left?',
    answer: 20 },

  // ============ HARD (multi-step, trickier wording) ============

  // -- add --
  { id: 'h-add-1', op: 'add', difficulty: 'hard',
    text: 'Sam read 47 pages on Monday, 38 pages on Tuesday, and 25 pages on Wednesday. How many pages did he read in those three days?',
    answer: 110 },

  // -- sub --
  { id: 'h-sub-1', op: 'sub', difficulty: 'hard',
    text: 'A toy store had 125 stuffed animals. They sold 47 on Saturday. How many stuffed animals are left?',
    answer: 78 },

  // -- mul --
  { id: 'h-mul-1', op: 'mul', difficulty: 'hard',
    text: 'A farmer has 9 rows of corn. Each row has 12 cornstalks. How many cornstalks are there in total?',
    answer: 108 },
  { id: 'h-mul-2', op: 'mul', difficulty: 'hard',
    text: 'Sarah is making necklaces. Each necklace uses 11 beads. How many beads does she need for 8 necklaces?',
    answer: 88 },

  // -- div --
  { id: 'h-div-1', op: 'div', difficulty: 'hard',
    text: 'A class of 32 kids splits into 4 equal teams for a game. How many kids are on each team?',
    answer: 8 },
  { id: 'h-div-2', op: 'div', difficulty: 'hard',
    text: 'There are 84 cookies. Lilly puts 7 cookies in each bag. How many bags can she fill?',
    answer: 12 },

  // -- mix (multi-step / harder) --
  { id: 'h-mix-1', op: 'mix', difficulty: 'hard',
    text: 'Sam buys 4 packs of trading cards. Each pack has 6 cards. He gives 9 cards to his friend. How many cards does Sam have left?',
    answer: 15 },
  { id: 'h-mix-2', op: 'mix', difficulty: 'hard',
    text: 'A bakery sold 25 cupcakes in the morning and 18 cupcakes in the afternoon. The next day they sold 30 cupcakes. How many cupcakes did they sell in total over the two days?',
    answer: 73 },
  { id: 'h-mix-3', op: 'mix', difficulty: 'hard',
    text: 'Sarah has 50 dollars. She buys 3 shirts that cost 12 dollars each. How many dollars does she have left?',
    answer: 14 },
  { id: 'h-mix-4', op: 'mix', difficulty: 'hard',
    text: 'A classroom has 5 tables. Each table has 4 kids. If 3 more kids join the class and squeeze in, how many kids are in the classroom now?',
    answer: 23 },
  { id: 'h-mix-5', op: 'mix', difficulty: 'hard',
    text: 'Lilly counted 6 boxes of crayons with 10 crayons in each box. She lent 14 crayons to her brother. How many crayons does she have left?',
    answer: 46 },
  { id: 'h-mix-6', op: 'mix', difficulty: 'hard',
    text: 'Sam earned 9 dollars mowing each of 5 lawns. He spent 12 dollars on a video game. How many dollars does Sam have left?',
    answer: 33 },
];

// ----- Helpers -----

export type WordProblemFilter = {
  difficulty: WordDifficulty;
  // 'any' means all ops allowed; otherwise only that op (mix included only
  // when explicitly chosen — keeps "just multiplication" actually clean).
  op: WordOp | 'any';
};

// Fisher-Yates, returns a new array.
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick N items matching the filter. If the filtered pool is smaller than
// N we cycle through reshuffled copies (so a 5-item pool can still run a
// 15-question round without exact-duplicates-in-a-row).
export function pickWordRound(filter: WordProblemFilter, count: number): WordProblem[] {
  const pool = WORD_PROBLEMS.filter((p) => {
    if (p.difficulty !== filter.difficulty) return false;
    if (filter.op === 'any') return true;
    return p.op === filter.op;
  });
  if (pool.length === 0) return [];

  const out: WordProblem[] = [];
  let bag = shuffle(pool);
  let bagIdx = 0;
  while (out.length < count) {
    if (bagIdx >= bag.length) {
      bag = shuffle(pool);
      bagIdx = 0;
    }
    out.push(bag[bagIdx++]);
  }
  return out;
}

export function wordOpLabel(op: WordOp | 'any'): string {
  switch (op) {
    case 'add': return 'Addition';
    case 'sub': return 'Subtraction';
    case 'mul': return 'Multiplication';
    case 'div': return 'Division';
    case 'mix': return 'Mixed steps';
    case 'any': return 'Any operation';
  }
}

// Round config the kid picks before Start.
export type WordProblemConfig = {
  difficulty: WordDifficulty;
  op: WordOp | 'any';
  questions: number;
};

export const DEFAULT_WORD_PROBLEM_CONFIG: WordProblemConfig = {
  difficulty: 'easy',
  op: 'any',
  questions: 5,
};

export const WORD_PROBLEM_ROUND_SIZES = [5, 10, 15] as const;
