// Letters & Sounds — preschool / kindergarten dataset.
//
// IMPORTANT on sound: browser TTS mangles raw phonemes ("A says aaa" → "tripple
// A"; "C says kuh" → gibberish). So we DON'T ask the voice to vocalize a lone
// phoneme. Instead each `spoken` line names the letter, then models the sound
// INSIDE a real word ("A is for Alligator. Aaa, Alligator!") which every voice
// says correctly. Same approach the Bedtime Explorers TTS scripts use: spell
// for the voice, never hand it a bare sound token.

export interface LetterEntry {
  letter: string;        // uppercase "A"
  lower: string;         // lowercase "a"
  animal: string;        // "Alligator"
  emoji: string;         // 🐊
  word: string;          // reinforcing word (= animal here)
  color: string;         // letter background hex
  spoken: string;        // full line the voice says — TTS-safe
}

export const LETTERS: LetterEntry[] = [
  { letter: 'A', lower: 'a', animal: 'Alligator', emoji: '🐊', word: 'Alligator', color: '#ef4444', spoken: 'A. A is for Alligator. Ah, ah, Alligator!' },
  { letter: 'B', lower: 'b', animal: 'Bear', emoji: '🐻', word: 'Bear', color: '#f97316', spoken: 'B. B is for Bear. Buh, buh, Bear!' },
  { letter: 'C', lower: 'c', animal: 'Cat', emoji: '🐱', word: 'Cat', color: '#f59e0b', spoken: 'C. C is for Cat. Cuh, cuh, Cat!' },
  { letter: 'D', lower: 'd', animal: 'Dog', emoji: '🐶', word: 'Dog', color: '#eab308', spoken: 'D. D is for Dog. Duh, duh, Dog!' },
  { letter: 'E', lower: 'e', animal: 'Elephant', emoji: '🐘', word: 'Elephant', color: '#84cc16', spoken: 'E. E is for Elephant. Eh, eh, Elephant!' },
  { letter: 'F', lower: 'f', animal: 'Fish', emoji: '🐠', word: 'Fish', color: '#22c55e', spoken: 'F. F is for Fish. Ff, ff, Fish!' },
  { letter: 'G', lower: 'g', animal: 'Goat', emoji: '🐐', word: 'Goat', color: '#10b981', spoken: 'G. G is for Goat. Guh, guh, Goat!' },
  { letter: 'H', lower: 'h', animal: 'Horse', emoji: '🐴', word: 'Horse', color: '#14b8a6', spoken: 'H. H is for Horse. Hh, hh, Horse!' },
  { letter: 'I', lower: 'i', animal: 'Iguana', emoji: '🦎', word: 'Iguana', color: '#06b6d4', spoken: 'I. I is for Iguana. Ih, ih, Iguana!' },
  { letter: 'J', lower: 'j', animal: 'Jellyfish', emoji: '🪼', word: 'Jellyfish', color: '#0ea5e9', spoken: 'J. J is for Jellyfish. Juh, juh, Jellyfish!' },
  { letter: 'K', lower: 'k', animal: 'Kangaroo', emoji: '🦘', word: 'Kangaroo', color: '#3b82f6', spoken: 'K. K is for Kangaroo. Kuh, kuh, Kangaroo!' },
  { letter: 'L', lower: 'l', animal: 'Lion', emoji: '🦁', word: 'Lion', color: '#6366f1', spoken: 'L. L is for Lion. Ll, ll, Lion!' },
  { letter: 'M', lower: 'm', animal: 'Monkey', emoji: '🐵', word: 'Monkey', color: '#8b5cf6', spoken: 'M. M is for Monkey. Mm, mm, Monkey!' },
  { letter: 'N', lower: 'n', animal: 'Newt', emoji: '🦎', word: 'Newt', color: '#a855f7', spoken: 'N. N is for Newt. Nn, nn, Newt!' },
  { letter: 'O', lower: 'o', animal: 'Octopus', emoji: '🐙', word: 'Octopus', color: '#d946ef', spoken: 'O. O is for Octopus. Ah, ah, Octopus!' },
  { letter: 'P', lower: 'p', animal: 'Pig', emoji: '🐷', word: 'Pig', color: '#ec4899', spoken: 'P. P is for Pig. Puh, puh, Pig!' },
  { letter: 'Q', lower: 'q', animal: 'Queen Bee', emoji: '🐝', word: 'Queen', color: '#f43f5e', spoken: 'Q. Q is for Queen. Kwuh, kwuh, Queen!' },
  { letter: 'R', lower: 'r', animal: 'Rabbit', emoji: '🐰', word: 'Rabbit', color: '#ef4444', spoken: 'R. R is for Rabbit. Rr, rr, Rabbit!' },
  { letter: 'S', lower: 's', animal: 'Snake', emoji: '🐍', word: 'Snake', color: '#f97316', spoken: 'S. S is for Snake. Sss, sss, Snake!' },
  { letter: 'T', lower: 't', animal: 'Tiger', emoji: '🐯', word: 'Tiger', color: '#f59e0b', spoken: 'T. T is for Tiger. Tuh, tuh, Tiger!' },
  { letter: 'U', lower: 'u', animal: 'Umbrella Bird', emoji: '🐦', word: 'Umbrella', color: '#84cc16', spoken: 'U. U is for Umbrella. Uh, uh, Umbrella!' },
  { letter: 'V', lower: 'v', animal: 'Vulture', emoji: '🦅', word: 'Vulture', color: '#22c55e', spoken: 'V. V is for Vulture. Vv, vv, Vulture!' },
  { letter: 'W', lower: 'w', animal: 'Whale', emoji: '🐳', word: 'Whale', color: '#14b8a6', spoken: 'W. W is for Whale. Wuh, wuh, Whale!' },
  { letter: 'X', lower: 'x', animal: 'Fox', emoji: '🦊', word: 'Fox', color: '#06b6d4', spoken: 'X. Fox ends with X. Ks, ks, Fox!' },
  { letter: 'Y', lower: 'y', animal: 'Yak', emoji: '🐂', word: 'Yak', color: '#6366f1', spoken: 'Y. Y is for Yak. Yuh, yuh, Yak!' },
  { letter: 'Z', lower: 'z', animal: 'Zebra', emoji: '🦓', word: 'Zebra', color: '#a855f7', spoken: 'Z. Z is for Zebra. Zz, zz, Zebra!' },
];

