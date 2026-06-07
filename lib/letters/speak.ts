// Tiny wrapper around the browser Web Speech API for the Letters & Sounds
// section. Says the letter sound + word out loud. No audio files needed; uses
// the device's built-in voice. Safe no-op if speech isn't available.

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  return voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel(); // stop anything already talking so taps feel snappy
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts?.rate ?? 0.85;   // a touch slower for little ears
    u.pitch = opts?.pitch ?? 1.15; // friendly, slightly higher
    u.volume = 1;
    const v = pickVoice(synth);
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    // ignore — speech just won't play
  }
}

// Play a letter's sound. Prefers a recorded clip at /letters-audio/<letter>.mp3
// (clean human phonics voice) and falls back to TTS (entry.spoken) if the file
// is missing or fails. This lets us drop in real audio without touching callers.
export function playLetter(entry: { letter: string; spoken: string }) {
  if (typeof window === 'undefined') return;
  const src = `/letters-audio/${entry.letter.toLowerCase()}.mp3`;
  try {
    const audio = new Audio(src);
    let fellBack = false;
    const fallback = () => { if (!fellBack) { fellBack = true; speak(entry.spoken); } };
    audio.addEventListener('error', fallback, { once: true });
    audio.play().catch(fallback);
  } catch {
    speak(entry.spoken);
  }
}

// Say a word slowly, then again at normal speed — good for "sound it out then
// blend" in the word builders. Pass the whole word, e.g. "cat".
export function speakWord(word: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    const v = pickVoice(synth);
    const slow = new SpeechSynthesisUtterance(word);
    slow.rate = 0.5; slow.pitch = 1.1; if (v) slow.voice = v;
    const fast = new SpeechSynthesisUtterance(word);
    fast.rate = 0.95; fast.pitch = 1.15; if (v) fast.voice = v;
    synth.speak(slow);
    synth.speak(fast);
  } catch {
    // ignore
  }
}
