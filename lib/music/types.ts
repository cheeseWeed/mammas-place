// Music practice tracker — data model.
//
// Lives in the `music` JSON blob on DriveUser (see prisma/schema.prisma).
// Server-only readers/writers are in lib/music/profile.ts. These types are
// shared with client components, so keep this file free of server imports.
//
// Design notes:
//   - A *piece* is one song a kid is learning on one instrument. It carries
//     an estimate of total lines/systems (the unit we break practice into),
//     an optional target pass-off date, and a per-day log of quality scores.
//   - A *daily log entry* is one practice session: the kid plays, then enters
//     a quality score (1-10, reviewed by a parent / ChatGPT first) plus how
//     many lines they worked. MP is awarded server-side from the score.
//   - A *challenge* is an OPTIONAL, fully-reusable competition wrapper. It is
//     NOT Shepherd-specific — any kid with a competition coming up gets one.
//     It defines deadline bonuses and per-pass-off gift-card rewards on top of
//     the normal weekly pass-off reward.

// ----- Pieces -----

// Instrument is a free string so families can add any instrument (ukulele,
// harp, drums…). The presets below drive the dropdown + emoji/label lookup;
// anything not in the list still works and falls back to the 🎵 icon.
export type Instrument = string;

export const INSTRUMENTS: { value: string; label: string; emoji: string }[] = [
  { value: 'cello', label: 'Cello', emoji: '🎻' },
  { value: 'piano', label: 'Piano', emoji: '🎹' },
  { value: 'violin', label: 'Violin', emoji: '🎻' },
  { value: 'guitar', label: 'Guitar', emoji: '🎸' },
  { value: 'voice', label: 'Voice', emoji: '🎤' },
  { value: 'viola', label: 'Viola', emoji: '🎻' },
  { value: 'flute', label: 'Flute', emoji: '🎶' },
  { value: 'trumpet', label: 'Trumpet', emoji: '🎺' },
  { value: 'drums', label: 'Drums', emoji: '🥁' },
  { value: 'ukulele', label: 'Ukulele', emoji: '🎸' },
  { value: 'harp', label: 'Harp', emoji: '🎵' },
  { value: 'saxophone', label: 'Saxophone', emoji: '🎷' },
  { value: 'other', label: 'Other', emoji: '🎵' },
];

// Resolve an instrument string to its display label + emoji. Unknown (custom)
// instruments get title-cased and a generic 🎵.
export function instrumentDisplay(value: string): { label: string; emoji: string } {
  const preset = INSTRUMENTS.find((i) => i.value === value);
  if (preset) return { label: preset.label, emoji: preset.emoji };
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return { label, emoji: '🎵' };
}

// Who can confirm a pass-off (any of these, for any song).
export type PassOffBy = 'teacher' | 'mom' | 'dad';

export const PASS_OFF_BY: { value: PassOffBy; label: string }[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'mom', label: 'Mom' },
  { value: 'dad', label: 'Dad' },
];

// One weekly pass-off event (recurring) on a piece.
export interface TeacherPassOff {
  date: string;       // YYYY-MM-DD it was passed off
  by: PassOffBy;      // who confirmed it
  centsAwarded: number; // MP paid for this pass-off (server-set, e.g. 150 MP)
  note?: string;
}

// One practice session on one calendar day.
export interface MusicLogEntry {
  date: string;          // YYYY-MM-DD (local) — one entry per piece per day (idempotent)
  qualityScore: number;  // 1..10 — how good it sounded today (parent/ChatGPT reviewed)
  linesPracticed: number; // how many lines/systems were worked this session
  minutesPracticed?: number; // minutes practiced (learning days) — drives the time multiplier
  centsEarned: number;   // MP credited for this session (server-computed)
  note?: string;         // optional kid/parent note
  reviewedBy?: string;   // 'dad' | 'chatgpt' | 'mom' | etc. (logged only)
  // Polish/perform-day sessions: how many complete play-throughs (50 MP each).
  // Undefined/0 on normal learning-day sessions.
  playThroughs?: number;
  mode?: 'learn' | 'polish'; // which earn mode this entry used (default 'learn')
}

