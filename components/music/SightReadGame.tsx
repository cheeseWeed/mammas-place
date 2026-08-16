'use client';

// Note-reading game — the "Guitar Hero for sheet music" mode.
//
// The staff scrolls toward a hit line; the kid plays the notes on their real
// instrument and the mic scores them. All the game rules live in
// lib/music/sightread.ts (pure, unit-tested); this file is the canvas + the
// Web Audio wiring, which reuses the tuner's chain:
//   getUserMedia -> AudioContext -> AnalyserNode -> detectPitch -> frequencyToNote
//
// Mic settings mirror TunerPanel: echoCancellation / noiseSuppression /
// autoGainControl are all OFF, because that voice-call processing eats
// sustained instrument tones and wrecks pitch detection.

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch, frequencyToNote } from '@/lib/music/pitch';
import { closeTone, playAlong, playNote, playPhrase, type PlayAlongHandle } from '@/lib/music/tone';
import {
  SONGS,
  advanceGame,
  initGame,
  isSharp,
  ledgerLines,
  isStuck,
  scoreRun,
  skipStuckNote,
  staffPosition,
  type GameMode,
  type GameState,
  type Song,
} from '@/lib/music/sightread';

type Status = 'idle' | 'starting' | 'listening' | 'denied' | 'no-mic' | 'error';

// 40 ms: fast enough to feel responsive for rhythm, still ~2 analyser frames.
const POLL_MS = 40;

const STAFF_STEP = 9;      // px between a line and the next space
const NOTE_SPACING = 74;   // px between successive notes
const HIT_X = 150;         // where the hit line sits
const STAFF_TOP = 70;      // y of the top staff line

