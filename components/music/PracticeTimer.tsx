'use client';

// Practice timer for the music Practice Studio — count-up stopwatch with an
// optional "practice N minutes" target and a confetti celebration when the
// target is reached.
//
// DELIBERATELY CLIENT-ONLY. This timer does NOT award MP and must never call
// /api/money/earn — the kid still logs practice through the piece cards, and
// wiring the timer to money would create a double-credit path (timer + log).
// It's a helper for the kid to SEE their time, nothing more.
//
// Persistence: sessionStorage (same-tab only). We store the accumulated
// milliseconds plus the epoch timestamp the current run started at, so an
// accidental refresh doesn't zero the clock — elapsed time is recomputed as
// baseMs + (now - startedAt) and even keeps ticking through the reload.

import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';

const STORAGE_KEY = 'mp-music-practice-timer-v1';

// Target presets, minutes. 15 is the classic "practice 15 min" ask.
const TARGET_PRESETS = [10, 15, 20, 30];

interface PersistedTimer {
  baseMs: number;           // ms accumulated across previous run segments
  startedAt: number | null; // epoch ms the current segment started; null = paused
  targetMin: number | null; // optional goal in minutes
  celebrated: boolean;      // goal celebration already fired (don't re-fire on refresh)
}

function readPersisted(): PersistedTimer | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<PersistedTimer>;
    return {
      baseMs: typeof obj.baseMs === 'number' && obj.baseMs >= 0 ? obj.baseMs : 0,
      startedAt: typeof obj.startedAt === 'number' ? obj.startedAt : null,
      targetMin: typeof obj.targetMin === 'number' && obj.targetMin > 0 ? obj.targetMin : null,
      celebrated: obj.celebrated === true,
    };
  } catch {
    return null;
  }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function PracticeTimer() {
  const [loaded, setLoaded] = useState(false); // hydrated from sessionStorage yet?
  const [baseMs, setBaseMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [targetMin, setTargetMin] = useState<number | null>(null);
  const [celebrated, setCelebrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Confetti bookkeeping (ephemeral — not persisted).
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Hydrate from sessionStorage AFTER mount (SSR-safe, no hydration mismatch).
  useEffect(() => {
    const saved = readPersisted();
    if (saved) {
      setBaseMs(saved.baseMs);
      setStartedAt(saved.startedAt);
      setTargetMin(saved.targetMin);
      setCelebrated(saved.celebrated);
    }
    setLoaded(true);
  }, []);

  // Persist every meaningful change (ticks don't need writes — baseMs +
  // startedAt fully determine elapsed time after a reload).
  useEffect(() => {
    if (!loaded) return;
    try {
      const data: PersistedTimer = { baseMs, startedAt, targetMin, celebrated };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full/blocked — timer still works for this page view
    }
  }, [loaded, baseMs, startedAt, targetMin, celebrated]);

  // Tick 5×/sec while running so the seconds feel live.
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt]);

  // Confetti needs viewport dims; track resize like the checkout page does.
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const elapsedMs = baseMs + (startedAt !== null ? Math.max(0, now - startedAt) : 0);
  const running = startedAt !== null;
  const targetMs = targetMin !== null ? targetMin * 60_000 : null;
  const goalReached = targetMs !== null && elapsedMs >= targetMs;

  // Gentle celebration the moment the target is crossed — once. `celebrated`
  // is persisted so a refresh after the party doesn't throw a second party.
  useEffect(() => {
    if (!loaded || celebrated || targetMs === null) return;
    if (elapsedMs >= targetMs) {
      setCelebrated(true);
      setShowConfetti(true);
      const t = window.setTimeout(() => setShowConfetti(false), 6000);
      return () => window.clearTimeout(t);
    }
  }, [loaded, celebrated, targetMs, elapsedMs]);

  const start = () => {
    if (startedAt !== null) return;
    setStartedAt(Date.now());
  };

  const pause = () => {
    if (startedAt === null) return;
    setBaseMs(baseMs + Math.max(0, Date.now() - startedAt));
    setStartedAt(null);
  };

  const reset = () => {
    // Guard a fat-fingered reset once real practice time is on the clock.
    if (elapsedMs > 60_000 && !confirm('Reset the timer back to 00:00?')) return;
    setBaseMs(0);
    setStartedAt(null);
    setCelebrated(false);
    setShowConfetti(false);
  };

  const pickTarget = (min: number | null) => {
    setTargetMin(min);
    // New/changed goal not yet reached → allow a fresh celebration.
    if (min === null || elapsedMs < min * 60_000) setCelebrated(false);
  };

  const progressPct = targetMs !== null ? Math.min(100, (elapsedMs / targetMs) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow p-5">
      {showConfetti && (
        <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} />
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-3xl">⏱️</span>
        <div>
          <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Practice timer</div>
          <div className="text-sm text-gray-500">Start it, play, and watch your minutes add up.</div>
        </div>
      </div>

      {/* Big readable digits */}
      <div
        className={`text-center font-black tabular-nums leading-none py-4 rounded-2xl mb-4 transition-colors ${
          goalReached ? 'bg-green-50 text-green-700' : running ? 'bg-indigo-50 text-indigo-900' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <span className="text-6xl md:text-7xl">{formatElapsed(elapsedMs)}</span>
        {running && <span className="block mt-2 text-xs font-bold text-indigo-500 uppercase tracking-wide">practicing…</span>}
      </div>

      {/* Goal banner + progress */}
      {targetMin !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="text-indigo-700">🎯 Goal: {targetMin} minutes</span>
            <span className={goalReached ? 'text-green-700' : 'text-gray-400'}>
              {goalReached ? 'You did it! 🎉' : `${Math.max(0, Math.ceil((targetMs! - elapsedMs) / 60_000))} min to go`}
            </span>
          </div>
          <div className="w-full bg-indigo-50 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${goalReached ? 'bg-green-400' : 'bg-indigo-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {goalReached && (
            <p className="mt-2 text-center text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl py-2">
              🌟 {targetMin} minutes of practice — amazing! Keep going or take a bow.
            </p>
          )}
        </div>
      )}

      {/* Big touch-friendly controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {!running ? (
          <button
            onClick={start}
            className="col-span-1 bg-indigo-700 hover:bg-indigo-800 text-white font-black text-xl py-4 rounded-2xl transition-colors"
          >
            ▶ {elapsedMs > 0 ? 'Keep going' : 'Start'}
          </button>
        ) : (
          <button
            onClick={pause}
            className="col-span-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-xl py-4 rounded-2xl transition-colors"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={reset}
          disabled={elapsedMs === 0 && !running}
          className="col-span-1 bg-white border-2 border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 text-indigo-800 font-black text-xl py-4 rounded-2xl transition-colors"
        >
          ↺ Reset
        </button>
      </div>

      {/* Optional target picker */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Goal:</span>
        {TARGET_PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => pickTarget(m)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              targetMin === m ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {m} min
          </button>
        ))}
        <button
          onClick={() => pickTarget(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            targetMin === null ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          No goal
        </button>
      </div>

      <p className="mt-3 text-[11px] text-gray-400 text-center">
        The timer keeps counting even if the page reloads. Logging your practice for MP still happens on your song cards below.
      </p>
    </div>
  );
}
