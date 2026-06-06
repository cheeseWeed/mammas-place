'use client';

// Letters & Sounds — preschool / kindergarten section for early readers.
// Big colorful letters "dressed" as animals (CSS character), tap to hear the
// sound (browser speech). Three modes: Explore (free play), Find the Sound
// (tap the letter that says X), and Blend (sound out CVC words). Designed to
// work WITHOUT reading — big tap targets, audio-first, lots of encouragement.

import { useState } from 'react';
import Link from 'next/link';
import SabbathGuard from '@/components/SabbathGuard';
import { LETTERS, BLENDS, type LetterEntry } from '@/lib/letters/data';
import { speak } from '@/lib/letters/speak';

type Mode = 'menu' | 'explore' | 'find' | 'blend';

export default function LettersPage() {
  const [mode, setMode] = useState<Mode>('menu');
  return (
    <SabbathGuard label="Letters & Sounds">
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-purple-50 to-white py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-5xl font-black text-purple-900 mb-1">
              🔤 Letters &amp; Sounds
            </h1>
            <p className="text-purple-600 text-sm">Tap a letter to hear its sound!</p>
          </div>

          {mode === 'menu' && <Menu onPick={setMode} />}
          {mode !== 'menu' && (
            <button
              onClick={() => setMode('menu')}
              className="mb-4 bg-white border-2 border-purple-200 text-purple-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-purple-50"
            >
              ← Back
            </button>
          )}
          {mode === 'explore' && <Explore />}
          {mode === 'find' && <FindTheSound />}
          {mode === 'blend' && <BlendWords />}

          <div className="text-center mt-10">
            <Link href="/" className="text-purple-700 underline text-sm">← Home</Link>
          </div>
        </div>
      </div>
    </SabbathGuard>
  );
}

