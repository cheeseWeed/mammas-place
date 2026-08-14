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

/** Release the shared context — call on unmount so the tab does not hold audio open. */
export function closeTone(): void {
  if (ctx) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
}