// ----- Word families (Build-a-Word "easy" level) -----
// A fixed ending sound; the kid swaps the FIRST letter to make a new word.
export interface WordFamily {
  ending: string;        // "at"
  emoji: string;         // a picture for the family
  onsets: string[];      // first letters that make a real word with this ending
}

export const WORD_FAMILIES: WordFamily[] = [
  { ending: 'at', emoji: '🐱', onsets: ['c', 'h', 'b', 'r', 's', 'm', 'p', 'f'] },
  { ending: 'an', emoji: '🍳', onsets: ['c', 'm', 'p', 'r', 'f', 't', 'v'] },
  { ending: 'ig', emoji: '🐷', onsets: ['p', 'b', 'd', 'f', 'w', 'j'] },
  { ending: 'op', emoji: '🔝', onsets: ['t', 'h', 'm', 'p', 'c', 'b'] },
  { ending: 'un', emoji: '☀️', onsets: ['s', 'r', 'f', 'b', 'n'] },
  { ending: 'ed', emoji: '🛏️', onsets: ['b', 'r', 'l', 'f', 'w', 't'] },
  { ending: 'ug', emoji: '🐛', onsets: ['b', 'r', 'm', 'h', 'j', 't'] },
  { ending: 'en', emoji: '🐔', onsets: ['h', 'p', 't', 'd', 'm'] },
];

// ----- Short word blends (CVC) — Build-a-Word "mid" level. -----
export interface BlendWord {
  word: string;       // "cat"
  emoji: string;      // 🐱
  parts: string[];    // ['c','a','t']
}

export const BLENDS: BlendWord[] = [
  { word: 'cat', emoji: '🐱', parts: ['c', 'a', 't'] },
  { word: 'dog', emoji: '🐶', parts: ['d', 'o', 'g'] },
  { word: 'sun', emoji: '☀️', parts: ['s', 'u', 'n'] },
  { word: 'pig', emoji: '🐷', parts: ['p', 'i', 'g'] },
  { word: 'bug', emoji: '🐛', parts: ['b', 'u', 'g'] },
  { word: 'hat', emoji: '🎩', parts: ['h', 'a', 't'] },
  { word: 'bed', emoji: '🛏️', parts: ['b', 'e', 'd'] },
  { word: 'cup', emoji: '🥤', parts: ['c', 'u', 'p'] },
  { word: 'fox', emoji: '🦊', parts: ['f', 'o', 'x'] },
  { word: 'bus', emoji: '🚌', parts: ['b', 'u', 's'] },
  { word: 'map', emoji: '🗺️', parts: ['m', 'a', 'p'] },
  { word: 'net', emoji: '🥅', parts: ['n', 'e', 't'] },
];

// ----- Bigger words with an ending blend (Build-a-Word "hard" level) -----
// Kid first picks the ENDING (rime/blend), then adds 1-4 starting letters.
export interface HardWord {
  word: string;        // "frog"
  emoji: string;
  ending: string;      // "og"
  onset: string;       // "fr" (up to 4 letters of starting sounds)
}

export const HARD_WORDS: HardWord[] = [
  { word: 'frog', emoji: '🐸', ending: 'og', onset: 'fr' },
  { word: 'star', emoji: '⭐', ending: 'ar', onset: 'st' },
  { word: 'tree', emoji: '🌳', ending: 'ee', onset: 'tr' },
  { word: 'ship', emoji: '🚢', ending: 'ip', onset: 'sh' },
  { word: 'clap', emoji: '👏', ending: 'ap', onset: 'cl' },
  { word: 'drum', emoji: '🥁', ending: 'um', onset: 'dr' },
  { word: 'flag', emoji: '🚩', ending: 'ag', onset: 'fl' },
  { word: 'snow', emoji: '❄️', ending: 'ow', onset: 'sn' },
  { word: 'crab', emoji: '🦀', ending: 'ab', onset: 'cr' },
  { word: 'plant', emoji: '🌱', ending: 'ant', onset: 'pl' },
  { word: 'truck', emoji: '🚚', ending: 'uck', onset: 'tr' },
  { word: 'brush', emoji: '🖌️', ending: 'ush', onset: 'br' },
];
