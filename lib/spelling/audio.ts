'use client';

/**
 * Kid-friendly TTS wrapper around the browser SpeechSynthesis API.
 *
 * All functions are SSR-safe: they no-op (or return null/false) when
 * `window` / `speechSynthesis` is unavailable.
 */

const DEFAULT_RATE = 0.9;
const DEFAULT_VOLUME = 1.0;
const DEFAULT_LANG = 'en-US';
const LETTER_PAUSE_MS = 300;
const CONTEXT_PAUSE_MS = 600;

// ---------- environment guards ----------

export function isAudioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

// ---------- voice loading ----------

/**
 * Chrome (and some other engines) load voices asynchronously. The first call to
 * `getVoices()` often returns []; voices are populated later and a
 * `voiceschanged` event fires. We cache the loaded list once it's non-empty.
 */
let cachedVoices: SpeechSynthesisVoice[] | null = null;

function loadVoicesNow(): SpeechSynthesisVoice[] {
  if (!isAudioSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices ?? voices;
}

function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!isAudioSupported()) return Promise.resolve([]);
  const immediate = loadVoicesNow();
  if (immediate.length > 0) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (list: SpeechSynthesisVoice[]) => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
      resolve(list);
    };
    const onChanged = () => finish(loadVoicesNow());
    window.speechSynthesis.addEventListener('voiceschanged', onChanged);
    // Fallback timer in case the event never fires.
    window.setTimeout(() => finish(loadVoicesNow()), timeoutMs);
  });
}

// Kick off voice loading as soon as the module is imported in the browser, so
// the cache is warm by the first `speakWord` call.
if (isAudioSupported()) {
  void waitForVoices();
}

// ---------- voice selection ----------

const FEMALE_NAME_HINTS = [
  'female',
  'samantha',
  'victoria',
  'karen',
  'tessa',
  'moira',
  'fiona',
  'susan',
  'allison',
  'ava',
  'serena',
  'kathy',
  'zira',
  'aria',
  'jenny',
  'michelle',
  'sara',
  'sarah',
  'emma',
  'amy',
  'joanna',
  'salli',
  'kimberly',
];

function isLikelyFemale(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  return FEMALE_NAME_HINTS.some((hint) => name.includes(hint));
}

function isEnUS(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase() === 'en-us';
}

function isAnyEnglish(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith('en');
}

/**
 * Pick the best available English voice for a young child.
 * Preference order:
 *   1. Female, en-US
 *   2. Any en-US
 *   3. Female, any English locale
 *   4. Any English locale
 *   5. null
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isAudioSupported()) return null;
  const voices = loadVoicesNow();
  if (voices.length === 0) return null;

  const femaleEnUs = voices.find((v) => isEnUS(v) && isLikelyFemale(v));
  if (femaleEnUs) return femaleEnUs;

  const anyEnUs = voices.find(isEnUS);
  if (anyEnUs) return anyEnUs;

  const femaleEn = voices.find((v) => isAnyEnglish(v) && isLikelyFemale(v));
  if (femaleEn) return femaleEn;

  const anyEn = voices.find(isAnyEnglish);
  if (anyEn) return anyEn;

  return voices[0] ?? null;
}

// ---------- speech primitives ----------

type SpeakOpts = {
  rate?: number;
  volume?: number;
};

function buildUtterance(text: string, opts: SpeakOpts = {}): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? DEFAULT_RATE;
  u.volume = opts.volume ?? DEFAULT_VOLUME;
  u.lang = DEFAULT_LANG;
  const voice = getPreferredVoice();
  if (voice) u.voice = voice;
  return u;
}

function speakUtterance(u: SpeechSynthesisUtterance): Promise<void> {
  if (!isAudioSupported()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    window.setTimeout(resolve, ms);
  });
}

// ---------- public speak helpers ----------

export function speakWord(word: string, opts?: { rate?: number; volume?: number }): void {
  if (!isAudioSupported()) return;
  // Cancel anything in flight so rapid taps don't queue up.
  window.speechSynthesis.cancel();
  const u = buildUtterance(word, opts);
  window.speechSynthesis.speak(u);
}

export async function speakWordWithContext(word: string, sentence: string): Promise<void> {
  if (!isAudioSupported()) return;
  window.speechSynthesis.cancel();
  await speakUtterance(buildUtterance(word));
  await delay(CONTEXT_PAUSE_MS);
  await speakUtterance(buildUtterance(sentence));
}

export async function spellOutWord(word: string): Promise<void> {
  if (!isAudioSupported()) return;
  window.speechSynthesis.cancel();
  const letters = word.split('');
  for (let i = 0; i < letters.length; i += 1) {
    const letter = letters[i];
    if (!letter || !letter.trim()) continue;
    await speakUtterance(buildUtterance(letter, { rate: 0.8 }));
    if (i < letters.length - 1) {
      await delay(LETTER_PAUSE_MS);
    }
  }
}

export function stopSpeaking(): void {
  if (!isAudioSupported()) return;
  window.speechSynthesis.cancel();
}
