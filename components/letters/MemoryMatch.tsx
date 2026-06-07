'use client';

// Memory Match — a classic concentration / memory card game for early readers
// (preschool / kindergarten, ~age 5). A grid of face-down cards; tap two to flip
// them. If they MATCH they stay up and celebrate; if not they flip back after a
// beat. Find all the pairs to win.
//
// Two match modes (parent/kid toggle at the top):
//   • "Big & little"    — match uppercase A to lowercase a.
//   • "Letter & animal" — match the letter B to its animal 🐻.
//
// Audio-first: every flip speaks the letter (or animal), matches say something
// happy, and the win is a big celebration with a turn count + Play again.
// Self-contained; the only data is LETTERS + the speak helpers.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LETTERS, type LetterEntry } from '@/lib/letters/data';
import { speak, playLetter } from '@/lib/letters/speak';

type MatchMode = 'biglittle' | 'animal';
type Difficulty = { label: string; pairs: number; cols: string };

// Difficulty options — keep them small for little hands.
const DIFFICULTIES: Difficulty[] = [
  { label: 'Easy', pairs: 4, cols: 'grid-cols-4' },        // 8 cards  → 4×2
  { label: 'Just right', pairs: 6, cols: 'grid-cols-4' },  // 12 cards → 4×3 (default)
  { label: 'More', pairs: 8, cols: 'grid-cols-4' },        // 16 cards → 4×4
];
const DEFAULT_DIFFICULTY = 1; // "Just right" = 6 pairs

// One face of a card. `kind` decides what we render and what we say.
//   - 'upper'  shows the capital letter "A"
//   - 'lower'  shows the lowercase letter "a"
//   - 'letter' shows the capital letter (animal-mode letter half)
//   - 'animal' shows the animal emoji 🐻
type CardKind = 'upper' | 'lower' | 'letter' | 'animal';

interface Card {
  id: number;          // unique per card in the deck
  pairId: number;      // both cards in a pair share this
  kind: CardKind;
  entry: LetterEntry;  // the letter this card belongs to
}

// Fisher-Yates shuffle (client-only; called in handlers/effects).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a fresh, shuffled deck: pick N random letters, make two faces each.
function buildDeck(mode: MatchMode, pairs: number): Card[] {
  const chosen = shuffle(LETTERS).slice(0, pairs);
  const cards: Card[] = [];
  let id = 0;
  chosen.forEach((entry, pairId) => {
    if (mode === 'biglittle') {
      cards.push({ id: id++, pairId, kind: 'upper', entry });
      cards.push({ id: id++, pairId, kind: 'lower', entry });
    } else {
      cards.push({ id: id++, pairId, kind: 'letter', entry });
      cards.push({ id: id++, pairId, kind: 'animal', entry });
    }
  });
  return shuffle(cards);
}

// What the voice says when a card is flipped face-up.
function sayCard(card: Card) {
  if (card.kind === 'animal') {
    speak(card.entry.animal);
  } else if (card.kind === 'lower') {
    speak(`Little ${card.entry.letter}`);
  } else {
    // upper / letter — play the real letter sound (recorded clip or TTS).
    playLetter(card.entry);
  }
}

