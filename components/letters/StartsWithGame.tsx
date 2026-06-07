'use client';

// Starts With… — a picture-based phonics game for early readers (preschool /
// kindergarten). Show a big target letter, then a grid of emoji+word pictures.
// The kid taps every picture that STARTS with that letter. Correct → celebrate
// and keep it; wrong → gentle "nope, that's a Dog, it starts with D" + shake.
// When all the matching pictures are found, big celebration → Next round.
//
// Works without reading: every tap speaks the word, and the round prompt is
// spoken aloud. The item pool lives in THIS file so the component is fully
// self-contained.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LETTERS, type LetterEntry } from '@/lib/letters/data';
import { speak, playLetter } from '@/lib/letters/speak';

// ---- Picture pool ---------------------------------------------------------
// Simple, recognizable kid emoji tagged by their STARTING letter (uppercase).
// Aim: 3-4 items for most letters so any of them can be a target.
interface PicItem {
  emoji: string;
  word: string;
  letter: string; // uppercase starting letter
}

const POOL: PicItem[] = [
  // A
  { emoji: '🍎', word: 'Apple', letter: 'A' },
  { emoji: '🐜', word: 'Ant', letter: 'A' },
  { emoji: '🥑', word: 'Avocado', letter: 'A' },
  { emoji: '✈️', word: 'Airplane', letter: 'A' },
  { emoji: '🍏', word: 'Apple', letter: 'A' },
  // B
  { emoji: '🐝', word: 'Bee', letter: 'B' },
  { emoji: '🎈', word: 'Balloon', letter: 'B' },
  { emoji: '🍌', word: 'Banana', letter: 'B' },
  { emoji: '🐻', word: 'Bear', letter: 'B' },
  { emoji: '🦋', word: 'Butterfly', letter: 'B' },
  { emoji: '🚌', word: 'Bus', letter: 'B' },
  // C
  { emoji: '🐱', word: 'Cat', letter: 'C' },
  { emoji: '🥕', word: 'Carrot', letter: 'C' },
  { emoji: '🎂', word: 'Cake', letter: 'C' },
  { emoji: '🚗', word: 'Car', letter: 'C' },
  { emoji: '🐄', word: 'Cow', letter: 'C' },
  // D
  { emoji: '🐶', word: 'Dog', letter: 'D' },
  { emoji: '🦆', word: 'Duck', letter: 'D' },
  { emoji: '🍩', word: 'Donut', letter: 'D' },
  { emoji: '🐬', word: 'Dolphin', letter: 'D' },
  // E
  { emoji: '🐘', word: 'Elephant', letter: 'E' },
  { emoji: '🥚', word: 'Egg', letter: 'E' },
  { emoji: '👁️', word: 'Eye', letter: 'E' },
  { emoji: '🦅', word: 'Eagle', letter: 'E' },
  // F
  { emoji: '🐠', word: 'Fish', letter: 'F' },
  { emoji: '🐸', word: 'Frog', letter: 'F' },
  { emoji: '🌸', word: 'Flower', letter: 'F' },
  { emoji: '🦊', word: 'Fox', letter: 'F' },
  { emoji: '🔥', word: 'Fire', letter: 'F' },
  // G
  { emoji: '🐐', word: 'Goat', letter: 'G' },
  { emoji: '🍇', word: 'Grapes', letter: 'G' },
  { emoji: '🎁', word: 'Gift', letter: 'G' },
  { emoji: '👻', word: 'Ghost', letter: 'G' },
  { emoji: '🦒', word: 'Giraffe', letter: 'G' },
  // H
  { emoji: '🐴', word: 'Horse', letter: 'H' },
  { emoji: '🏠', word: 'House', letter: 'H' },
  { emoji: '🎩', word: 'Hat', letter: 'H' },
  { emoji: '❤️', word: 'Heart', letter: 'H' },
  { emoji: '🍯', word: 'Honey', letter: 'H' },
  // I
  { emoji: '🍦', word: 'Ice cream', letter: 'I' },
  { emoji: '🦎', word: 'Iguana', letter: 'I' },
  { emoji: '🧊', word: 'Ice', letter: 'I' },
  { emoji: '🏝️', word: 'Island', letter: 'I' },
  // J
  { emoji: '🫙', word: 'Jar', letter: 'J' },
  { emoji: '🧃', word: 'Juice', letter: 'J' },
  { emoji: '🪼', word: 'Jellyfish', letter: 'J' },
  { emoji: '🃏', word: 'Joker', letter: 'J' },
  // K
  { emoji: '🦘', word: 'Kangaroo', letter: 'K' },
  { emoji: '🔑', word: 'Key', letter: 'K' },
  { emoji: '🪁', word: 'Kite', letter: 'K' },
  { emoji: '🐨', word: 'Koala', letter: 'K' },
  // L
  { emoji: '🦁', word: 'Lion', letter: 'L' },
  { emoji: '🍋', word: 'Lemon', letter: 'L' },
  { emoji: '🍃', word: 'Leaf', letter: 'L' },
  { emoji: '🦎', word: 'Lizard', letter: 'L' },
  { emoji: '💡', word: 'Light', letter: 'L' },
  // M
  { emoji: '🐵', word: 'Monkey', letter: 'M' },
  { emoji: '🌙', word: 'Moon', letter: 'M' },
  { emoji: '🍄', word: 'Mushroom', letter: 'M' },
  { emoji: '🐭', word: 'Mouse', letter: 'M' },
  { emoji: '🥛', word: 'Milk', letter: 'M' },
  // N
  { emoji: '🪺', word: 'Nest', letter: 'N' },
  { emoji: '👃', word: 'Nose', letter: 'N' },
  { emoji: '🥜', word: 'Nut', letter: 'N' },
  { emoji: '📰', word: 'News', letter: 'N' },
  // O
  { emoji: '🐙', word: 'Octopus', letter: 'O' },
  { emoji: '🍊', word: 'Orange', letter: 'O' },
  { emoji: '🦉', word: 'Owl', letter: 'O' },
  { emoji: '🧅', word: 'Onion', letter: 'O' },
  // P
  { emoji: '🐷', word: 'Pig', letter: 'P' },
  { emoji: '🍕', word: 'Pizza', letter: 'P' },
  { emoji: '🐧', word: 'Penguin', letter: 'P' },
  { emoji: '🎁', word: 'Present', letter: 'P' },
  { emoji: '🍐', word: 'Pear', letter: 'P' },
  { emoji: '✏️', word: 'Pencil', letter: 'P' },
  // Q
  { emoji: '👸', word: 'Queen', letter: 'Q' },
  { emoji: '🦆', word: 'Quack', letter: 'Q' },
  { emoji: '❓', word: 'Question', letter: 'Q' },
  // R
  { emoji: '🐰', word: 'Rabbit', letter: 'R' },
  { emoji: '🌈', word: 'Rainbow', letter: 'R' },
  { emoji: '🚀', word: 'Rocket', letter: 'R' },
  { emoji: '🌹', word: 'Rose', letter: 'R' },
  { emoji: '💍', word: 'Ring', letter: 'R' },
  // S
  { emoji: '☀️', word: 'Sun', letter: 'S' },
  { emoji: '🐍', word: 'Snake', letter: 'S' },
  { emoji: '⭐', word: 'Star', letter: 'S' },
  { emoji: '🍓', word: 'Strawberry', letter: 'S' },
  { emoji: '🧦', word: 'Sock', letter: 'S' },
  { emoji: '🚢', word: 'Ship', letter: 'S' },
  // T
  { emoji: '🐯', word: 'Tiger', letter: 'T' },
  { emoji: '🌳', word: 'Tree', letter: 'T' },
  { emoji: '🐢', word: 'Turtle', letter: 'T' },
  { emoji: '🚂', word: 'Train', letter: 'T' },
  { emoji: '🍅', word: 'Tomato', letter: 'T' },
  // U
  { emoji: '☂️', word: 'Umbrella', letter: 'U' },
  { emoji: '🦄', word: 'Unicorn', letter: 'U' },
  { emoji: '🛸', word: 'UFO', letter: 'U' },
  // V
  { emoji: '🚐', word: 'Van', letter: 'V' },
  { emoji: '🎻', word: 'Violin', letter: 'V' },
  { emoji: '🌋', word: 'Volcano', letter: 'V' },
  { emoji: '🥦', word: 'Veggie', letter: 'V' },
  // W
  { emoji: '🐳', word: 'Whale', letter: 'W' },
  { emoji: '🍉', word: 'Watermelon', letter: 'W' },
  { emoji: '🐺', word: 'Wolf', letter: 'W' },
  { emoji: '⌚', word: 'Watch', letter: 'W' },
  { emoji: '💧', word: 'Water', letter: 'W' },
  // Y
  { emoji: '🪀', word: 'Yo-yo', letter: 'Y' },
  { emoji: '🟡', word: 'Yellow', letter: 'Y' },
  { emoji: '🧶', word: 'Yarn', letter: 'Y' },
  // Z
  { emoji: '🦓', word: 'Zebra', letter: 'Z' },
  { emoji: '🤐', word: 'Zipper', letter: 'Z' },
  { emoji: '0️⃣', word: 'Zero', letter: 'Z' },
];

