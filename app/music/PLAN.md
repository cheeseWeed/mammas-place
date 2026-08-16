# Music section

Three tools that share one section:

| Tool | Route | What it is |
|---|---|---|
| **Practice Studio** | `/music` | Daily practice tracker — assigned pieces, daily plan, quality score → MP |
| **Note Reader** | `/music/read` | Sight-reading game — notes scroll, the mic scores what you play |
| **Music Writer** | `/music/write` | Write your own song note by note; saved songs play in the Note Reader |
| **Symphony** | `/music/symphony` | Write for several instruments; full score and player parts |

The Practice Studio came first and the rest of this document describes it.
Note Reader and Music Writer are documented at the bottom under
**"Note Reader & Music Writer"**.

---

## Practice Studio

A daily practice tracker for any instrument. The kid picks (or is assigned)
pieces, follows a generated daily plan to learn them line-by-line, and logs a
quality score each day to earn MP. "The better it sounds, the more you earn."

Built on top of MP Money (see `app/money/PLAN.md`) — it's just another earning
section, like Math or Chess, plus a reusable competition wrapper (Challenge).

## What it does

- **Pieces.** A piece = one song on one instrument, with an estimated number of
  lines, a difficulty, and an optional pass-off target date. Kids can add their
  own; parents can add/edit any kid's from `/admin/music`.
- **Daily plan.** From each piece's line count and target date, the studio tells
  the kid how many *new* lines to learn today — front-loading learning so there's
  polish time before the target. Weekends (Sat/Sun) are flagged as performance
  days, not new-learning days. (See `lib/music/plan.ts`.)
- **Daily earn.** The kid plays, then enters a 1–10 quality score (reviewed by a
  parent / ChatGPT first). MP scales steeply with the score (Fibonacci-style),
  capped at **100 MP/day/piece**. One score per piece per day (idempotent).
  (See `lib/music/reward.ts`.)
- **Pass-off.** A parent confirms a piece is performance-ready in `/admin/music`.
  That mints a **gift card** (200 MP default) the kid redeems through the normal
  MP gift-card flow — single economy, full audit trail.
- **Challenge (reusable).** An OPTIONAL competition wrapper attached to a kid —
  not specific to any one kid. Defines per-pass-off reward + two deadline
  bonuses: "finish all by date X" and "play all well in one day by date Y."
  Reused for any kid with a recital / camp / competition coming up.
- **Certificate.** Once a piece is passed off OR the kid hits a 9–10/10 run
  (full points), the kid can self-print a certificate at `/music/certificate`.

## MP economy (this section)

| Event | Reward | Where set |
|---|---|---|
| Daily practice | up to 100 MP/day/piece (steep on quality) | `lib/music/reward.ts` |
| Pass off a piece (in a challenge) | `challenge.passOffRewardCents` | `/admin/music` |
| Pass off a piece (no challenge) | 200 MP default | `/api/music/pass-off` |
| Weekly pass-off (non-competition kids) | 150 MP/week per pass-off — parent pays from MP Bank | manual |
| Finish all challenge pieces by date | `finishAllBonusCents` | challenge |
| Play all well in one day by date | `playAllInOneDayBonusCents` | challenge |

> The "150 MP/week per pass-off" rule for non-competition kids is a parent
> convention paid via the MP Bank top-up — it isn't auto-enforced, because
> "this week" pass-offs vary. The challenge automates the competition payouts.

## File map

```
lib/music/
  types.ts     # MusicPiece, MusicChallenge, MusicProfile (+ coerce)
  reward.ts    # steep daily-score → cents curve, 100 MP cap
  plan.ts      # daily/weekly line plan, learned/bestScore, perform-day detection
  today.ts     # America/Denver "today" (so weekend detection matches the family)
  profile.ts   # SERVER-ONLY blob I/O + atomic earn + pass-off + challenge eval
  __tests__/reward.test.ts

app/api/music/
  state/route.ts      # GET full profile + today's plan + reward curve
  pieces/route.ts     # POST/PATCH/DELETE pieces (kid self or parent)
  practice/route.ts   # POST daily score → earn (kid)
  pass-off/route.ts   # POST pass-off → mint gift card (parent)
  challenge/route.ts  # POST set/clear challenge (parent)

app/music/page.tsx              # kid hub (plan, score entry, challenge tracker)
app/music/certificate/page.tsx  # printable certificate (self-serve)
app/admin/music/page.tsx        # parent admin (gate) → MusicAdminDashboard
components/admin/MusicAdminDashboard.tsx

scripts/seed-shepherd-music.mjs # Shepherd's 4 cello pieces + July challenge
```

## Architectural rules (kept consistent with MP Money)

1. **Server decides the reward.** The client sends `{pieceId, qualityScore,
   linesPracticed}`; the server computes cents. Kids can't self-credit.
2. **Atomic + idempotent.** Every earn writes MpEarning + balance + ledger +
   the music blob in one `$transaction`. The unique key
   `music:{user}:{pieceId}:{date}` makes one-score-per-day race-safe.