// ---- Menu ----
function Menu({ onPick }: { onPick: (m: Mode) => void }) {
  const cards: { mode: Mode; emoji: string; title: string; sub: string; color: string }[] = [
    { mode: 'explore', emoji: '🐻', title: 'Meet the Letters', sub: 'Tap each letter & animal', color: 'from-orange-400 to-pink-500' },
    { mode: 'find', emoji: '👂', title: 'Find the Sound', sub: 'Tap the letter you hear', color: 'from-sky-400 to-indigo-500' },
    { mode: 'blend', emoji: '🐱', title: 'Build a Word', sub: 'Sound it out: c-a-t!', color: 'from-emerald-400 to-teal-500' },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <button
          key={c.mode}
          onClick={() => onPick(c.mode)}
          className={`bg-gradient-to-br ${c.color} text-white rounded-3xl p-6 shadow-lg hover:scale-105 transition-transform text-center`}
        >
          <div className="text-6xl mb-2 animate-bounce-slow">{c.emoji}</div>
          <div className="font-black text-xl">{c.title}</div>
          <div className="text-white/90 text-sm">{c.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ---- A single big letter that can "put on" its animal costume ----
// When `dressed` is false the letter is plain grey (undisguised). When true,
// the costume animates ON: color fills in, ears pop up, the animal emoji
// appears. CSS transitions do all the motion. Small variant is always dressed.
function AnimalLetter({
  entry, size = 'big', dressed = true, onTap,
}: { entry: LetterEntry; size?: 'big' | 'small'; dressed?: boolean; onTap?: () => void }) {
  const dim = size === 'big' ? 'w-40 h-40 text-7xl' : 'w-20 h-20 text-3xl';
  const earDim = size === 'big' ? 'w-12 h-12 -top-5' : 'w-6 h-6 -top-2.5';
  const on = dressed; // costume on?
  return (
    <button
      onClick={() => { speak(entry.spoken); onTap?.(); }}
      className="relative inline-flex flex-col items-center group focus:outline-none"
      aria-label={entry.spoken}
    >
      {/* Animal "ears" — pop up and wiggle only when dressed */}
      <span
        className={`absolute ${earDim} left-2 rounded-full transition-all duration-500 ${on ? 'opacity-100 scale-100 animate-wiggle' : 'opacity-0 scale-0'}`}
        style={{ background: entry.color }}
      />
      <span
        className={`absolute ${earDim} right-2 rounded-full transition-all duration-500 ${on ? 'opacity-100 scale-100 animate-wiggle' : 'opacity-0 scale-0'}`}
        style={{ background: entry.color }}
      />
      <span
        className={`relative ${dim} rounded-3xl flex items-center justify-center font-black text-white shadow-lg group-active:scale-90 group-hover:-rotate-3 transition-all duration-500 ${on ? 'animate-float' : ''}`}
        style={{ background: on ? entry.color : '#cbd5e1' }}
      >
        {entry.letter}
        {/* the animal face appears as the costume goes on */}
        <span
          className={`absolute -bottom-3 -right-3 ${size === 'big' ? 'text-4xl' : 'text-xl'} transition-all duration-500 ${on ? 'opacity-100 scale-100 animate-bounce-slow' : 'opacity-0 scale-0'}`}
        >
          {entry.emoji}
        </span>
      </span>
      {size === 'big' && (
        <span
          className="mt-4 font-black text-2xl transition-colors duration-500"
          style={{ color: on ? entry.color : '#94a3b8' }}
        >
          {on ? entry.word : entry.letter}
        </span>
      )}
    </button>
  );
}

// ---- Explore: letter starts plain, then "puts on" its animal costume ----
function Explore() {
  const [idx, setIdx] = useState(0);
  const [dressed, setDressed] = useState(false);
  const entry = LETTERS[idx];
  const go = (next: number) => { setIdx(next); setDressed(false); };
  const dressUp = () => {
    setDressed(true);
    speak(entry.spoken);
  };
  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-6">
      <div className="flex flex-col items-center mb-4 min-h-[18rem] justify-center">
        <AnimalLetter entry={entry} dressed={dressed} onTap={() => setDressed(true)} />
        <button
          onClick={dressUp}
          className={`mt-5 font-black px-6 py-3 rounded-full text-white shadow transition-transform hover:scale-105 ${dressed ? 'bg-purple-400' : 'bg-gradient-to-br from-pink-500 to-orange-500 animate-bounce-slow'}`}
        >
          {dressed ? '🔊 Say it again' : '🎭 Dress up the letter!'}
        </button>
        <p className="text-purple-500 text-sm mt-3">
          {dressed ? `${entry.letter} is dressed as a ${entry.animal}!` : 'Tap the button to give this letter a costume!'}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => go((idx - 1 + LETTERS.length) % LETTERS.length)}
          className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-14 h-14 rounded-full text-2xl"
        >←</button>
        <span className="text-purple-400 font-bold">{idx + 1} / {LETTERS.length}</span>
        <button
          onClick={() => go((idx + 1) % LETTERS.length)}
          className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-14 h-14 rounded-full text-2xl"
        >→</button>
      </div>
      {/* Whole-alphabet strip to jump around */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {LETTERS.map((l, i) => (
          <button
            key={l.letter}
            onClick={() => { go(i); }}
            className={`w-9 h-9 rounded-lg font-black text-white text-sm transition-transform hover:scale-110 ${i === idx ? 'ring-4 ring-purple-300' : ''}`}
            style={{ background: l.color }}
          >
            {l.letter}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Find the Sound: hear a sound, tap the matching letter ----
function FindTheSound() {
  const [target, setTarget] = useState<LetterEntry>(() => LETTERS[0]);
  const [choices, setChoices] = useState<LetterEntry[]>(() => pickChoices(LETTERS[0]));
  const [feedback, setFeedback] = useState<'none' | 'yes' | 'no'>('none');
  const [score, setScore] = useState(0);

  function pickChoices(answer: LetterEntry): LetterEntry[] {
    const others: LetterEntry[] = [];
    // deterministic-ish spread of distractors based on the answer index
    const ai = LETTERS.indexOf(answer);
    for (const off of [3, 7, 13]) {
      const c = LETTERS[(ai + off) % LETTERS.length];
      if (c.letter !== answer.letter && !others.includes(c)) others.push(c);
    }
    const all = [answer, ...others];
    // rotate by the answer index so the correct one isn't always first
    const rot = ai % all.length;
    return [...all.slice(rot), ...all.slice(0, rot)];
  }

  const newRound = () => {
    const next = LETTERS[(LETTERS.indexOf(target) + 5) % LETTERS.length];
    setTarget(next);
    setChoices(pickChoices(next));
    setFeedback('none');
    setTimeout(() => speak(`Find the letter that says ${next.sound}`), 150);
  };

  const choose = (c: LetterEntry) => {
    if (c.letter === target.letter) {
      setFeedback('yes');
      setScore((s) => s + 1);
      speak(`Yes! ${target.spoken}`);
      setTimeout(newRound, 1400);
    } else {
      setFeedback('no');
      speak(`Try again. Find ${target.sound}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-6 text-center">
      <button
        onClick={() => speak(`Find the letter that says ${target.sound}`)}
        className="bg-gradient-to-br from-sky-400 to-indigo-500 text-white font-black text-xl px-6 py-4 rounded-2xl shadow mb-2 hover:scale-105 transition-transform"
      >
        👂 Hear the sound
      </button>
      <p className="text-purple-500 text-sm mb-5">Tap the button, then pick the letter you hear.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center mb-4">
        {choices.map((c) => (
          <AnimalLetter key={c.letter} entry={c} size="small" onTap={() => choose(c)} />
        ))}
      </div>

      {feedback === 'yes' && <div className="text-2xl font-black text-emerald-600 animate-bounce-slow">🎉 Great job!</div>}
      {feedback === 'no' && <div className="text-xl font-bold text-amber-600">Almost! Try again 💪</div>}
      <div className="mt-4 text-purple-400 font-bold text-sm">⭐ {score} correct</div>
    </div>
  );
}

// ---- Build a Word: sound out a CVC word part by part, then blend ----
function BlendWords() {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(0); // how many parts sounded out
  const w = BLENDS[idx];

  const sayPart = (i: number) => {
    speak(w.parts[i]);
    setRevealed((r) => Math.max(r, i + 1));
  };
  const blend = () => { setRevealed(w.parts.length); speak(`${w.word.split('').join(' ')} ... ${w.word}!`); };
  const next = () => { setIdx((i) => (i + 1) % BLENDS.length); setRevealed(0); };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-6 text-center">
      <div className="text-7xl mb-3 animate-bounce-slow">{w.emoji}</div>

      <div className="flex justify-center gap-2 mb-5">
        {w.parts.map((p, i) => (
          <button
            key={i}
            onClick={() => sayPart(i)}
            className={`w-16 h-16 rounded-2xl font-black text-3xl text-white shadow transition-transform hover:scale-110 active:scale-90 ${
              i < revealed ? 'bg-emerald-500' : 'bg-purple-400'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={blend}
          className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow hover:scale-105 transition-transform"
        >
          🔊 Blend it: {w.word}!
        </button>
        <button
          onClick={next}
          className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-6 py-3 rounded-2xl"
        >
          Next word →
        </button>
      </div>
      <p className="text-purple-500 text-sm mt-4">Tap each letter to sound it out, then blend!</p>
    </div>
  );
}