const ROUND_SIZE = 6;       // pictures shown per round
const MAX_TARGETS = 3;      // most correct items in a single round

// Letters that have at least 2 pictures → can be a target.
function playableLetters(): string[] {
  const counts = new Map<string, number>();
  for (const p of POOL) counts.set(p.letter, (counts.get(p.letter) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([l]) => l);
}

// Fisher-Yates shuffle (client-only, called inside handlers/effects).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Tile extends PicItem {
  id: number;        // stable key for this round
  correct: boolean;  // does it start with the target letter?
}

interface Round {
  target: LetterEntry;
  tiles: Tile[];
  totalCorrect: number;
}

function buildRound(letter: string): Round {
  const target = LETTERS.find((l) => l.letter === letter) ?? LETTERS[0];

  const matches = shuffle(POOL.filter((p) => p.letter === letter)).slice(0, MAX_TARGETS);
  const fillerCount = Math.max(0, ROUND_SIZE - matches.length);
  const fillers = shuffle(POOL.filter((p) => p.letter !== letter)).slice(0, fillerCount);

  const tiles: Tile[] = shuffle([...matches, ...fillers]).map((p, i) => ({
    ...p,
    id: i,
    correct: p.letter === letter,
  }));

  return { target, tiles, totalCorrect: matches.length };
}