export default function SightReadGame() {
  const [songId, setSongId] = useState(SONGS[0].id);
  const [mode, setMode] = useState<GameMode>('wait');
  const [status, setStatus] = useState<Status>('idle');
  const [game, setGame] = useState<GameState | null>(null);
  const [heard, setHeard] = useState<{ midi: number; name: string; octave: number; cents: number } | null>(null);
  const [earned, setEarned] = useState<string | null>(null);
  // Fractional progress through the CURRENT note, 0..1. Drives the smooth
  // playhead so the beat is visible before it arrives, instead of the staff
  // jumping a whole note at a time.
  const [beatFrac, setBeatFrac] = useState(0);
  // Which note just landed, and how it went — drives the hit flash.
  const [flash, setFlash] = useState<{ index: number; hit: boolean; at: number } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  // Play-along: the song sounds out loud and the kid plays with it. The speed
  // dial is the whole point — a beginner needs to start well under the marked
  // tempo and work up, which is how a teacher actually runs this.
  const [alongPct, setAlongPct] = useState(100);
  const [alongIndex, setAlongIndex] = useState<number | null>(null);
  // Playing state must be STATE, not just the ref: a ref mutation does not
  // re-render, so the button never flipped to "Stop".
  const [alongPlaying, setAlongPlaying] = useState(false);
  const alongRef = useRef<PlayAlongHandle | null>(null);

  // Songs this kid uploaded that parsed cleanly (MusicXML / MIDI). They join
  // the built-in library so an upload that says "ready to play" actually is.
  const [uploaded, setUploaded] = useState<Song[]>([]);

  const loadUploaded = useCallback(async () => {
    try {
      const res = await fetch('/api/music/uploads');
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (!Array.isArray(body?.uploads)) return;
      const songs = body.uploads
        .filter((u: { song?: { notes?: unknown[] } }) => Array.isArray(u.song?.notes) && u.song!.notes!.length > 0)
        .map((u: { id: string; title: string; song: Song }) => ({ ...u.song, id: u.id, title: u.title }));
      setUploaded(songs);
    } catch { /* offline — the built-in songs still work */ }
  }, []);

  useEffect(() => { void loadUploaded(); }, [loadUploaded]);

  // A song uploaded a second ago should be playable a second ago. The upload
  // form fires this the moment a file parses, so the picker refreshes without
  // a page reload.
  useEffect(() => {
    const h = () => { void loadUploaded(); };
    window.addEventListener('music:uploads-changed', h);
    return () => window.removeEventListener('music:uploads-changed', h);
  }, [loadUploaded]);

  const allSongs: Song[] = [...SONGS, ...uploaded];
  const song: Song = allSongs.find(s => s.id === songId) ?? SONGS[0];

  // Starred songs, like Azure Pipelines favourites: star the ones you are
  // working on, they float to the top, click again to unstar. Everything else
  // stays alphabetical so a song is always findable in the same place.
  const STAR_KEY = 'dl_sightread_starred';
  const [starred, setStarred] = useState<string[]>([]);
  const [songFilter, setSongFilter] = useState('');

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STAR_KEY) || '[]');
      if (Array.isArray(raw)) setStarred(raw.filter(x => typeof x === 'string'));
    } catch { /* storage unavailable — stars just do not persist */ }
  }, []);

  const toggleStar = useCallback((id: string) => {
    setStarred(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(STAR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const [sortBy, setSortBy] = useState<'title' | 'easiest' | 'hardest'>('title');

  // Look through the whole piece BEFORE playing it. Sight-reading pedagogy is
  // unanimous that you read a piece through before you play it, and the game
  // only ever showed the few notes around the cursor. Browsing shifts which
  // note sits on the hit line; starting a run resets it.
  const [browseAt, setBrowseAt] = useState(0);

  const visibleSongs = (() => {
    const q = songFilter.trim().toLowerCase();
    const matches = q
      ? allSongs.filter(s => s.title.toLowerCase().includes(q) || s.level.toLowerCase().includes(q))
      : allSongs.slice();

    const rank: Record<Song['level'], number> = { starter: 0, easy: 1, medium: 2 };
    const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title);
    const cmp = (a: Song, b: Song) => {
      if (sortBy === 'easiest') return (rank[a.level] - rank[b.level]) || byTitle(a, b);
      if (sortBy === 'hardest') return (rank[b.level] - rank[a.level]) || byTitle(a, b);
      return byTitle(a, b);
    };

    // Starred ALWAYS float to the top, whichever sort is chosen — they are the
    // songs being worked on right now, and they should never move.
    return [
      ...matches.filter(s => starred.includes(s.id)).sort(cmp),
      ...matches.filter(s => !starred.includes(s.id)).sort(cmp),
    ];
  })();

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const pollRef = useRef<number | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const lastTickRef = useRef<number>(0);
  const submittedRef = useRef(false);
  // The pitch that just credited a note. A repeated note must not credit twice
  // off one sustained sound — see the note in poll().
  const lastCreditedMidiRef = useRef<number | null>(null);

  useEffect(() => { gameRef.current = game; }, [game]);

  const stop = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    setStatus('idle');
    setHeard(null);
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => closeTone, []);

  // The hit flash is a moment, not a state — clear it so the next note gets
  // its own flash rather than inheriting the last one.
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 280);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Post the finished run through the same earn path every section uses. The
  // SERVER decides the reward — the client never says how much MP to pay.
  const submitRun = useCallback(async (finished: GameState) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const s = scoreRun(finished.results);
    if (s.total === 0) return;
    try {
      const res = await fetch('/api/music/sightread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: finished.songId,
          mode: finished.mode,
          hits: s.hits,
          total: s.total,
        }),
      });
      if (res.status === 401 || res.status === 404) {
        setEarned('Log in on the Music page to keep the MP you earn here.');
        return;
      }
      const data = await res.json().catch(() => null);
      if (data && typeof data.earnedCents === 'number' && data.earnedCents > 0) {
        setEarned(`+${(data.earnedCents / 100).toFixed(2)} MP earned!`);
      } else if (data?.reason === 'duplicate') {
        setEarned('Already earned for this run today.');
      } else if (data?.reason === 'sabbath') {
        setEarned('The shop and most learning rest on Sunday — play for fun today.');
      }
    } catch {
      /* offline — the run still counted on screen */
    }
  }, []);

  const poll = useCallback(() => {
    const analyser = analyserRef.current, buf = bufRef.current, ctx = ctxRef.current;
    if (!analyser || !buf || !ctx) return;
    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);
    const info = freq > 0 ? frequencyToNote(freq) : null;
    setHeard(info ? { midi: info.midi, name: info.name, octave: info.octave, cents: info.cents } : null);

    const now = performance.now();
    const dtMs = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;

    const cur = gameRef.current;
    if (!cur || cur.done) return;

    // REPEATED NOTES need a fresh attack.
    //
    // Reported by Shepherd: "if there is two notes in a row it just counts it
    // as one". A held or re-bowed note reads as one continuous pitch to the
    // detector, so the second note fired instantly off the first note's sound
    // instead of waiting to actually be played.
    //
    // The fix: once a note is credited, the SAME pitch cannot credit the next
    // note until the mic has either heard silence or heard something else —
    // i.e. until there is a real new attack. A different pitch is unaffected,
    // so ordinary melodies feel identical.
    const nextTarget = song.notes[cur.cursor];
    const sameAsJustPlayed =
      lastCreditedMidiRef.current !== null &&
      info !== null &&
      info.midi === lastCreditedMidiRef.current &&
      nextTarget?.midi === lastCreditedMidiRef.current;

    if (info === null || (info.midi !== lastCreditedMidiRef.current)) {
      // silence, or a different pitch — the note has genuinely been released
      lastCreditedMidiRef.current = null;
    setBrowseAt(0);
    }

    const beatsPerMs = song.bpm / 60 / 1000;
    const next = advanceGame(cur, song, {
      // Withhold the pitch only while it is the SAME note still ringing.
      heardMidi: sameAsJustPlayed ? null : (info ? info.midi : null),
      cents: info ? info.cents : 0,
      deltaBeats: cur.mode === 'tempo' ? dtMs * beatsPerMs : 0,
    });

    // Smooth playhead: how far through the current note are we? In tempo mode
    // this rides the clock; in wait mode it tracks whether the right pitch is
    // currently sounding, so the line creeps forward as the kid holds the note.
    const noteNow = song.notes[next.cursor];
    if (noteNow) {
      if (next.mode === 'tempo') {
        setBeatFrac(Math.min(1, next.beat / noteNow.beats));
      } else {
        setBeatFrac(info && info.midi === noteNow.midi ? 1 : 0);
      }
    }

    if (next !== cur) {
      // A note resolved — flash it green or red at the hit line.
      const justScored = next.results.length > cur.results.length
        ? next.results[next.results.length - 1]
        : null;
      if (justScored) {
        setFlash({ index: justScored.index, hit: justScored.hit, at: performance.now() });
        // Remember what sound credited this note, so the NEXT note cannot be
        // credited by the same ringing pitch without a fresh attack.
        if (justScored.hit && info) lastCreditedMidiRef.current = info.midi;
      }
      gameRef.current = next;
      setGame(next);
      if (next.done && next.mode !== 'practice') void submitRun(next);
    }
  }, [song, submitRun]);

  // Tap a note to HEAR it, without the game moving on. This is how a teacher
  // actually works with a student: sound the pitch, let them find it on their
  // instrument, no penalty for taking a few tries. Deliberately unavailable in
  // tempo mode — a reference tone there would let a kid play by ear instead of
  // reading, which is the whole skill being taught.
  const stopAlong = useCallback(() => {
    alongRef.current?.stop();
    alongRef.current = null;
    setAlongIndex(null);
    setAlongPlaying(false);
  }, []);

  const startAlong = useCallback(() => {
    alongRef.current?.stop();
    alongRef.current = null;
    const bpm = Math.round((song.bpm * alongPct) / 100);
    const h = playAlong(song.notes, {
      bpm,
      onNote: i => setAlongIndex(i),
      onDone: () => { alongRef.current = null; setAlongIndex(null); setAlongPlaying(false); },
    });
    alongRef.current = h;
    setAlongPlaying(!!h);
    if (!h) setAlongIndex(null);
  }, [song, alongPct]);

  useEffect(() => stopAlong, [stopAlong]);
  // Changing song or speed mid-playback would desync the highlight from the
  // audio, so stop rather than let them drift apart.
  useEffect(() => { stopAlong(); }, [songId, alongPct, stopAlong]);
  useEffect(() => { setBrowseAt(0); }, [songId]);

  const canHearNotes = mode !== 'tempo';
  const hearNote = useCallback((midi: number) => {
    if (!canHearNotes || !soundOn) return;
    playNote(midi);
  }, [canHearNotes, soundOn]);

  const start = useCallback(async () => {
    setStatus('starting');
    setEarned(null);
    submittedRef.current = false;
    const fresh = initGame(song, mode);
    gameRef.current = fresh;
    setGame(fresh);
    lastTickRef.current = 0;
    lastCreditedMidiRef.current = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('error'); return; }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      // latencyHint 'interactive' asks the browser for the smallest safe buffer.
      // Combined with the three constraints above this is worth ~48 ms in
      // Chrome — by far the biggest single latency win available, and it costs
      // nothing. (Chrome's MediaTrackSettings.latency always reports 0.01
      // regardless of reality, so this cannot be measured at runtime.)
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      ctxRef.current = ctx;
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      // 2048 = ~46 ms at 44.1 kHz and resolves down to ~43 Hz, which covers
      // cello C2 (65.4 Hz) with margin. 4096 doubles the latency and buys
      // nothing in this register — a note needs about two periods to detect,
      // and two periods of C2 is only 30 ms.
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      setStatus('listening');
      pollRef.current = window.setInterval(poll, POLL_MS);
    } catch (e) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') setStatus('no-mic');
      else setStatus('error');
    }
  }, [song, mode, poll]);

  const cursor = game?.cursor ?? 0;
  const listening = status === 'listening';
  const result = game?.done ? scoreRun(game.results) : null;

  // Best score per song, kept on this device. Deliberately local: it is a
  // personal record to beat, not something to rank kids against each other.
  const [bestPoints, setBestPoints] = useState<number | null>(null);
  const BEST_KEY = 'dl_kyc_sightread_best';

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
      setBestPoints(typeof all[songId] === 'number' ? all[songId] : null);
    } catch { setBestPoints(null); }
  }, [songId]);

  // Record a new personal best when a finished run beats the stored one.
  useEffect(() => {
    if (!result || !game?.done || game.mode === 'practice') return;
    try {
      const all = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
      const prev = typeof all[game.songId] === 'number' ? all[game.songId] : -1;
      if (result.points > prev) {
        all[game.songId] = result.points;
        localStorage.setItem(BEST_KEY, JSON.stringify(all));
        setBestPoints(prev >= 0 ? prev : null);
      }
    } catch { /* storage unavailable — the run still showed on screen */ }
  }, [result, game?.done, game?.songId, game?.mode]);

  // y of a staff position: 0 = bottom line, 8 = top line
  const yFor = (pos: number) => STAFF_TOP + (8 - pos) * STAFF_STEP;

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold text-purple-900">Note Reader</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Play the notes on your instrument — the microphone listens and keeps score.
      </p>

      {/* --- find a song: search + sort. Starred songs pin to the top of the
              list whichever sort is chosen, because those are the ones being
              worked on right now and they should never move. --- */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block font-semibold text-purple-900">Find a song</span>
          <input
            type="search"
            value={songFilter}
            onChange={e => setSongFilter(e.target.value)}
            placeholder="type to filter…"
            disabled={listening}
            className="mt-1 w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50"
          />
        </label>
        <label className="text-sm">
          <span className="block font-semibold text-purple-900">Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'title' | 'easiest' | 'hardest')}
            disabled={listening}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50"
          >
            <option value="title">A–Z</option>
            <option value="easiest">Easiest first</option>
            <option value="hardest">Hardest first</option>
          </select>
        </label>
        <button
          onClick={() => toggleStar(songId)}
          disabled={listening}
          aria-pressed={starred.includes(songId)}
          title={starred.includes(songId) ? 'Remove star' : 'Star this song so it stays at the top'}
          className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
            starred.includes(songId)
              ? 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-zinc-300 text-zinc-500'
          }`}
        >
          {starred.includes(songId) ? '★ Starred' : '☆ Star'}
        </button>
      </div>

      {/* --- setup --- */}
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="block font-semibold text-purple-900">Song</span>
          <select
            value={songId}
            onChange={e => { stop(); setGame(null); setSongId(e.target.value); }}
            disabled={listening}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50"
          >
            {visibleSongs.map(s => (
              <option key={s.id} value={s.id}>
                {starred.includes(s.id) ? '★ ' : ''}{s.title} ({s.level})
              </option>
            ))}
            {visibleSongs.length === 0 && <option value="">no songs match that</option>}
          </select>
        </label>

        <label className="text-sm">
          <span className="block font-semibold text-purple-900">Mode</span>
          <select
            value={mode}
            onChange={e => { stop(); setGame(null); setMode(e.target.value as GameMode); }}
            disabled={listening}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50"
          >
            <option value="wait">Easy — waits for you</option>
            <option value="tempo">Hard — moves at {song.bpm} BPM</option>
            <option value="practice">Practice — no score</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          {listening
            ? <button onClick={stop} className="rounded-lg bg-zinc-700 px-5 py-2 font-semibold text-white">Stop</button>
            : <button onClick={start} className="rounded-lg bg-purple-800 px-5 py-2 font-semibold text-white">
                {game?.done ? 'Play again' : 'Start'}
              </button>}
          <button
            onClick={() => setSoundOn(v => !v)}
            aria-pressed={soundOn}
            title={soundOn ? 'Sound on — tap a note to hear it' : 'Sound off'}
            className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
              soundOn ? 'border-purple-300 bg-purple-50 text-purple-900' : 'border-zinc-300 text-zinc-500'
            }`}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      {/* PLAY ALONG — the song plays out loud and the kid plays with it.
          The speed dial is the point: a beginner starts well under the marked
          tempo and works up, which is how a teacher runs this. Available in
          every mode, because playing along with a recording is practice, not
          a way to cheat a reading test. */}
      {soundOn && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-purple-200 bg-purple-50/60 p-3">
          {alongPlaying ? (
            <button
              onClick={stopAlong}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-white"
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={startAlong}
              className="rounded-lg bg-purple-800 px-4 py-2 text-sm font-semibold text-white"
            >
              ▶ Play along
            </button>
          )}

          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-purple-900">Speed</span>
            <input
              type="range"
              min={40}
              max={120}
              step={5}
              value={alongPct}
              onChange={e => setAlongPct(Number(e.target.value))}
              className="w-32 sm:w-44"
              aria-label="Play-along speed"
            />
            <span className="w-24 tabular-nums text-zinc-700">
              {alongPct}% · {Math.round((song.bpm * alongPct) / 100)} BPM
            </span>
          </label>

          <span className="text-xs text-zinc-500">
            Four clicks count you in. Start slow and speed up as it gets easy.
          </span>
        </div>
      )}

      {/* Hearing the notes is a LEARNING aid, so it is offered in easy and
          practice but withheld in tempo mode — otherwise a kid can play the
          whole thing by ear and never read a note. */}
      {soundOn && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {canHearNotes ? (
            <>
              <button
                onClick={() => playPhrase(song.notes.slice(cursor, cursor + 8), 60000 / song.bpm)}
                className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 font-semibold text-purple-800 hover:bg-purple-50"
              >
                ▶ Hear the next few notes
              </button>
              <span className="text-zinc-500">or tap any note on the staff to hear just that one</span>
            </>
          ) : (
            <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-zinc-600">
              Reference tones are off in Hard mode — that mode is testing your <i>reading</i>.
            </span>
          )}
        </div>
      )}

      {/* --- mic trouble --- */}
      {status === 'denied' && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          The microphone is blocked. Allow it in your browser&rsquo;s address bar, then press Start again.
        </p>
      )}
      {status === 'no-mic' && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          No microphone found. Plug one in (or use a device with one) and press Start.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Could not start the microphone on this device.
        </p>
      )}

      {/* --- the staff --- */}
      {/* LOOK THROUGH THE PIECE FIRST. Every sight-reading method says to read a
          piece before playing it, and until now the game only ever showed the
          few notes around the cursor. Hidden once a run starts — mid-run this
          would just fight the playhead. */}
      {!game && song.notes.length > 6 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
          <span className="font-semibold text-purple-900">Look through it first</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, song.notes.length - 1)}
            value={browseAt}
            onChange={e => setBrowseAt(Number(e.target.value))}
            className="min-w-40 flex-1"
            aria-label="Scroll through the music"
          />
          <span className="tabular-nums text-zinc-600">
            note {browseAt + 1} of {song.notes.length}
          </span>
          {browseAt > 0 && (
            <button
              onClick={() => setBrowseAt(0)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700"
            >
              back to start
            </button>
          )}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-[#fbfaff]">
        <svg viewBox="0 0 700 200" className="block w-full" role="img" aria-label={`${song.title} — note reader`}>
          {/* GUIDE TRACK — a dim horizontal lane under the staff showing WHERE
              and WHEN each note lands. It scrolls with the music, so a kid can
              see the next note approaching and how much time is left before it
              reaches the hit line. Deliberately low-contrast: it is a guide,
              not the notation, and it must not compete with the notes. */}
          <rect x="0" y={STAFF_TOP + 8 * STAFF_STEP + 22} width="700" height="16" fill="#efeaf7" />
          <g transform={`translate(${HIT_X - (alongIndex ?? (game ? cursor : browseAt)) * NOTE_SPACING}, 0)`}>
            {song.notes.map((n, i) => {
              const res = game?.results.find(r => r.index === i);
              const w = Math.max(10, n.beats * (NOTE_SPACING * 0.42));
              return (
                <rect
                  key={`g${i}`}
                  x={i * NOTE_SPACING - w / 2}
                  y={STAFF_TOP + 8 * STAFF_STEP + 24}
                  width={w}
                  height={12}
                  rx={3}
                  fill={
                    res?.grade === 'great' ? '#86efac'
                    : res?.grade === 'close' ? '#fcd34d'
                    : res?.grade === 'wrong' ? '#fca5a5'
                    : i === cursor ? '#c4b5fd'
                    : '#ddd6e8'
                  }
                />
              );
            })}
          </g>

          {/* five staff lines */}
          {[0, 2, 4, 6, 8].map(pos => (
            <line key={pos} x1="0" y1={yFor(pos)} x2="700" y2={yFor(pos)} stroke="#c9c2d4" strokeWidth="1.5" />
          ))}
          {/* clef */}
          <text x="14" y={yFor(2) + 8} fontSize="52" fill="#581c87" fontFamily="serif">
            {song.clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
          </text>
          {/* HIT LINE — where a note must be played. The PLAYHEAD (below) creeps
              from here toward the next note so the beat is visible arriving. */}
          <line x1={HIT_X} y1={STAFF_TOP - 26} x2={HIT_X} y2={STAFF_TOP + 8 * STAFF_STEP + 26}
                stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          {/* playhead: advances across the gap to the next note as the beat elapses */}
          {game && !game.done && (
            <line
              x1={HIT_X + beatFrac * NOTE_SPACING} y1={STAFF_TOP - 20}
              x2={HIT_X + beatFrac * NOTE_SPACING} y2={STAFF_TOP + 8 * STAFF_STEP + 20}
              stroke="#16a34a" strokeWidth="2" strokeLinecap="round" opacity="0.75"
            />
          )}
          {/* HIT BLOOM — only on a hit, never on a miss.
              A miss is the ABSENCE of reward (the note simply stays hollow and
              grey), not the presence of punishment. Across the music-learning
              category, detection failure is the single most common complaint,
              and a red X asserts the app was right and the child was wrong —
              which, when the microphone mishears, is a lie that makes kids quit
              the instrument. Where it is ambiguous, the app doubts itself. */}
          {flash?.hit && (
            <circle
              cx={HIT_X} cy={STAFF_TOP + 4 * STAFF_STEP} r="30"
              fill="none" strokeWidth="4" stroke="#16a34a" opacity="0.55"
            />
          )}

          {/* notes, scrolled so the current one sits on the hit line */}
          {/* The staff follows the play-along note when one is sounding, and
              the game cursor otherwise — without this the highlighted note
              scrolls off screen during play-along. */}
          <g transform={`translate(${HIT_X - (alongIndex ?? (game ? cursor : browseAt)) * NOTE_SPACING}, 0)`}>
            {song.notes.map((n, i) => {
              const pos = staffPosition(n.midi, song.clef);
              const x = i * NOTE_SPACING;
              const y = yFor(pos);
              const res = game?.results.find(r => r.index === i);
              // Hit = filled green. Missed = left the same grey it started as,
              // Colour by GRADE, not by hit/miss:
              //   great   green   right note, in tune, on time
              //   close   amber   right note, loose pitch or timing
              //   wrong   red     a clearly different note was played
              //   unheard grey    the mic caught nothing — NOT red, because a
              //                   false negative must never look like the
              //                   child's failure
              const fill =
                res?.grade === 'great' ? '#16a34a'
                : res?.grade === 'close' ? '#d97706'
                : res?.grade === 'wrong' ? '#dc2626'
                : res?.hit ? '#16a34a'
                : i === cursor ? '#581c87'
                : '#8f86a0';
              const isCurrent = i === cursor && !game?.done;
              return (
                <g
                  key={i}
                  opacity={i < cursor && !res ? 0.35 : 1}
                  onClick={() => hearNote(n.midi)}
                  style={{ cursor: canHearNotes && soundOn ? 'pointer' : 'default' }}
                  role={canHearNotes && soundOn ? 'button' : undefined}
                  aria-label={canHearNotes && soundOn ? `Hear ${noteLabel(n.midi)}` : undefined}
                >
                  {/* generous invisible tap target — small fingers, small notes */}
                  {canHearNotes && soundOn && (
                    <rect x={x - 18} y={y - 22} width="36" height="44" fill="transparent" />
                  )}
                  {ledgerLines(pos).map(lp => (
                    <line key={lp} x1={x - 13} y1={yFor(lp)} x2={x + 13} y2={yFor(lp)} stroke="#8f86a0" strokeWidth="1.5" />
                  ))}
                  {isCurrent && <circle cx={x} cy={y} r="17" fill="#facc15" fillOpacity="0.35" />}
                  {/* the note sounding right now during play-along */}
                  {alongIndex === i && (
                    <circle cx={x} cy={y} r="15" fill="none" stroke="#7c3aed" strokeWidth="3" />
                  )}
                  <ellipse cx={x} cy={y} rx="8.5" ry="6.5" fill={fill} transform={`rotate(-18 ${x} ${y})`} />
                  {/* stem: down for high notes, up for low, like real notation */}
                  <line
                    x1={pos >= 4 ? x - 8 : x + 8} y1={y}
                    x2={pos >= 4 ? x - 8 : x + 8} y2={pos >= 4 ? y + 34 : y - 34}
                    stroke={fill} strokeWidth="2"
                  />
                  {isSharp(n.midi) && (
                    <text x={x - 26} y={y + 5} fontSize="17" fill={fill} fontFamily="serif">&#9839;</text>
                  )}
                  {/* half/whole notes read as hollow */}
                  {n.beats >= 2 && <ellipse cx={x} cy={y} rx="4.5" ry="3" fill="#fbfaff" transform={`rotate(-18 ${x} ${y})`} />}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* --- live readout --- */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-zinc-600">
          Play: <b className="text-purple-900">
            {game && !game.done && song.notes[cursor]
              ? noteLabel(song.notes[cursor].midi)
              : '—'}
          </b>
        </span>
        <span className="text-zinc-600">
          Hearing: <b className={heard ? 'text-green-700' : 'text-zinc-400'}>
            {heard ? `${heard.name}${heard.octave}` : 'listening…'}
          </b>
          {heard && Math.abs(heard.cents) > 25 && (
            <span className="ml-1 text-amber-700">({heard.cents > 0 ? 'sharp' : 'flat'})</span>
          )}
        </span>
        {game && !game.done && (
          <span className="text-zinc-600">Note <b>{cursor + 1}</b> of {song.notes.length}</span>
        )}
        {/* running points total, live while playing */}
        {game && game.results.length > 0 && (
          <span className="rounded-lg bg-purple-100 px-2.5 py-1 font-semibold text-purple-900 tabular-nums">
            {scoreRun(game.results).points} pts
          </span>
        )}
      </div>

      {/* The microphone genuinely mishears sometimes — low notes, repeated
          notes, a quiet bow. When that happens the app doubts ITSELF rather
          than telling a child who played correctly that they were wrong. */}
      {game && !game.done && isStuck(game) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            I might not be hearing this one. That happens with low notes and quiet playing —
            it doesn&rsquo;t mean you played it wrong.
          </span>
          <button
            onClick={() => {
              const cur = gameRef.current;
              if (!cur) return;
              const next = skipStuckNote(cur, song);
              gameRef.current = next;
              setGame(next);
              if (next.done && next.mode !== 'practice') void submitRun(next);
            }}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white"
          >
            Skip this note →
          </button>
        </div>
      )}

      {/* --- result --- */}
      {result && (
        <div className="mt-4 rounded-xl bg-gradient-to-br from-purple-800 to-purple-600 p-5 text-white">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-4xl font-bold tabular-nums">{result.points}</p>
            <p className="text-sm opacity-90">out of {result.maxPoints} points</p>
            <p className="text-sm opacity-90">· {result.accuracy}% of notes</p>
          </div>

          {/* Grade breakdown — this is where the kid sees WHAT to fix, which is
              more useful than a single pass/fail verdict. */}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded bg-green-500/90 px-2.5 py-1 font-semibold">
              {result.great} spot on
            </span>
            <span className="rounded bg-amber-500/90 px-2.5 py-1 font-semibold">
              {result.close} close
            </span>
            {result.wrong > 0 && (
              <span className="rounded bg-red-600/90 px-2.5 py-1 font-semibold">
                {result.wrong} wrong note
              </span>
            )}
            {result.unheard > 0 && (
              <span className="rounded bg-white/25 px-2.5 py-1 font-semibold">
                {result.unheard} not heard
              </span>
            )}
          </div>

          {bestPoints !== null && (
            <p className="mt-3 text-sm text-yellow-200">
              {result.points >= bestPoints
                ? `🏆 New best for ${song.title}!`
                : `Your best on this song: ${bestPoints} points`}
            </p>
          )}

          <span className={`mt-3 inline-block rounded px-3 py-1 text-sm font-semibold ${result.passed ? 'bg-yellow-300 text-zinc-900' : 'bg-white/25'}`}>
            {result.passed ? 'PASSED' : 'Keep practicing — 80% to pass'}
          </span>
          {earned && <p className="mt-2 text-sm text-yellow-200">{earned}</p>}
        </div>
      )}
    </div>
  );
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteLabel(midi: number) {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
