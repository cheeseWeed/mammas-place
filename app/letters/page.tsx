'use client';

// Letters & Sounds — preschool / kindergarten section for early readers.
// Four modes: Meet the Letters (capital + lowercase, hear the sound, dress it),
// Find the Sound, Build a Word (easy/mid/hard), and the Dress-Up Studio.
// Audio-first, big tap targets, works without reading.

import { useState } from 'react';
import Link from 'next/link';
import SabbathGuard from '@/components/SabbathGuard';
import { LETTERS, type LetterEntry } from '@/lib/letters/data';
import { speak } from '@/lib/letters/speak';
import WordBuilder from '@/components/letters/WordBuilder';
import DressUpStudio from '@/components/letters/DressUpStudio';

type Mode = 'menu' | 'explore' | 'find' | 'build' | 'dressup';

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
          {mode === 'build' && <WordBuilder />}
          {mode === 'dressup' && <DressUpStudio />}

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
    { mode: 'explore', emoji: '🅰️', title: 'Meet the Letters', sub: 'Hear each letter & sound', color: 'from-orange-400 to-pink-500' },
    { mode: 'find', emoji: '👂', title: 'Find the Sound', sub: 'Tap the letter you hear', color: 'from-sky-400 to-indigo-500' },
    { mode: 'build', emoji: '🐱', title: 'Build a Word', sub: 'Easy · Medium · Hard', color: 'from-emerald-400 to-teal-500' },
    { mode: 'dressup', emoji: '🎨', title: 'Dress a Letter', sub: 'Make A into an Alligator!', color: 'from-fuchsia-500 to-purple-600' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

// ---- A letter card showing BOTH cases; the "active" one is bigger + colored. ----
function CaseLetter({ entry, active, onTap }: { entry: LetterEntry; active: 'upper' | 'lower'; onTap?: () => void }) {
  const Big = ({ ch }: { ch: string }) => (
    <span
      className="w-36 h-36 rounded-3xl flex items-center justify-center font-black text-white text-7xl shadow-lg animate-float"
      style={{ background: entry.color }}
    >
      {ch}
    </span>
  );
  const Small = ({ ch }: { ch: string }) => (
    <span
      className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-4xl shadow border-2"
      style={{ color: entry.color, borderColor: entry.color, background: '#fff' }}
    >
      {ch}
    </span>
  );
  return (
    <button
      onClick={() => { speak(entry.spoken); onTap?.(); }}
      className="inline-flex items-end gap-4 group focus:outline-none"
      aria-label={entry.spoken}
    >
      {active === 'upper' ? <Big ch={entry.letter} /> : <Small ch={entry.letter} />}
      {active === 'lower' ? <Big ch={entry.lower} /> : <Small ch={entry.lower} />}
    </button>
  );
}

// ---- Meet the Letters: capital + lowercase, hear the sound ----
function Explore() {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState<'upper' | 'lower'>('upper');
  const entry = LETTERS[idx];
  const go = (n: number) => { setIdx(n); };
  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-6">
      <div className="flex flex-col items-center mb-4 min-h-[16rem] justify-center">
        <CaseLetter entry={entry} active={active} onTap={() => undefined} />
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setActive('upper')}
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${active === 'upper' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}
          >Big {entry.letter}</button>
          <button
            onClick={() => setActive('lower')}
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${active === 'lower' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}
          >little {entry.lower}</button>
        </div>
        <button
          onClick={() => speak(entry.spoken)}
          className="mt-4 bg-gradient-to-br from-pink-500 to-orange-500 text-white font-black px-6 py-3 rounded-full shadow hover:scale-105 transition-transform"
        >
          🔊 {entry.letter} is for {entry.animal} {entry.emoji}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={() => go((idx - 1 + LETTERS.length) % LETTERS.length)} className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-14 h-14 rounded-full text-2xl">←</button>
        <span className="text-purple-400 font-bold">{idx + 1} / {LETTERS.length}</span>
        <button onClick={() => go((idx + 1) % LETTERS.length)} className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-14 h-14 rounded-full text-2xl">→</button>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {LETTERS.map((l, i) => (
          <button
            key={l.letter}
            onClick={() => { go(i); speak(l.spoken); }}
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
    const ai = LETTERS.indexOf(answer);
    const others: LetterEntry[] = [];
    for (const off of [3, 7, 13]) {
      const c = LETTERS[(ai + off) % LETTERS.length];
      if (c.letter !== answer.letter && !others.includes(c)) others.push(c);
    }
    const all = [answer, ...others];
    const rot = ai % all.length;
    return [...all.slice(rot), ...all.slice(0, rot)];
  }

  const newRound = () => {
    const next = LETTERS[(LETTERS.indexOf(target) + 5) % LETTERS.length];
    setTarget(next);
    setChoices(pickChoices(next));
    setFeedback('none');
    setTimeout(() => speak(next.spoken), 150);
  };

  const choose = (c: LetterEntry) => {
    if (c.letter === target.letter) {
      setFeedback('yes');
      setScore((s) => s + 1);
      speak(`Yes! ${target.spoken}`);
      setTimeout(newRound, 1500);
    } else {
      setFeedback('no');
      speak(`Try again. ${target.letter} is for ${target.animal}.`);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-6 text-center">
      <button
        onClick={() => speak(target.spoken)}
        className="bg-gradient-to-br from-sky-400 to-indigo-500 text-white font-black text-xl px-6 py-4 rounded-2xl shadow mb-2 hover:scale-105 transition-transform"
      >
        👂 Hear the letter
      </button>
      <p className="text-purple-500 text-sm mb-5">Tap the button, then pick the letter you hear.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center mb-4">
        {choices.map((c) => (
          <button
            key={c.letter}
            onClick={() => choose(c)}
            className="w-24 h-24 rounded-3xl flex items-center justify-center font-black text-white text-5xl shadow-lg hover:scale-105 active:scale-95 transition-transform"
            style={{ background: c.color }}
          >
            {c.letter}
          </button>
        ))}
      </div>

      {feedback === 'yes' && <div className="text-2xl font-black text-emerald-600 animate-bounce-slow">🎉 Great job!</div>}
      {feedback === 'no' && <div className="text-xl font-bold text-amber-600">Almost! Try again 💪</div>}
      <div className="mt-4 text-purple-400 font-bold text-sm">⭐ {score} correct</div>
    </div>
  );
}