export interface MusicPiece {
  id: string;             // cuid-ish; generated when the piece is added
  title: string;
  instrument: Instrument;
  estLines: number;       // total lines/systems to learn (drives the daily plan)
  difficulty: 'easy' | 'medium' | 'hard';
  targetDate?: string;    // YYYY-MM-DD — when it should be passed off by
  pdfHref?: string;       // optional link to the sheet music
  addedBy: 'kid' | 'parent';
  createdAt: string;      // ISO
  log: MusicLogEntry[];   // newest-last
  // Set once the parent confirms the piece is performance-ready. Earns the
  // pass-off reward (gift card). Null while still in progress.
  passedOffAt?: string;   // ISO
  passOffGiftCode?: string; // the MP-XXXXXX code minted on pass-off (audit)
  // Archived = retired from the active list/plan but kept for history and the
  // calendar. Distinct from passed-off (which pays a reward) and delete (which
  // removes entirely). A kid archives a song they're done with but didn't
  // formally pass off.
  archived?: boolean;
  archivedAt?: string;    // ISO
  // Manual "polish mode" override. Normally polish mode auto-engages once all
  // lines are learned (or on Sunday), but a kid can flip a song into polish
  // mode early (e.g. they've got the notes and want to focus on play-throughs).
  polishMode?: boolean;
  // Weekly pass-offs. Each entry = someone (teacher / mom / dad) passed the kid
  // off on this piece (recurring; a piece can be passed off in multiple weeks
  // if it stays in lesson rotation). Earns the weekly reward (150 MP) per
  // entry. Distinct from `passedOffAt`, the one-time COMPETITION pass-off.
  teacherPassOffs?: TeacherPassOff[];
  // Who confirmed the one-time competition pass-off (teacher / mom / dad).
  passOffBy?: PassOffBy;
}

// ----- Challenge (reusable competition wrapper) -----
//
// Generic on purpose. Shepherd's July cello sprint is just one instance.
// Any kid with a recital / camp / competition gets a challenge configured in
// the parent admin. Bonuses are all optional — leave a field 0/undefined to
// turn that bonus off.

export interface MusicChallenge {
  id: string;
  name: string;            // "Shepherd's Cello Camp Sprint"
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD — the event/camp day
  pieceIds: string[];      // which pieces count toward this challenge

  // Per-piece pass-off gift card (on top of the normal weekly reward). Cents.
  passOffRewardCents: number;        // e.g. 20000 = 200 MP

  // "Finish all challenge pieces by this date" bonus. Cents + the date.
  finishAllBy?: string;              // YYYY-MM-DD (e.g. July 1)
  finishAllBonusCents?: number;      // e.g. 50000 = 500 MP

  // "Play all challenge pieces well in a single day" bonus. Cents + the date
  // by which it must happen + the min quality score that counts as "well".
  playAllInOneDayBy?: string;        // YYYY-MM-DD (e.g. July 7)
  playAllInOneDayMinScore?: number;  // e.g. 8 (out of 10)
  playAllInOneDayBonusCents?: number; // e.g. 25000 = 250 MP

  // Award bookkeeping — set when each bonus is paid so we never double-pay.
  finishAllAwardedAt?: string;
  playAllInOneDayAwardedAt?: string;
}

// ----- The whole blob -----

export interface MusicProfile {
  pieces: MusicPiece[];
  challenge?: MusicChallenge;
  // Explicit daily learning goal — NEW lines to learn each practice day.
  // Settable by the kid or a parent. Fractional allowed (e.g. 3.5). Undefined
  // = use the auto-computed pace (spread remaining lines over days-to-target).
  //
  // How the goal applies depends on goalMode:
  //   'spread'        → split the goal across ALL active pieces each day
  //                     (work a bit of everything every day).
  //   'one-at-a-time' → focus ONE piece until it's done/passed off, applying
  //                     the whole goal to it; the rest wait their turn.
  dailyLineGoal?: number;
  goalMode?: 'spread' | 'one-at-a-time'; // default 'spread'
}

export function emptyMusicProfile(): MusicProfile {
  return { pieces: [] };
}

// Normalize whatever JSON is in the column into a real MusicProfile.
export function coerceMusicProfile(raw: unknown): MusicProfile {
  if (!raw || typeof raw !== 'object') return emptyMusicProfile();
  const obj = raw as Record<string, unknown>;
  const pieces = Array.isArray(obj.pieces) ? (obj.pieces as MusicPiece[]) : [];
  const challenge = obj.challenge && typeof obj.challenge === 'object'
    ? (obj.challenge as MusicChallenge)
    : undefined;
  const dailyLineGoal =
    typeof obj.dailyLineGoal === 'number' && obj.dailyLineGoal > 0 ? obj.dailyLineGoal : undefined;
  const goalMode = obj.goalMode === 'one-at-a-time' ? 'one-at-a-time' : 'spread';
  return { pieces, challenge, dailyLineGoal, goalMode };
}