3. **One economy.** Pass-off rewards are MP gift cards via `lib/money/gift-card`,
   not a parallel currency. Section earnings total into the wallet grid
   (`sumEarningsPerSection` → `music`).
4. **Challenge is reusable, never hard-coded.** Shepherd's July sprint is one
   instance created from the generic editor. Award flags are server-managed so a
   parent edit can't re-arm a paid bonus.

## Deploy note

The `music` column is a new JSON field on `drive_users`. Run
**`npx prisma db push`** against Neon before deploying, or every `/api/music/*`
call 500s (same gotcha as every other schema change here).

---

# Note Reader & Music Writer

Added Aug 2026. The Note Reader is a sight-reading game; the Music Writer is a
score editor that feeds it. Both are separate from the Practice Studio above —
the Studio is for daily practice on assigned pieces, these are for learning to
READ and WRITE notation.

## Note Reader (`/music/read`)

Notes scroll toward a hit line; the kid plays them on a real instrument and the
microphone scores it. Reuses the tuner's Web Audio chain:
`getUserMedia -> AudioContext -> AnalyserNode -> detectPitch -> frequencyToNote`.
Mic processing (echoCancellation / noiseSuppression / autoGainControl) is OFF —
voice-call processing eats sustained instrument tones and wrecks pitch detection.

**Three modes.** `wait` waits for the right note and never punishes a wrong one
(a kid hunting for a note is practicing). `tempo` runs at the song's speed and
counts a passed note as missed. `practice` keeps no score and earns no MP.

**Graded scoring** (`gradeNote`): points scale with how close the pitch and
timing were, not pass/fail. Grades are `great` / `close` / `wrong` / `unheard`.

### THE DESIGN RULE — where it is ambiguous, the app doubts ITSELF, not the child

Detection failure is the top complaint across music-learning apps (~28% of
negative reviews), including a documented case of a child quitting the
instrument over it. Consequences throughout this feature:

- `unheard` is a **distinct grade from `wrong`** and is drawn GREY, never red.
  A false negative must never look like the child's failure.
- A wrong note in wait mode records **nothing** — it is not a miss.
- **Skip-stuck-note escape hatch**: after `STUCK_TICK_LIMIT` silent ticks the
  kid can skip, and skipping records NO miss, because we do not know they got
  it wrong — the mic may be at fault.
- Dynamics and markings are **displayed but never scored**.

### Uploads and import

Kids upload their own sheet music (`/api/music/upload`, Vercel Blob).
MusicXML and MIDI parse instantly (`lib/music/import.ts`, no dependencies —
a regex tag scanner and a byte reader). PDFs queue for human transcription.

- Blob store is **private**; `access: 'private'` is required or the upload
  fails with "Cannot use public access on a private store."
- `foldToPlayableOctave()` exists because ensemble MIDI exports double the tune
  across instruments; parts do not overlap in time so monophonize keeps all of
  them, producing a melody spanning four octaves that no child can play.
- Uploads are **displayed back to the kid**. They were being written and never
  read, so Shepherd uploaded the same PDF six times assuming it had failed.

### Memorize modes (`lib/music/memorize.ts`)

Three ways to practice from memory, in teaching order:

| Mode | What is hidden | Trains |
|---|---|---|
| `fade` | a percentage of noteheads, 0-90% | which notes you do not really know |
| `cover` | every note | chunking a whole phrase |
| `grow` | bars 1..N, growing | building a piece for performance |

**Fade is the default.** Covering a whole line is pass/fail — a kid either has
it or crashes on bar 1 and learns nothing about WHERE the memory is thin.
Blanking individual notes shows exactly that. Both are retrieval practice,
which is why either beats re-reading the page.

Non-obvious implementation rules:
- A hidden note is drawn at a **fixed staff position (the middle line)**, not
  its real height — drawing it in place would give the pitch away. Its
  accidental and hollow centre are suppressed for the same reason.
- The mask is **deterministic per seed** (`hashUnit`). A replay hides the SAME
  notes, or "did I get better?" is unanswerable. Never `Math.random()`.
- **Hold-to-peek** so a stuck kid can look without switching the mode off and
  losing their place.
- Difficulty changes are **offered after a run, never applied silently**.
- Rests are never hidden — nothing to remember, and it looks like a bug.

> `hashUnit` must re-coerce to unsigned (`>>> 0`) after EVERY step. `Math.imul`
> and `^=` both return signed 32-bit ints; one missing coercion made `h` go
> negative, every note compared below the fade fraction, and the whole piece
> was hidden at any setting. A test caught this.

## Music Writer (`/music/write`)

Start from a blank page ("Start a new song") or open any existing song to edit
it. Click the staff to add a note, click a note to rename / sharpen / delete,
drag to move it with the pitch name magnified while dragging, or type
`"A#4 whole"`. Bar lines turn **red** when a bar does not add up.

**Why this exists:** transcription is the weak link in this whole feature.
Reading engraved notation off a phone photo failed twice on the same Bach
minuet, and reading it automatically (OMR) is worse. A kid holding the printed
page enters it correctly faster than anyone can argue about a blurry image —
and they KNOW it is right, because they put it there.

