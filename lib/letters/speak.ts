// Tiny wrapper around the browser Web Speech API for the Letters & Sounds
// section. Says the letter sound + word out loud. No audio files needed; uses
// the device's built-in voice. Safe no-op if speech isn't available.

export function speak(text: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel(); // stop anything already talking so taps feel snappy
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;   // a touch slower for little ears
    u.pitch = 1.15;  // friendly, slightly higher
    u.volume = 1;
    // Prefer an English voice if the device offers one.
    const voices = synth.getVoices();
    const en = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (en) u.voice = en;
    synth.speak(u);
  } catch {
    // ignore — speech just won't play
  }
}
