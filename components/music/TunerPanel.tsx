'use client';

// Tuner for the music Practice Studio.
//
// Web Audio API only — no external pitch libraries. The mic feeds an
// AnalyserNode; every ~90 ms we pull a time-domain buffer and run the pure
// autocorrelation detector in lib/music/pitch.ts (unit-tested there), then
// show the detected note and a cents-off needle.
//
// Modes:
//   - Cello string presets (C2 G2 D3 A3) — the needle measures against that
//     one string, with kid-friendly higher/lower guidance.
//   - Auto (chromatic) — the needle measures against whatever note is nearest.
//
// The mic is only requested when the kid presses the big Start button (never
// on page load), and permission-denied gets a friendly, kid-readable message.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CELLO_STRINGS, centsOff, detectPitch, frequencyToNote } from '@/lib/music/pitch';

type TunerStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'no-mic' | 'error';

// 'auto' = chromatic; otherwise the index into CELLO_STRINGS.
type TunerMode = 'auto' | number;

interface Reading {
  freq: number;      // detected fundamental, Hz
  noteName: string;  // nearest note, e.g. 'A'
  octave: number;
  cents: number;     // cents off the CURRENT target (nearest note or the preset string)
  wayOff: boolean;   // string mode only: more than ±50¢ from the target string
}

const POLL_MS = 90;        // detection cadence — smooth but battery-friendly
const HOLD_MS = 900;       // keep showing the last note this long after sound stops
const IN_TUNE_CENTS = 5;   // |cents| at or under this = green "in tune"

