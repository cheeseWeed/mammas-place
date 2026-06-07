// Audio for the Letters & Sounds section. ONE shared channel: any new sound
// stops whatever was already playing (both recorded mp3 audio AND browser TTS),
// so kids can't trigger five overlapping voices by tapping fast.

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  return voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
}

// Single reusable <audio> element for recorded clips. Reusing one element (vs
// new Audio() each tap) means starting a new clip auto-stops the prior one.
let sharedAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

// Stop EVERYTHING currently making sound — call before any new sound.
export function stopAllAudio() {
  if (typeof window === 'undefined') return;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  try {
    if (sharedAudio) { sharedAudio.pause(); sharedAudio.currentTime = 0; }
  } catch { /* ignore */ }
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    stopAllAudio(); // stop any clip OR prior speech first
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts?.rate ?? 0.85;
    u.pitch = opts?.pitch ?? 1.15;
    u.volume = 1;
    const v = pickVoice(synth);
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    // ignore — speech just won't play
  }
}

// Play a letter's recorded clip (/letters-audio/<letter>.mp3); fall back to TTS
// (entry.spoken) if missing/blocked. Always stops any prior sound first.
export function playLetter(entry: { letter: string; spoken: string }) {
  if (typeof window === 'undefined') return;
  const audio = getAudio();
  if (!audio) { speak(entry.spoken); return; }
  stopAllAudio();
  const src = `/letters-audio/${entry.letter.toLowerCase()}.mp3`;
  let fellBack = false;
  const fallback = () => { if (!fellBack) { fellBack = true; speak(entry.spoken); } };
  try {
    audio.onerror = fallback;
    audio.src = src;
    audio.play().catch(fallback);
  } catch {
    fallback();
  }
}

// Say a word slowly, then again at normal speed — for "sound it out then blend".
// Stops anything playing first; queues the two utterances on the shared synth.
export function speakWord(word: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    stopAllAudio();
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
