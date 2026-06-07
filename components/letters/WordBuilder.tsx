'use client';

// Build a Word — a four-level phonics activity for preschool / kindergarten
// early readers. Standalone, self-contained client component.
//
//   EASY       — Word families: a fixed ending ("at"), tap a first letter to make
//                a real word (cat, hat, bat...). Only real-word onsets are offered.
//   MEDIUM     — CVC sound-it-out: tap each tile to hear the part, then "Blend it!".
//   HARD       — Match the picture: see the emoji + one empty box per letter, then
//                tap letter tiles to fill every slot left-to-right. Wrong letter for
//                a slot = gentle "try again" (doesn't lock). All slots correct →
//                speakWord + celebration.
//   FREE BUILD — No picture. Pick a BEGINNING (letter or blend) + an ENDING (rime);
//                the app shows the combined "word" and says it. Free play — the
//                result doesn't have to be a real word.
//
// Audio is ALWAYS routed through speak() (a full line) and speakWord() (a real
// word, slow then fast). We never hand the voice a lone raw phoneme expecting a
// phoneme — whole words go through speakWord so TTS pronounces them correctly.
// speak / speakWord / playLetter each auto-stop any prior sound (shared channel).

import { useMemo, useState } from 'react';
import {
  WORD_FAMILIES,
  BLENDS,
  HARD_WORDS,
  type WordFamily,
  type BlendWord,
  type HardWord,
} from '@/lib/letters/data';
import { speak, speakWord } from '@/lib/letters/speak';

type Level = 'easy' | 'medium' | 'hard' | 'free';

export default function WordBuilder() {
  const [level, setLevel] = useState<Level>('easy');

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-5 sm:p-6">
      <LevelSwitcher level={level} onPick={setLevel} />
      {level === 'easy' && <EasyFamilies />}
      {level === 'medium' && <MediumBlends />}
      {level === 'hard' && <HardPictureMatch />}
      {level === 'free' && <FreeBuild />}
    </div>
  );
}

// ---- Level switcher ----------------------------------------------------------

