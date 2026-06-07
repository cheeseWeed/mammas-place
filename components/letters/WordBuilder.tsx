'use client';

// Build a Word — a three-level phonics activity for preschool / kindergarten
// early readers. Standalone, self-contained client component.
//
//   EASY   — Word families: a fixed ending ("at"), tap a first letter to make a
//            real word (cat, hat, bat...). Only real-word onsets are offered.
//   MEDIUM — CVC sound-it-out: tap each tile to hear the part, then "Blend it!".
//   HARD   — Pick the matching ending blend for the picture, then build the
//            starting letters (onset) to finish the word.
//
// Audio is ALWAYS routed through speak() (a full line) and speakWord() (a real
// word, slow then fast). We never hand the voice a lone raw phoneme expecting a
// phoneme — whole words go through speakWord so TTS pronounces them correctly.

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

type Level = 'easy' | 'medium' | 'hard';

export default function WordBuilder() {
  const [level, setLevel] = useState<Level>('easy');

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-5 sm:p-6">
      <LevelSwitcher level={level} onPick={setLevel} />
      {level === 'easy' && <EasyFamilies />}
      {level === 'medium' && <MediumBlends />}
      {level === 'hard' && <HardBlends />}
    </div>
  );
}

// ---- Level switcher ----------------------------------------------------------

function LevelSwitcher({ level, onPick }: { level: Level; onPick: (l: Level) => void }) {
  const tabs: { id: Level; label: string; emoji: string; color: string }[] = [
    { id: 'easy', label: 'Easy', emoji: '🐱', color: 'from-emerald-400 to-teal-500' },
    { id: 'medium', label: 'Medium', emoji: '🔤', color: 'from-sky-400 to-indigo-500' },
    { id: 'hard', label: 'Hard', emoji: '🐸', color: 'from-fuchsia-500 to-purple-600' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
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

// ---- HARD: pick the ending, then build the start -----------------------------

const HARD_LETTER_POOL = 'bcdfghjklmnpqrstvw'.split('');

function HardBlends() {
  const [idx, setIdx] = useState(0);
  const w: HardWord = HARD_WORDS[idx];

  const [endingChosen, setEndingChosen] = useState(false);
  const [built, setBuilt] = useState(''); // assembled onset so far
  const [solved, setSolved] = useState(false);
  const [wrongEnding, setWrongEnding] = useState<string | null>(null);

  // Ending options: the correct one + a couple distractors from other words.
  const endingChoices = useMemo(() => {
    const options = [w.ending];
    for (let off = 1; off < HARD_WORDS.length && options.length < 4; off++) {
      const cand = HARD_WORDS[(idx + off) % HARD_WORDS.length].ending;
      if (!options.includes(cand)) options.push(cand);
    }
    // Deterministic rotate so the answer isn't always first.
    const rot = idx % options.length;
    return [...options.slice(rot), ...options.slice(0, rot)];
  }, [idx, w.ending]);

  // Starting-letter tiles: the real onset letters + a few extras, deduped.
  const letterChoices = useMemo(() => {
    const set: string[] = [...w.onset.split('')];
    for (const l of HARD_LETTER_POOL) {
      if (set.length >= 8) break;
      if (!set.includes(l)) set.push(l);
    }
    // Rotate for variety, deterministic.
    const rot = idx % set.length;
    return [...set.slice(rot), ...set.slice(0, rot)];
  }, [idx, w.onset]);

  const chooseEnding = (e: string) => {
    if (e === w.ending) {
      setEndingChosen(true);
      setWrongEnding(null);
      speak(`Yes! ${w.ending}.`);
    } else {
      setWrongEnding(e);
      speak('Try again! Which ending matches the picture?');
    }
  };

  const addLetter = (l: string) => {
    if (built.length >= 4 || solved) return;
    const nextBuilt = built + l;
    speak(l, { rate: 0.7, pitch: 1.1 });
    if (nextBuilt === w.onset) {
      setBuilt(nextBuilt);
      setSolved(true);
      setTimeout(() => speakWord(w.word), 500);
    } else if (w.onset.startsWith(nextBuilt)) {
      // On the right track — keep building.
      setBuilt(nextBuilt);
    } else {
      // Wrong letter — gently reset the start, keep it forgiving.
      setBuilt('');
      speak('Oops, try a different letter!');
    }
  };

  const clearStart = () => setBuilt('');

  const next = () => {
    setIdx((i) => (i + 1) % HARD_WORDS.length);
    setEndingChosen(false);
    setBuilt('');
    setSolved(false);
    setWrongEnding(null);
  };

  return (
    <div className="text-center">
      <div className="text-7xl mb-3 animate-bounce-slow">{w.emoji}</div>

      {/* The word so far: [built onset] + [ending once chosen] */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span
          className={
            built
              ? 'min-w-[5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-white bg-emerald-500 shadow-lg'
              : 'min-w-[5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-purple-300 border-4 border-dashed border-purple-300'
          }
        >
          {built || '?'}
        </span>
        <span
          className={
            endingChosen
              ? 'min-w-[5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-white bg-purple-500 shadow-lg'
              : 'min-w-[5rem] h-20 px-3 rounded-2xl flex items-center justify-center font-black text-4xl sm:text-5xl text-purple-300 border-4 border-dashed border-purple-300'
          }
        >
          {endingChosen ? w.ending : '__'}
        </span>
      </div>

      {!endingChosen && (
        <>
          <p className="text-purple-600 font-bold mb-1">Step 1: Pick the ending!</p>
          <p className="text-purple-400 text-sm mb-4">Which ending matches the picture?</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-2">
            {endingChoices.map((e) => (
              <button
                key={e}
                onClick={() => chooseEnding(e)}
                className={
                  wrongEnding === e
                    ? 'w-20 h-16 sm:w-24 sm:h-20 rounded-2xl font-black text-3xl sm:text-4xl text-white bg-amber-400 shadow transition-transform'
                    : 'w-20 h-16 sm:w-24 sm:h-20 rounded-2xl font-black text-3xl sm:text-4xl text-white bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow hover:scale-110 active:scale-90 transition-transform'
                }
              >
                {e}
              </button>
            ))}
          </div>
          {wrongEnding && (
            <div className="text-lg font-bold text-amber-600">Almost! Try again 💪</div>
          )}
        </>
      )}

      {endingChosen && !solved && (
        <>
          <p className="text-purple-600 font-bold mb-1">Step 2: Build the start!</p>
          <p className="text-purple-400 text-sm mb-4">Add the starting letters to spell the word.</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3">
            {letterChoices.map((l, i) => (
              <button
                key={`${l}-${i}`}
                onClick={() => addLetter(l)}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-black text-2xl sm:text-3xl text-white bg-gradient-to-br from-sky-400 to-indigo-500 shadow hover:scale-110 active:scale-90 transition-transform"
              >
                {l}
              </button>
            ))}
          </div>
          {built && (
            <button
              onClick={clearStart}
              className="text-purple-500 underline text-sm"
            >
              ↺ Clear and try again
            </button>
          )}
        </>
      )}

      {solved && <Cheer text={`🎉 You made ${w.word.toUpperCase()}!`} />}

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
