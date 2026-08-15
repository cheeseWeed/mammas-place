// Reference-tone playback for the Note Reader.
//
// Synthesized with Web Audio — no audio files to ship, and any of the 88 notes
// can be sounded on demand. Used two ways:
//
//   1. "Hear it" — the kid taps a note on the staff and hears the pitch WITHOUT
//      the game advancing, so they can match it on their instrument. This is
//      how a teacher actually works with a student: play the note, let them
//      find it, no penalty for taking a few tries.
//   2. Play-along in practice mode, where nothing is being scored.
//
// Deliberately NOT available in tempo/hard mode: a reference tone there would
// let a kid play by ear instead of reading, which defeats the whole exercise.
//
// The waveform is a triangle with a soft attack/decay envelope — closer to a
// bowed or struck string than a raw sine, and much easier to match by ear than
// a hard square edge.

import { midiToFrequency } from './pitch';

let ctx: AudioContext | null = null;

/**
 * The shared AudioContext, created lazily.
 *
 * Browsers refuse to start audio without a user gesture, so this is only ever
 * called from a click/tap handler. Returns null when Web Audio is unavailable
 * (very old browser, or a locked-down device) so callers can degrade quietly
 * instead of throwing at a kid mid-lesson.
 */
function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export interface PlayNoteOptions {
  /** Seconds. Default 0.9 — long enough to match, short enough not to drag. */
  duration?: number;
  /** 0..1. Default 0.22, deliberately gentle: kids often wear headphones. */
  volume?: number;
}

/**
 * Sound a single MIDI note.
 *
 * Returns false if audio could not start, so the UI can show "sound isn't
 * available" rather than silently doing nothing.
 */
export function playNote(midi: number, opts: PlayNoteOptions = {}): boolean {
  const ac = audioContext();
  if (!ac) return false;

  const duration = opts.duration ?? 0.9;
  const volume = opts.volume ?? 0.22;
  const now = ac.currentTime;

  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.value = midiToFrequency(midi);

    // Soft attack so it does not click, gentle exponential release so it rings
    // out like a real instrument rather than cutting off dead.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    return true;
  } catch {
    return false;
  }
}

/**
 * Play a short run of notes back to back — used to preview a phrase.
 *
 * `beatMs` is how long one beat lasts, so note durations follow the song's
 * own rhythm rather than every note being the same length.
 */
export function playPhrase(
  notes: { midi: number; beats: number }[],
  beatMs: number,
  opts: PlayNoteOptions = {},
): boolean {
  const ac = audioContext();
  if (!ac) return false;
  let t = ac.currentTime;
  const volume = opts.volume ?? 0.22;

  try {
    for (const n of notes) {
      const dur = Math.max(0.12, (n.beats * beatMs) / 1000);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToFrequency(n.midi);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      // stop a hair short of the next note so repeated pitches are distinct
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
    return true;
  } catch {
    return false;
  }
}

/* ============================================================
   PLAY-ALONG
   ============================================================ */

export interface PlayAlongHandle {
  /** Stop immediately and silence anything still ringing. */
  stop: () => void;
}

export interface PlayAlongOptions extends PlayNoteOptions {
  /** Beats per minute to play at — this is the speed dial. */
  bpm: number;
  /** Count-in clicks before the melody starts. Default 4 (one bar of 4/4). */
  countIn?: number;
  /** Fires as each note begins, so the staff can follow along. */
  onNote?: (index: number) => void;
  /** Fires once the last note has finished. */
  onDone?: () => void;
}

/**
 * Play a whole melody so the kid can play ALONG with it.
 *
 * Unlike playPhrase this is stoppable and reports progress, which is what a
 * play-along needs: the tempo is the kid's dial, they need to be able to bail
 * out mid-song, and the staff has to follow the sound.
 *
 * A count-in matters more than it looks — starting cold gives a beginner no
 * chance to find the pulse, and the first note gets missed every time.
 */
export function playAlong(
  notes: { midi: number; beats: number }[],
  opts: PlayAlongOptions,
): PlayAlongHandle | null {
  const ac = audioContext();
  if (!ac) return null;

  const beatMs = 60000 / Math.max(20, opts.bpm);
  const volume = opts.volume ?? 0.22;
  const countIn = opts.countIn ?? 4;
  const oscs: OscillatorNode[] = [];
  const timers: number[] = [];
  let stopped = false;

  let t = ac.currentTime + 0.12; // small lead-in so the first click is not clipped

  // Count-in: a short wood-block-ish click, deliberately not a pitch from the
  // melody so it cannot be mistaken for a note to play.
  for (let i = 0; i < countIn; i++) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = i === 0 ? 1200 : 900;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * 0.5, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.1);
    oscs.push(osc);
    t += beatMs / 1000;
  }

  const startAt = t;
  notes.forEach((n, i) => {
    const dur = (n.beats * beatMs) / 1000;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToFrequency(n.midi);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
    oscs.push(osc);

    if (opts.onNote) {
      const delayMs = (t - ac.currentTime) * 1000;
      timers.push(window.setTimeout(() => { if (!stopped) opts.onNote?.(i); }, Math.max(0, delayMs)));
    }
    t += dur;
  });

  if (opts.onDone) {
    const endMs = (t - ac.currentTime) * 1000;
    timers.push(window.setTimeout(() => { if (!stopped) opts.onDone?.(); }, Math.max(0, endMs)));
  }

  void startAt;

  return {
    stop() {
      stopped = true;
      timers.forEach(id => window.clearTimeout(id));
      oscs.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
    },
  };
}

/** Release the shared context — call on unmount so the tab does not hold audio open. */
export function closeTone(): void {
  if (ctx) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
}