export default function MemoryMatch() {
  const [mode, setMode] = useState<MatchMode>('biglittle');
  const [diffIdx, setDiffIdx] = useState<number>(DEFAULT_DIFFICULTY);
  const pairs = DIFFICULTIES[diffIdx].pairs;

  const [deck, setDeck] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);   // ids currently face-up & being compared (max 2)
  const [matched, setMatched] = useState<Set<number>>(new Set()); // pairIds solved
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState(false);                // true while two cards are being compared

  const totalPairs = deck.length / 2;
  const won = totalPairs > 0 && matched.size >= totalPairs;

  const newGame = useCallback(() => {
    setDeck(buildDeck(mode, pairs));
    setFlipped([]);
    setMatched(new Set());
    setTurns(0);
    setBusy(false);
  }, [mode, pairs]);

  // Start / restart whenever the mode or difficulty changes (and on mount).
  useEffect(() => {
    newGame();
  }, [newGame]);

  // Celebrate the win out loud.
  useEffect(() => {
    if (won) {
      const t = setTimeout(() => speak('You matched them all! Hooray!'), 400);
      return () => clearTimeout(t);
    }
  }, [won]);

  const isFaceUp = (card: Card) =>
    matched.has(card.pairId) || flipped.includes(card.id);

  const tapCard = (card: Card) => {
    if (busy || won) return;
    if (matched.has(card.pairId)) return;       // already solved
    if (flipped.includes(card.id)) return;      // guard double-tap on same card
    if (flipped.length >= 2) return;            // guard a third while comparing

    sayCard(card);
    const nextFlipped = [...flipped, card.id];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setTurns((t) => t + 1);
      setBusy(true);
      const [a, b] = nextFlipped.map((id) => deck.find((c) => c.id === id)!);
      if (a.pairId === b.pairId) {
        // Match! Keep them up, celebrate.
        setTimeout(() => {
          setMatched((m) => new Set(m).add(a.pairId));
          setFlipped([]);
          setBusy(false);
          const e = a.entry;
          if (mode === 'biglittle') {
            speak(`Match! Big ${e.letter} and little ${e.lower}!`);
          } else {
            speak(`Match! ${e.letter} is for ${e.animal}!`);
          }
        }, 650);
      } else {
        // No match — flip both back after a beat.
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 1100);
      }
    }
  };

  const cols = DIFFICULTIES[diffIdx].cols;

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-5 sm:p-6">
      {/* ---- Toggles: match mode + difficulty ---- */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Match mode */}
          <div className="inline-flex rounded-full bg-purple-50 p-1 self-center">
            <button
              onClick={() => setMode('biglittle')}
              className={[
                'px-4 py-2 rounded-full font-black text-sm transition-colors',
                mode === 'biglittle' ? 'bg-rose-500 text-white shadow' : 'text-purple-600',
              ].join(' ')}
            >
              🔠 Big &amp; little
            </button>
            <button
              onClick={() => setMode('animal')}
              className={[
                'px-4 py-2 rounded-full font-black text-sm transition-colors',
                mode === 'animal' ? 'bg-rose-500 text-white shadow' : 'text-purple-600',
              ].join(' ')}
            >
              🐻 Letter &amp; animal
            </button>
          </div>

          {/* Difficulty */}
          <div className="inline-flex rounded-full bg-purple-50 p-1 self-center">
            {DIFFICULTIES.map((d, i) => (
              <button
                key={d.label}
                onClick={() => setDiffIdx(i)}
                className={[
                  'px-3 py-2 rounded-full font-bold text-xs sm:text-sm transition-colors',
                  i === diffIdx ? 'bg-purple-600 text-white shadow' : 'text-purple-600',
                ].join(' ')}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-purple-400 text-sm text-center">
          {mode === 'biglittle'
            ? 'Tap two cards to match a BIG letter with its little letter!'
            : 'Tap two cards to match a letter with its animal!'}
        </p>
      </div>

      {/* ---- Card grid ---- */}
      <div className={`grid ${cols} gap-2.5 sm:gap-3 justify-items-center mb-5`}>
        {deck.map((card) => {
          const faceUp = isFaceUp(card);
          const solved = matched.has(card.pairId);
          return (
            <button
              key={card.id}
              onClick={() => tapCard(card)}
              aria-label={faceUp ? `${card.entry.letter} card` : 'Face-down card'}
              className={[
                'relative w-full aspect-square max-w-[6.5rem] rounded-2xl sm:rounded-3xl',
                'flex items-center justify-center shadow-md border-4 select-none',
                'transition-all duration-200 ease-out',
                faceUp ? 'scale-100' : 'hover:scale-105 active:scale-95',
                solved ? 'border-emerald-300 animate-bounce-slow' : 'border-white/60',
              ].join(' ')}
              style={
                faceUp
                  ? { background: card.entry.color }
                  : { background: 'linear-gradient(135deg, #a855f7, #6366f1)' }
              }
            >
              {faceUp ? (
                <span className="leading-none font-black text-white drop-shadow">
                  {card.kind === 'animal' ? (
                    <span className="text-4xl sm:text-5xl">{card.entry.emoji}</span>
                  ) : card.kind === 'lower' ? (
                    <span className="text-4xl sm:text-6xl">{card.entry.lower}</span>
                  ) : (
                    <span className="text-4xl sm:text-6xl">{card.entry.letter}</span>
                  )}
                </span>
              ) : (
                <span className="text-3xl sm:text-4xl text-white/90 font-black">❓</span>
              )}
              {solved && (
                <span className="absolute -top-2 -right-2 text-xl sm:text-2xl">⭐</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- Status / win ---- */}
      {won ? (
        <div className="text-center animate-fadeIn">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 animate-bounce-slow">
            🎉 You matched them all!
          </div>
          <div className="text-purple-500 text-sm mt-1">
            You did it in {turns} {turns === 1 ? 'turn' : 'turns'}! 🌟
          </div>
          <button
            onClick={newGame}
            className="mt-4 bg-gradient-to-br from-pink-500 to-orange-500 text-white font-black px-6 py-3 rounded-full shadow hover:scale-105 active:scale-95 transition-transform animate-wiggle"
          >
            🔁 Play again
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="text-purple-500 font-bold text-sm">
            ⭐ {matched.size} of {totalPairs} pairs · {turns} {turns === 1 ? 'turn' : 'turns'}
          </div>
          <button
            onClick={newGame}
            className="bg-white border-2 border-purple-200 text-purple-700 font-bold px-4 py-2 rounded-full text-sm hover:bg-purple-50 transition-colors"
          >
            🔁 New game
          </button>
        </div>
      )}
    </div>
  );
}