- All editing rules are pure functions in `lib/music/editor.ts`, unit-tested
  away from React. The component is only the staff, pointer handling, panels.
- Saved songs go into the **same** `music.sheetUploads` array that imports use,
  so they appear in the Note Reader picker with no second code path.
- **`/api/music/songs` validates every note server-side.** The Note Reader
  clamps earned MP against the song it looks up on the server, so an
  unvalidated 50,000-note song posted here would be a way to mint MP.
  `MAX_NOTES = 2000`; MIDI must be 21-108; beats must be 0 < b <= 16.

## Clefs

`Song.clef` is `'treble' | 'bass' | 'grand'`. `staveFor(midi, clef)` decides
which stave a note belongs on, split at middle C — the convention a beginner is
taught, and the split that minimises ledger lines for a child's range.

## Transcription accuracy — the bar-sum guard

`sightread.test.ts` asserts every song's beats divide evenly into its time
signature. This is the cheapest real check on a hand transcription and it has
caught actual shipped errors (a 17-beat "4-bar" scale, a 62-beat "16-bar"
piece, a 2-beat and a 5-beat bar in 3/4).

**The map must list EVERY song** — a test enforces that too. The guard
originally listed only one song, which is precisely why the other two errors
shipped. Adding a song without adding it to `EXPECTED` silently opts it out.

> Reading notation off a photograph is where this repeatedly fails. The source
> edition (urtext) is the only real check.

## File map (these two tools)

```
lib/music/
  sightread.ts   # SONGS, staffPosition, staveFor, advanceGame, gradeNote, scoreRun
  editor.ts      # PURE editing: noteName/parseNoteName, NOTE_VALUES, insert/
                 #   delete/update/move/transpose, parseSpokenNote, measureLayout
  memorize.ts    # PURE: hashUnit, fadeMask, barsOf, memorizePlan, suggestNextStep
  score.ts       # PURE multi-part: INSTRUMENTS, scoreOrder, soundingMidi/
                 #   writtenMidi, alignmentReport, padToAlign, extractPart
  import.ts      # MusicXML + MIDI parsing, foldToPlayableOctave
  tone.ts        # Web Audio synthesis: playNote, playPhrase, playAlong
  pitch.ts       # McLeod/autocorrelation pitch detection (shared with the tuner)

app/api/music/
  upload/route.ts     # POST sheet music -> Blob (private), parse if it can
  uploads/route.ts    # GET the kid's uploads + parsed songs, deduped
  songs/route.ts      # POST a hand-written song (validates every note)
  sightread/route.ts  # POST a finished run -> MP (clamped server-side)

app/music/read/page.tsx     # Note Reader
app/music/write/page.tsx    # Music Writer
app/music/symphony/page.tsx # Symphony (multi-instrument)
components/music/SightReadGame.tsx
components/music/ScoreEditor.tsx
components/music/ScoreView.tsx
components/music/SheetUpload.tsx
```

## Symphony (`/music/symphony`) — writing for a group

`lib/music/score.ts` + `components/music/ScoreView.tsx`. A `MultiScore` holds
`parts[]`; **"full score" vs "one part" is a rendering choice, not a second
file**, which is how real notation software works and means the two views can
never drift apart. The toggle on the page is the lesson.

- **Score order is fixed**: woodwind, brass, percussion, keyboard, voice,
  string, top to bottom (`FAMILY_ORDER`). `scoreOrder()` sorts, stable within a
  family, so a kid can add instruments in any order.
- **Transposing instruments**: `Instrument.transpose` is how many semitones the
  SOUND sits from the WRITING (B-flat trumpet `-2`, E-flat alto sax `-9`, F
  horn `-7`, double bass `-12`). `soundingMidi`/`writtenMidi` are exact
  inverses — a test asserts it across every instrument, because inverting this
  makes playback sound merely out of tune rather than obviously broken. Apply
  before PLAYBACK, never before display.
- **`alignmentReport()`** is the multi-part bar-sum guard: every part must span
  the same bars, so a short part has lost a rest. `padToAlign()` fills with
  RESTS — real notation, since a player counts those bars.
- Note x-positions come from **accumulated beats, not note index**, or a half
  note in one part sits against two quarters in another and looks aligned while
  being wrong.
- Out-of-range notes draw red as a **warning, never a block**.

## Still open

- **Instrument selection** affecting playback timbre. The Symphony page plays
  every part with the same synth voice; `Instrument` already carries the
  metadata a timbre table would key off.
- **Saving a symphony.** `/api/music/songs` stores a single-part song; a
  MultiScore has no persistence yet, so the page is currently a workspace that
  resets on reload. `extractPart()` already produces something the existing
  save route could take.
- **Chords**: display and playback only. They cannot be scored — the pitch
  detector is monophonic.
- **Grand staff rendering in the Note Reader**: `staveFor` computes correct
  positions and the Writer draws both staves, but the game's SVG still draws
  one. Needs the second stave plus adjusted guide-track geometry.
- Three PDFs pending transcription: Minuet No. 2 (BWV Anh. 116, 40 bars),
  Long Long Ago, Long Long Ago Variation.