export default function StartsWithGame() {
  const letters = useMemo(playableLetters, []);

  // Order of target letters we cycle through.
  const order = useMemo(() => shuffle(letters), [letters]);
  const [orderIdx, setOrderIdx] = useState(0);

  const [round, setRound] = useState<Round | null>(null);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [wrongId, setWrongId] = useState<number | null>(null);
  const [stars, setStars] = useState(0);
  const won = round != null && found.size >= round.totalCorrect;

  const startRound = useCallback((letter: string) => {
    const r = buildRound(letter);
    setRound(r);
    setFound(new Set());
    setWrongId(null);
    setTimeout(() => speak(`Find things that start with ${r.target.letter}!`), 120);
  }, []);

  // First round on mount + whenever we advance the target.
  useEffect(() => {
    if (order.length === 0) return;
    startRound(order[orderIdx % order.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdx, order]);

  const nextRound = useCallback(() => {
    setOrderIdx((i) => i + 1);
  }, []);

  const tapTile = (tile: Tile) => {
    if (!round || won) return;
    if (found.has(tile.id)) {
      speak(tile.word);
      return;
    }
    if (tile.correct) {
      const next = new Set(found);
      next.add(tile.id);
      setFound(next);
      setStars((s) => s + 1);
      if (next.size >= round.totalCorrect) {
        speak(`${tile.word}! You found them all. Hooray!`);
      } else {
        speak(`Yes! ${tile.word}!`);
      }
    } else {
      setWrongId(tile.id);
      speak(`Nope, that's a ${tile.word}. It starts with ${tile.letter}.`);
      setTimeout(() => setWrongId((id) => (id === tile.id ? null : id)), 700);
    }
  };

  if (!round) {
    return (
      <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-8 text-center text-purple-400">
        Loading game…
      </div>
    );
  }

  const target = round.target;

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-5 sm:p-6 text-center">
      {/* Target letter + prompt */}
      <div className="flex flex-col items-center mb-5">
        <button
          onClick={() => playLetter(target)}
          aria-label={`Hear the letter ${target.letter}`}
          className="relative focus:outline-none mb-3"
        >
          <span
            className="inline-flex items-end gap-2 px-6 py-3 rounded-3xl font-black text-white shadow-lg animate-float"
            style={{ background: target.color }}
          >
            <span className="text-7xl leading-none">{target.letter}</span>
            <span className="text-5xl leading-none opacity-90">{target.lower}</span>
          </span>
          <span className="absolute -top-3 -right-3 text-4xl animate-bounce-slow">{target.emoji}</span>
        </button>
        <button
          onClick={() => speak(`Find things that start with ${target.letter}!`)}
          className="bg-gradient-to-br from-lime-500 to-green-600 text-white font-black text-lg sm:text-xl px-6 py-3 rounded-full shadow hover:scale-105 active:scale-95 transition-transform"
        >
          🔊 Find things that start with {target.letter}!
        </button>
        <p className="text-purple-400 text-sm mt-2">
          Tap every picture that starts with <span className="font-black">{target.letter}</span>.
        </p>
      </div>

      {/* Picture grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 justify-items-center mb-5">
        {round.tiles.map((tile) => {
          const isFound = found.has(tile.id);
          const isWrong = wrongId === tile.id;
          return (
            <button
              key={tile.id}
              onClick={() => tapTile(tile)}
              aria-label={tile.word}
              className={[
                'w-full aspect-square max-w-[10rem] rounded-3xl flex flex-col items-center justify-center shadow-md border-4 transition-transform active:scale-95',
                isFound
                  ? 'bg-emerald-50 border-emerald-400 scale-100'
                  : 'bg-purple-50 border-purple-100 hover:scale-105',
                isWrong ? 'animate-shake border-amber-400 bg-amber-50' : '',
              ].join(' ')}
            >
              <span className="text-5xl sm:text-6xl leading-none">{tile.emoji}</span>
              <span className="mt-2 text-sm sm:text-base font-bold text-purple-800">{tile.word}</span>
              {isFound && <span className="text-emerald-500 font-black text-lg leading-none">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Progress / feedback */}
      {!won ? (
        <div className="text-purple-500 font-bold text-sm mb-3">
          Found {found.size} of {round.totalCorrect} 🟢
        </div>
      ) : (
        <div className="animate-fadeIn mb-3">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 animate-bounce-slow">
            🎉 You found them all!
          </div>
          <div className="text-purple-500 text-sm mt-1">Great listening, friend! 🌟</div>
        </div>
      )}

      {/* Controls + score */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={nextRound}
          className={[
            'font-black px-6 py-3 rounded-full shadow transition-transform hover:scale-105 active:scale-95',
            won
              ? 'bg-gradient-to-br from-pink-500 to-orange-500 text-white animate-wiggle'
              : 'bg-white border-2 border-purple-200 text-purple-700',
          ].join(' ')}
        >
          {won ? 'Next letter →' : 'Skip →'}
        </button>
      </div>

      <div className="mt-4 text-purple-400 font-bold text-sm">⭐ {stars} stars</div>
    </div>
  );
}
