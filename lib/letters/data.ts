// Letters & Sounds — preschool / kindergarten dataset.
//
// Each letter has an animal whose name starts with that letter, the sound it
// makes (written for the browser speech voice to say naturally), a bright color
// for the "costume," and a couple of emoji used to dress the big letter up.
// No image files — the letter is styled into an animal-ish character with CSS
// and the device's speech voice says the sound + word.

export interface LetterEntry {
  letter: string;        // uppercase
  sound: string;         // phonetic-ish, what speech says: "buh"
  animal: string;        // "Bear"
  emoji: string;         // 🐻 — the animal face
  word: string;          // a simple word to reinforce: "Bear"
  color: string;         // tailwind-ish hex for the letter background
  spoken: string;        // full line the voice says
}

export const LETTERS: LetterEntry[] = [
  { letter: 'A', sound: 'aaa', animal: 'Alligator', emoji: '🐊', word: 'Alligator', color: '#ef4444', spoken: 'A says aaa. Alligator!' },
  { letter: 'B', sound: 'buh', animal: 'Bear', emoji: '🐻', word: 'Bear', color: '#f97316', spoken: 'B says buh. Bear!' },
  { letter: 'C', sound: 'kuh', animal: 'Cat', emoji: '🐱', word: 'Cat', color: '#f59e0b', spoken: 'C says kuh. Cat!' },
  { letter: 'D', sound: 'duh', animal: 'Dog', emoji: '🐶', word: 'Dog', color: '#eab308', spoken: 'D says duh. Dog!' },
  { letter: 'E', sound: 'eh', animal: 'Elephant', emoji: '🐘', word: 'Elephant', color: '#84cc16', spoken: 'E says eh. Elephant!' },
  { letter: 'F', sound: 'fff', animal: 'Fish', emoji: '🐠', word: 'Fish', color: '#22c55e', spoken: 'F says fff. Fish!' },
  { letter: 'G', sound: 'guh', animal: 'Goat', emoji: '🐐', word: 'Goat', color: '#10b981', spoken: 'G says guh. Goat!' },
  { letter: 'H', sound: 'huh', animal: 'Horse', emoji: '🐴', word: 'Horse', color: '#14b8a6', spoken: 'H says huh. Horse!' },
  { letter: 'I', sound: 'ih', animal: 'Iguana', emoji: '🦎', word: 'Iguana', color: '#06b6d4', spoken: 'I says ih. Iguana!' },
  { letter: 'J', sound: 'juh', animal: 'Jellyfish', emoji: '🪼', word: 'Jellyfish', color: '#0ea5e9', spoken: 'J says juh. Jellyfish!' },
  { letter: 'K', sound: 'kuh', animal: 'Kangaroo', emoji: '🦘', word: 'Kangaroo', color: '#3b82f6', spoken: 'K says kuh. Kangaroo!' },
  { letter: 'L', sound: 'luh', animal: 'Lion', emoji: '🦁', word: 'Lion', color: '#6366f1', spoken: 'L says luh. Lion!' },
  { letter: 'M', sound: 'mmm', animal: 'Monkey', emoji: '🐵', word: 'Monkey', color: '#8b5cf6', spoken: 'M says mmm. Monkey!' },
  { letter: 'N', sound: 'nnn', animal: 'Newt', emoji: '🦎', word: 'Newt', color: '#a855f7', spoken: 'N says nnn. Newt!' },
  { letter: 'O', sound: 'ah', animal: 'Octopus', emoji: '🐙', word: 'Octopus', color: '#d946ef', spoken: 'O says ah. Octopus!' },
  { letter: 'P', sound: 'puh', animal: 'Pig', emoji: '🐷', word: 'Pig', color: '#ec4899', spoken: 'P says puh. Pig!' },
  { letter: 'Q', sound: 'kwuh', animal: 'Quail', emoji: '🐦', word: 'Quail', color: '#f43f5e', spoken: 'Q says kwuh. Quail!' },
  { letter: 'R', sound: 'rrr', animal: 'Rabbit', emoji: '🐰', word: 'Rabbit', color: '#ef4444', spoken: 'R says rrr. Rabbit!' },
  { letter: 'S', sound: 'sss', animal: 'Snake', emoji: '🐍', word: 'Snake', color: '#f97316', spoken: 'S says sss. Snake!' },
  { letter: 'T', sound: 'tuh', animal: 'Tiger', emoji: '🐯', word: 'Tiger', color: '#f59e0b', spoken: 'T says tuh. Tiger!' },
  { letter: 'U', sound: 'uh', animal: 'Unicorn', emoji: '🦄', word: 'Unicorn', color: '#84cc16', spoken: 'U says uh. Unicorn!' },
  { letter: 'V', sound: 'vvv', animal: 'Vulture', emoji: '🦅', word: 'Vulture', color: '#22c55e', spoken: 'V says vvv. Vulture!' },
  { letter: 'W', sound: 'wuh', animal: 'Whale', emoji: '🐳', word: 'Whale', color: '#14b8a6', spoken: 'W says wuh. Whale!' },
  { letter: 'X', sound: 'ks', animal: 'Fox', emoji: '🦊', word: 'Fox (x)', color: '#06b6d4', spoken: 'X says ks, like in fox!' },
  { letter: 'Y', sound: 'yuh', animal: 'Yak', emoji: '🐂', word: 'Yak', color: '#6366f1', spoken: 'Y says yuh. Yak!' },
  { letter: 'Z', sound: 'zzz', animal: 'Zebra', emoji: '🦓', word: 'Zebra', color: '#a855f7', spoken: 'Z says zzz. Zebra!' },
];

// ----- Short word blends (CVC) — sound out c-a-t, then blend it. -----
export interface BlendWord {
  word: string;       // "cat"
  emoji: string;      // 🐱
  parts: string[];    // ['c','a','t'] — sounded out one at a time
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
  { word: 'pan', emoji: '🍳', parts: ['p', 'a', 'n'] },
  { word: 'red', emoji: '🔴', parts: ['r', 'e', 'd'] },
  { word: 'top', emoji: '🔝', parts: ['t', 'o', 'p'] },
  { word: 'van', emoji: '🚐', parts: ['v', 'a', 'n'] },
];