function LevelSwitcher({ level, onPick }: { level: Level; onPick: (l: Level) => void }) {
  const tabs: { id: Level; label: string; emoji: string; color: string }[] = [
    { id: 'easy', label: 'Easy', emoji: '🐱', color: 'from-emerald-400 to-teal-500' },
    { id: 'medium', label: 'Medium', emoji: '🔤', color: 'from-sky-400 to-indigo-500' },
    { id: 'hard', label: 'Hard', emoji: '🐸', color: 'from-fuchsia-500 to-purple-600' },
    { id: 'free', label: 'Free Build', emoji: '🧩', color: 'from-amber-400 to-orange-500' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
      {tabs.map((t) => {
        const active = t.id === level;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className={
              active
                ? `bg-gradient-to-br ${t.color} text-white rounded-2xl py-3 px-2 font-black shadow-lg scale-105 transition-transform`
                : 'bg-purple-50 text-purple-700 rounded-2xl py-3 px-2 font-bold border-2 border-purple-100 hover:bg-purple-100 transition-colors'
            }
          >
            <div className="text-2xl sm:text-3xl">{t.emoji}</div>
            <div className="text-sm sm:text-base">{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// A round cheer line used across levels.
function Cheer({ text }: { text: string }) {
  return (
    <div className="mt-5 text-2xl sm:text-3xl font-black text-emerald-600 animate-bounce-slow">
      {text}
    </div>
  );
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-6 py-3 rounded-2xl transition-colors"
    >
      {label} →
    </button>
  );
}

// ---- EASY: word families -----------------------------------------------------

function EasyFamilies() {
  const [familyIdx, setFamilyIdx] = useState(0);
  const [onset, setOnset] = useState<string | null>(null);
  const family: WordFamily = WORD_FAMILIES[familyIdx];

  const fullWord = onset ? `${onset}${family.ending}` : null;

  const pickOnset = (o: string) => {
    setOnset(o);
    const word = `${o}${family.ending}`;
    // Say the parts, then say the whole word slowly + fast.
    speak(`${o} ... ${family.ending} ...`);
    setTimeout(() => speakWord(word), 700);
  };

  const nextFamily = () => {
    setFamilyIdx((i) => (i + 1) % WORD_FAMILIES.length);
    setOnset(null);
  };

  return (
    <div className="text-center">
      <p className="text-purple-600 font-bold mb-1">Make a word in the “-{family.ending}” family!</p>
      <p className="text-purple-400 text-sm mb-4">Tap a letter to put it in front.</p>

      {/* The word being built: [onset box] + fixed ending */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <span
          className={
            onset
              ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-black text-5xl sm:text-6xl text-white bg-emerald-500 shadow-lg animate-bounce-slow'
              : 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-black text-5xl sm:text-6xl text-purple-300 border-4 border-dashed border-purple-300'
          }
        >
          {onset ?? '?'}
        </span>
        <span className="w-28 h-20 sm:w-36 sm:h-24 rounded-2xl flex items-center justify-center font-black text-5xl sm:text-6xl text-white bg-purple-500 shadow-lg">
          {family.ending}
        </span>
        <span className="text-5xl sm:text-6xl ml-1">{onset ? family.emoji : ''}</span>
      </div>

      {/* Onset choices — only real-word onsets, so no non-words possible */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
        {family.onsets.map((o) => {
          const selected = o === onset;
          return (
            <button
              key={o}
              onClick={() => pickOnset(o)}
              className={
                selected
                  ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black text-2xl sm:text-3xl text-white bg-emerald-500 shadow ring-4 ring-emerald-200 transition-transform'
                  : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black text-2xl sm:text-3xl text-white bg-gradient-to-br from-orange-400 to-pink-500 shadow hover:scale-110 active:scale-90 transition-transform'
              }
            >
              {o}
            </button>
          );
        })}
      </div>

      {fullWord && (
        <Cheer text={`🎉 You made ${fullWord.toUpperCase()}!`} />
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
        {fullWord && (
          <button
            onClick={() => speakWord(fullWord)}
            className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow hover:scale-105 transition-transform"
          >
            🔊 Say {fullWord}!
          </button>
        )}
        <NextButton label="Next family" onClick={nextFamily} />
      </div>
    </div>
  );
}

// ---- MEDIUM: CVC sound-it-out ------------------------------------------------

function MediumBlends() {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(0); // how many tiles tapped
  const [blended, setBlended] = useState(false);
  const w: BlendWord = BLENDS[idx];

  const sayPart = (i: number) => {
    // A single part is okay to speak gently here — keep it short & soft.
    speak(w.parts[i], { rate: 0.7, pitch: 1.1 });
    setRevealed((r) => Math.max(r, i + 1));
  };

  const blend = () => {
    setRevealed(w.parts.length);
    setBlended(true);
    speakWord(w.word); // whole word, slow then fast
  };

  const next = () => {
    setIdx((i) => (i + 1) % BLENDS.length);
    setRevealed(0);
    setBlended(false);
  };

  return (
    <div className="text-center">
      <p className="text-purple-600 font-bold mb-1">Sound it out, then blend!</p>
      <p className="text-purple-400 text-sm mb-3">Tap each letter, then press “Blend it!”.</p>

      <div className="text-7xl mb-4 animate-bounce-slow">{w.emoji}</div>

      <div className="flex justify-center gap-2 sm:gap-3 mb-5">
        {w.parts.map((p, i) => (
          <button
            key={i}
            onClick={() => sayPart(i)}
            className={
              i < revealed
                ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl font-black text-3xl sm:text-4xl text-white bg-emerald-500 shadow transition-transform hover:scale-110 active:scale-90'
                : 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl font-black text-3xl sm:text-4xl text-white bg-gradient-to-br from-sky-400 to-indigo-500 shadow transition-transform hover:scale-110 active:scale-90'
            }
          >
            {p}
          </button>
        ))}
      </div>

      {blended && <Cheer text={`🎉 You read ${w.word.toUpperCase()}!`} />}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
        <button
          onClick={blend}
          className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow hover:scale-105 transition-transform"
        >
          🔊 Blend it: {w.word}!
        </button>
        <NextButton label="Next word" onClick={next} />
      </div>
    </div>
  );
}

// ---- HARD: match the picture, fill every letter slot -------------------------
//
// Show the picture + one empty box per letter. The kid taps a slot (or just uses
// the next empty one, left-to-right) then taps a letter tile. A correct letter
// for the active slot LOCKS in; a wrong one gives a gentle "try again" and does
// not lock. All slots filled correctly → speakWord(word) + celebration.

// Distractor letters mixed into the tile tray (kid-friendly consonants/vowels).
const HARD_LETTER_POOL = 'aeioubcdfghklmnprstw'.split('');

// Deterministic shuffle from a seed so tiles don't re-order on every render but
// still vary per word. Simple LCG over indices.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed * 2654435761 + 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function HardPictureMatch() {
  const [idx, setIdx] = useState(0);
  const w: HardWord = HARD_WORDS[idx];
  const target = w.word.split(''); // e.g. ['f','r','o','g']

  // filled[i] = the letter locked into slot i, or null if still empty.
  const [filled, setFilled] = useState<(string | null)[]>(() => target.map(() => null));
  const [active, setActive] = useState(0);          // which slot we're filling
  const [wrongTile, setWrongTile] = useState<string | null>(null); // flash a tile
  const [solved, setSolved] = useState(false);

  // Letter tiles: every real letter of the word + distractors, deduped, shuffled.
  const tiles = useMemo(() => {
    const set: string[] = [];
    for (const l of target) if (!set.includes(l)) set.push(l);
    for (const l of HARD_LETTER_POOL) {
      if (set.length >= Math.max(8, target.length + 4)) break;
      if (!set.includes(l)) set.push(l);
    }
    return seededShuffle(set, idx + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // First slot that's still empty (where the next correct tile lands).
  const firstEmpty = filled.findIndex((f) => f === null);
  // The slot we're aiming to fill: the user's chosen active slot if empty, else
  // the first empty slot.
  const targetSlot = filled[active] === null ? active : firstEmpty;

  const tapTile = (l: string) => {
    if (solved) return;
    const slot = targetSlot;
    if (slot < 0) return; // nothing left to fill
    if (l === target[slot]) {
      const nextFilled = filled.slice();
      nextFilled[slot] = l;
      setFilled(nextFilled);
      setWrongTile(null);
      // Move active to the next still-empty slot.
      const nextEmpty = nextFilled.findIndex((f) => f === null);
      setActive(nextEmpty < 0 ? slot : nextEmpty);
      if (nextEmpty < 0) {
        // All slots correct!
        setSolved(true);
        setTimeout(() => speakWord(w.word), 350);
      } else {
        speak(l, { rate: 0.7, pitch: 1.1 });
      }
    } else {
      // Wrong letter for this slot — gentle nudge, don't lock.
      setWrongTile(l);
      speak('Try again!');
      setTimeout(() => setWrongTile((t) => (t === l ? null : t)), 600);
    }
  };

  const tapSlot = (i: number) => {
    if (solved) return;
    if (filled[i] !== null) {
      // Tapping a filled slot clears it so the kid can redo it.
      const nextFilled = filled.slice();
      nextFilled[i] = null;
      setFilled(nextFilled);
    }
    setActive(i);
  };

  const clearAll = () => {
    setFilled(target.map(() => null));
    setActive(0);
    setWrongTile(null);
    setSolved(false);
  };

  const next = () => {
    const ni = (idx + 1) % HARD_WORDS.length;
    setIdx(ni);
    setFilled(HARD_WORDS[ni].word.split('').map(() => null));
    setActive(0);
    setWrongTile(null);
    setSolved(false);
  };

  return (
    <div className="text-center">
      <p className="text-purple-600 font-bold mb-1">Match the picture!</p>
      <p className="text-purple-400 text-sm mb-3">Tap letters to spell what you see.</p>

      <div className="text-7xl mb-4 animate-bounce-slow">{w.emoji}</div>

      {/* One box per letter — all spots visible. */}
      <div className="flex justify-center gap-1.5 sm:gap-2 mb-5">
        {target.map((_, i) => {
          const letter = filled[i];
          const isActive = !solved && i === targetSlot;
          const base =
            'w-14 h-16 sm:w-16 sm:h-20 rounded-2xl flex items-center justify-center font-black text-3xl sm:text-4xl transition-transform';
          if (letter) {
            return (
              <button
                key={i}
                onClick={() => tapSlot(i)}
                className={`${base} text-white bg-emerald-500 shadow-lg ${solved ? 'animate-bounce-slow' : 'hover:scale-105 active:scale-90'}`}
              >
                {letter}
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => tapSlot(i)}
              className={`${base} ${
                isActive
                  ? 'text-purple-400 border-4 border-fuchsia-400 ring-4 ring-fuchsia-200 bg-fuchsia-50'
                  : 'text-purple-300 border-4 border-dashed border-purple-300'
              }`}
            >
              {isActive ? '_' : ''}
            </button>
          );
        })}
      </div>

      {/* Letter tile tray */}
      {!solved && (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3">
          {tiles.map((l, i) => (
            <button
              key={`${l}-${i}`}
              onClick={() => tapTile(l)}
              className={
                wrongTile === l
                  ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black text-2xl sm:text-3xl text-white bg-amber-400 shadow animate-pulse transition-transform'
                  : 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black text-2xl sm:text-3xl text-white bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow hover:scale-110 active:scale-90 transition-transform'
              }
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {wrongTile && (
        <div className="text-lg font-bold text-amber-600 mb-1">Almost! Try again 💪</div>
      )}

      {!solved && filled.some((f) => f !== null) && (
        <button onClick={clearAll} className="text-purple-500 underline text-sm">
          ↺ Clear and start over
        </button>
      )}

      {solved && <Cheer text={`🎉 You spelled ${w.word.toUpperCase()}!`} />}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
        {solved && (
          <button
            onClick={() => speakWord(w.word)}
            className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow hover:scale-105 transition-transform"
          >
            🔊 Say {w.word}!
          </button>
        )}
        <NextButton label="Next word" onClick={next} />
      </div>
    </div>
  );
}

// ---- FREE BUILD: mix a beginning + an ending, hear the sound ------------------
//
// No picture, no "right answer". The kid taps a BEGINNING (letter or blend) and
// an ENDING (rime); the app shows the combined letters big and says them. Pure
// sound-mixing play — silly non-words are encouraged.

const FREE_BEGINNINGS = [
  'b', 'c', 'd', 'f', 'm', 'p', 's', 't',
  'st', 'tr', 'fr', 'cl', 'sh', 'ch', 'br', 'gr', 'pl', 'sn',
];
const FREE_ENDINGS = [
  'at', 'an', 'ig', 'op', 'un', 'ed', 'ug', 'en',
  'og', 'ap', 'it', 'ot', 'am', 'ad', 'in',
];

function FreeBuild() {
  const [beginning, setBeginning] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  const word = (beginning ?? '') + (ending ?? '');
  const ready = beginning !== null && ending !== null;

  const pickBeginning = (b: string) => {
    setBeginning(b);
    if (ending !== null) speakWord(b + ending);
    else speak(b, { rate: 0.7, pitch: 1.1 });
  };

  const pickEnding = (e: string) => {
    setEnding(e);
    if (beginning !== null) speakWord(beginning + e);
    else speak(e, { rate: 0.7, pitch: 1.1 });
  };

  const clear = () => {
    setBeginning(null);
    setEnding(null);
  };

  return (
    <div className="text-center">
      <p className="text-purple-600 font-bold mb-1">Free Build — mix sounds!</p>
      <p className="text-purple-400 text-sm mb-4">
        Pick a beginning and an ending. Make real words or silly ones!
      </p>

      {/* The assembled "word" — big. */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <span
          className={
            beginning
              ? 'min-w-[4.5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-white bg-amber-500 shadow-lg'
              : 'min-w-[4.5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-purple-300 border-4 border-dashed border-purple-300'
          }
        >
          {beginning ?? '?'}
        </span>
        <span className="text-3xl text-purple-300">+</span>
        <span
          className={
            ending
              ? 'min-w-[4.5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-white bg-orange-500 shadow-lg'
              : 'min-w-[4.5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-purple-300 border-4 border-dashed border-purple-300'
          }
        >
          {ending ?? '?'}
        </span>
        {ready && (
          <>
            <span className="text-3xl text-purple-300">=</span>
            <span className="min-w-[6rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-white bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg animate-bounce-slow">
              {word}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* BEGINNINGS */}
        <div>
          <p className="font-black text-amber-600 mb-2">Beginnings</p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {FREE_BEGINNINGS.map((b) => (
              <button
                key={b}
                onClick={() => pickBeginning(b)}
                className={
                  b === beginning
                    ? 'min-w-[2.75rem] h-11 sm:h-12 px-2 rounded-xl font-black text-lg sm:text-xl text-white bg-amber-600 shadow ring-4 ring-amber-200 transition-transform'
                    : 'min-w-[2.75rem] h-11 sm:h-12 px-2 rounded-xl font-black text-lg sm:text-xl text-white bg-gradient-to-br from-amber-400 to-orange-500 shadow hover:scale-110 active:scale-90 transition-transform'
                }
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* ENDINGS */}
        <div>
          <p className="font-black text-orange-600 mb-2">Endings</p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {FREE_ENDINGS.map((e) => (
              <button
                key={e}
                onClick={() => pickEnding(e)}
                className={
                  e === ending
                    ? 'min-w-[2.75rem] h-11 sm:h-12 px-2 rounded-xl font-black text-lg sm:text-xl text-white bg-orange-600 shadow ring-4 ring-orange-200 transition-transform'
                    : 'min-w-[2.75rem] h-11 sm:h-12 px-2 rounded-xl font-black text-lg sm:text-xl text-white bg-gradient-to-br from-orange-400 to-pink-500 shadow hover:scale-110 active:scale-90 transition-transform'
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
        <button
          onClick={() => ready && speakWord(word)}
          disabled={!ready}
          className={
            ready
              ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow hover:scale-105 transition-transform'
              : 'bg-purple-100 text-purple-300 font-black px-6 py-3 rounded-2xl cursor-not-allowed'
          }
        >
          🔊 Say it!
        </button>
        <button
          onClick={clear}
          className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-6 py-3 rounded-2xl transition-colors"
        >
          ↺ Clear
        </button>
      </div>
    </div>
  );
}