export default function TunerPanel() {
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [mode, setMode] = useState<TunerMode>('auto');
  const [reading, setReading] = useState<Reading | null>(null);

  // Live audio plumbing lives in refs — none of it should re-render React.
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastHeardRef = useRef(0);
  const recentFreqsRef = useRef<number[]>([]);
  // Mode lives in a ref too so the running poll loop sees changes instantly.
  const modeRef = useRef<TunerMode>('auto');
  modeRef.current = mode;

  const stop = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    recentFreqsRef.current = [];
    setReading(null);
    setStatus('idle');
  }, []);

  // Release the mic when the kid navigates away.
  useEffect(() => stop, [stop]);

  const poll = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    const buf = bufRef.current;
    if (!analyser || !ctx || !buf) return;

    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);

    if (freq > 0) {
      // Median of the last 3 readings — steadies the needle without lag.
      const recents = recentFreqsRef.current;
      recents.push(freq);
      if (recents.length > 3) recents.shift();
      const sorted = [...recents].sort((a, b) => a - b);
      const smooth = sorted[Math.floor(sorted.length / 2)];

      const note = frequencyToNote(smooth);
      if (!note) return;
      lastHeardRef.current = Date.now();

      const m = modeRef.current;
      if (m === 'auto') {
        setReading({ freq: smooth, noteName: note.name, octave: note.octave, cents: note.cents, wayOff: false });
      } else {
        const target = CELLO_STRINGS[m];
        const cents = centsOff(smooth, target.freq);
        setReading({
          freq: smooth,
          noteName: note.name,
          octave: note.octave,
          cents,
          wayOff: Math.abs(cents) > 50,
        });
      }
    } else if (Date.now() - lastHeardRef.current > HOLD_MS) {
      recentFreqsRef.current = [];
      setReading(null);
    }
  }, []);

  const start = useCallback(async () => {
    setStatus('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        return;
      }
      // Turn OFF the voice-call processing — it eats sustained instrument
      // tones and shifts levels, which wrecks pitch detection.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096; // ~93 ms at 44.1 kHz — enough periods for low cello C2
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      lastHeardRef.current = 0;
      setStatus('listening');
      pollRef.current = window.setInterval(poll, POLL_MS);
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') setStatus('no-mic');
      else setStatus('error');
    }
  }, [poll]);

  const listening = status === 'listening';
  const targetString = mode !== 'auto' ? CELLO_STRINGS[mode] : null;

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-3xl">🎯</span>
        <div>
          <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Tuner</div>
          <div className="text-sm text-gray-500">Pluck a string and watch the needle find the note.</div>
        </div>
      </div>

      {/* Mode picker: cello strings + chromatic auto */}
      <div className="flex items-center gap-2 flex-wrap justify-center mb-4">
        {CELLO_STRINGS.map((s, i) => (
          <button
            key={s.note}
            onClick={() => setMode(i)}
            className={`min-w-14 px-3 py-2.5 rounded-xl text-center transition-colors ${
              mode === i ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            <span className="block text-lg font-black leading-none">{s.label}</span>
            <span className={`block text-[10px] font-semibold ${mode === i ? 'text-indigo-200' : 'text-gray-400'}`}>{s.note}</span>
          </button>
        ))}
        <button
          onClick={() => setMode('auto')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            mode === 'auto' ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          🎼 Auto
        </button>
      </div>

      {/* Status / errors — kid-readable */}
      {status === 'denied' && (
        <FriendlyNote emoji="🎤">
          We need the microphone to hear your cello, but the browser said no.
          Ask a parent to tap the little lock 🔒 next to the website address, turn the
          microphone <span className="font-bold">On</span>, then try again.
        </FriendlyNote>
      )}
      {status === 'no-mic' && (
        <FriendlyNote emoji="🔍">
          We couldn&apos;t find a microphone on this device (or another app is using it).
          Plug one in or close the other app, then try again.
        </FriendlyNote>
      )}
      {status === 'error' && (
        <FriendlyNote emoji="😕">
          Something went wrong turning the microphone on. Try again — and if it keeps
          happening, tell Dad with the feedback bubble.
        </FriendlyNote>
      )}

      {!listening ? (
        <button
          onClick={start}
          disabled={status === 'starting'}
          className="w-full bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-300 text-white font-black text-xl py-4 rounded-2xl transition-colors"
        >
          {status === 'starting' ? 'Turning on the mic…' : '🎙️ Start tuning'}
        </button>
      ) : (
        <>
          <NoteDisplay reading={reading} targetNote={targetString?.note ?? null} />
          <Needle cents={reading?.cents ?? null} wayOff={reading?.wayOff ?? false} />
          <Guidance reading={reading} targetNote={targetString?.note ?? null} />
          <button
            onClick={stop}
            className="mt-4 w-full bg-white border-2 border-indigo-200 hover:bg-indigo-50 text-indigo-800 font-bold py-2.5 rounded-xl transition-colors text-sm"
          >
            ⏹ Stop the tuner
          </button>
        </>
      )}
    </div>
  );
}

function FriendlyNote({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
      <span className="text-2xl mr-2 align-middle">{emoji}</span>
      {children}
    </div>
  );
}

function NoteDisplay({ reading, targetNote }: { reading: Reading | null; targetNote: string | null }) {
  const inTune = reading !== null && !reading.wayOff && Math.abs(reading.cents) <= IN_TUNE_CENTS;
  return (
    <div
      className={`text-center rounded-2xl py-4 mb-3 transition-colors ${
        inTune ? 'bg-green-50' : reading ? 'bg-indigo-50' : 'bg-gray-50'
      }`}
    >
      {reading ? (
        <>
          <div className={`font-black leading-none ${inTune ? 'text-green-600' : 'text-indigo-900'}`}>
            <span className="text-7xl">{reading.noteName}</span>
            <span className="text-3xl align-baseline ml-1">{reading.octave}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400 font-semibold tabular-nums">
            {reading.freq.toFixed(1)} Hz{targetNote ? ` · aiming for ${targetNote}` : ''}
          </div>
          {inTune && <div className="mt-1 text-sm font-black text-green-600">In tune! ✨</div>}
        </>
      ) : (
        <div className="py-4 text-indigo-400 font-bold animate-pulse">
          🎧 Listening… pluck a string!
        </div>
      )}
    </div>
  );
}

function Needle({ cents, wayOff }: { cents: number | null; wayOff: boolean }) {
  // Map -50..+50 cents onto 0..100% of the track. Way-off readings pin to an edge.
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const leftPct = 50 + clamped;
  const inTune = cents !== null && !wayOff && Math.abs(cents) <= IN_TUNE_CENTS;

  return (
    <div className="px-1">
      <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
        <span>♭ too low</span>
        <span className={inTune ? 'text-green-600' : ''}>just right</span>
        <span>too high ♯</span>
      </div>
      {/* colored zones: rose | amber | green | amber | rose (−50…−15…−5…+5…+15…+50) */}
      <div className="relative h-6 rounded-full overflow-hidden flex">
        <div className="h-full bg-rose-100" style={{ width: '35%' }} />
        <div className="h-full bg-amber-100" style={{ width: '10%' }} />
        <div className="h-full bg-green-200" style={{ width: '10%' }} />
        <div className="h-full bg-amber-100" style={{ width: '10%' }} />
        <div className="h-full bg-rose-100" style={{ width: '35%' }} />
        {/* center tick */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-green-500/60 -translate-x-1/2" />
        {/* the needle */}
        {cents !== null && (
          <div
            className={`absolute top-0 h-full w-1.5 rounded-full -translate-x-1/2 transition-[left] duration-100 ${
              inTune ? 'bg-green-600' : 'bg-indigo-700'
            }`}
            style={{ left: `${leftPct}%` }}
          />
        )}
      </div>
      <div className="text-center mt-1 text-xs font-bold tabular-nums text-gray-500 h-4">
        {cents !== null && !wayOff ? `${cents > 0 ? '+' : ''}${Math.round(cents)}¢` : ''}
      </div>
    </div>
  );
}

function Guidance({ reading, targetNote }: { reading: Reading | null; targetNote: string | null }) {
  if (!reading) return null;
  if (reading.wayOff && targetNote) {
    return (
      <p className="text-center text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl py-2 px-3">
        That sounds like {reading.noteName}{reading.octave} — we&apos;re aiming for {targetNote}. Big turns, gently!
      </p>
    );
  }
  if (Math.abs(reading.cents) <= IN_TUNE_CENTS) return null;
  return (
    <p className="text-center text-sm font-semibold text-indigo-700">
      {reading.cents < 0 ? '⬆️ A tiny bit higher' : '⬇️ A tiny bit lower'}
    </p>
  );
}
