// Calendar aggregation — pure functions, no DB.
//
// Rolls a kid's per-piece practice logs up into a per-DAY view so the calendar
// page can show "what did each day look like": which pieces were practiced,
// the scores, and the MP earned that day. Also builds the month grid (weeks of
// 7 cells, Sunday-first) the UI renders.
//
// All deterministic given (pieces, month). No Date.now() — callers pass the
// month string; tests pass fixed values.

import type { MusicPiece } from './types';

// One piece's contribution to a single day.
export interface DayPieceEntry {
  pieceId: string;
  title: string;
  qualityScore: number;
  linesPracticed: number;
  centsEarned: number;
  note?: string;
  reviewedBy?: string;
  passedOff: boolean; // did this piece get passed off ON this day?
}

// Everything that happened on one calendar day.
export interface DaySummary {
  date: string;            // YYYY-MM-DD
  entries: DayPieceEntry[];
  totalCents: number;      // MP earned across all pieces that day
  avgScore: number;        // mean quality score (0 if no entries)
  bestScore: number;       // best quality score that day
  practicedCount: number;  // how many pieces were practiced
  passOffs: string[];      // titles passed off this day
}

// Build a date → DaySummary map from all of a kid's pieces.
export function summarizeByDay(pieces: MusicPiece[]): Record<string, DaySummary> {
  const map: Record<string, DaySummary> = {};

  const ensure = (date: string): DaySummary => {
    if (!map[date]) {
      map[date] = {
        date,
        entries: [],
        totalCents: 0,
        avgScore: 0,
        bestScore: 0,
        practicedCount: 0,
        passOffs: [],
      };
    }
    return map[date];
  };

  for (const piece of pieces) {
    // Practice sessions.
    for (const e of piece.log) {
      const day = ensure(e.date);
      day.entries.push({
        pieceId: piece.id,
        title: piece.title,
        qualityScore: e.qualityScore,
        linesPracticed: e.linesPracticed,
        centsEarned: e.centsEarned,
        note: e.note,
        reviewedBy: e.reviewedBy,
        passedOff: false,
      });
      day.totalCents += e.centsEarned;
      day.practicedCount += 1;
      if (e.qualityScore > day.bestScore) day.bestScore = e.qualityScore;
    }
    // Pass-off day marker (passedOffAt is an ISO timestamp — take its date).
    if (piece.passedOffAt) {
      const date = piece.passedOffAt.slice(0, 10);
      const day = ensure(date);
      day.passOffs.push(piece.title);
      // If this piece also has a log entry that day, flag it as passed off.
      const match = day.entries.find((x) => x.pieceId === piece.id);
      if (match) match.passedOff = true;
    }
  }

  // Compute averages now that all entries are in.
  for (const day of Object.values(map)) {
    if (day.entries.length > 0) {
      const sum = day.entries.reduce((s, e) => s + e.qualityScore, 0);
      day.avgScore = Math.round((sum / day.entries.length) * 10) / 10;
    }
  }

  return map;
}

// A single calendar cell. `inMonth` is false for the leading/trailing days that
// pad the grid to whole weeks.
export interface CalendarCell {
  date: string;       // YYYY-MM-DD
  day: number;        // day-of-month
  inMonth: boolean;
  isWeekend: boolean; // Sat/Sun — performance days
  summary?: DaySummary;
}

// Build a month grid (array of weeks, each 7 cells, Sunday-first) for `month`
// (YYYY-MM). Fills in each day's summary from `byDay`.
export function buildMonthGrid(
  month: string,
  byDay: Record<string, DaySummary>,
): { weeks: CalendarCell[][]; monthLabel: string } {
  const [yStr, mStr] = month.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1; // 0-based

  // First of the month, and what weekday it lands on (0=Sun..6=Sat).
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const firstDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

  const cells: CalendarCell[] = [];

  // Leading padding from the previous month.
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(Date.UTC(year, monthIdx, 1 - (firstDow - i)));
    cells.push(makeCell(d, false, byDay));
  }
  // The month itself.
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, monthIdx, day));
    cells.push(makeCell(d, true, byDay));
  }
  // Trailing padding to complete the last week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.date.split('-').map(Number);
    const d = new Date(Date.UTC(ly, lm - 1, ld + 1));
    cells.push(makeCell(d, false, byDay));
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first);

  return { weeks, monthLabel };
}

// Build a grid spanning an arbitrary date RANGE (start..end inclusive),
// Sunday-first, padded to whole weeks. This is what the competition view uses:
// the whole challenge window in one continuous calendar, regardless of how many
// months it crosses. `inMonth` here means "inside the [start,end] range" — days
// padded in (or outside the window) render dimmed.
export function buildRangeGrid(
  startDate: string,
  endDate: string,
  byDay: Record<string, DaySummary>,
): { weeks: CalendarCell[][]; rangeLabel: string } {
  const start = parseUTC(startDate);
  const end = parseUTC(endDate);
  if (end.getTime() < start.getTime()) {
    return { weeks: [], rangeLabel: '' };
  }

  // Pad back to the Sunday on/before start, and forward to the Saturday
  // on/after end, so every week is full.
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay()); // back to Sunday
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay())); // fwd to Saturday

  const startMs = start.getTime();
  const endMs = end.getTime();

  const cells: CalendarCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    const ms = cursor.getTime();
    const inRange = ms >= startMs && ms <= endMs;
    cells.push(makeCell(new Date(cursor), inRange, byDay));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  const rangeLabel = `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`;

  return { weeks, rangeLabel };
}

function parseUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Totals across an arbitrary date range (inclusive) — for the competition
// header strip. Same shape as monthTotals.
export function rangeTotals(
  startDate: string,
  endDate: string,
  byDay: Record<string, DaySummary>,
): MonthTotals {
  const days = Object.values(byDay).filter((d) => d.date >= startDate && d.date <= endDate);
  const practiceDays = days.filter((d) => d.practicedCount > 0).length;
  const totalCents = days.reduce((s, d) => s + d.totalCents, 0);
  const passOffs = days.reduce((s, d) => s + d.passOffs.length, 0);
  const scored = days.filter((d) => d.avgScore > 0);
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.avgScore, 0) / scored.length) * 10) / 10
    : 0;
  return { practiceDays, totalCents, passOffs, avgScore };
}

function makeCell(d: Date, inMonth: boolean, byDay: Record<string, DaySummary>): CalendarCell {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const date = `${y}-${m}-${day}`;
  const dow = d.getUTCDay();
  return {
    date,
    day: d.getUTCDate(),
    inMonth,
    isWeekend: dow === 0 || dow === 6,
    summary: byDay[date],
  };
}

// Month-level totals for the header strip.
export interface MonthTotals {
  practiceDays: number;  // distinct days with ≥1 practice
  totalCents: number;    // MP earned in the month
  passOffs: number;      // pieces passed off in the month
  avgScore: number;      // mean of each day's avgScore (0 if none)
}

export function monthTotals(month: string, byDay: Record<string, DaySummary>): MonthTotals {
  const days = Object.values(byDay).filter((d) => d.date.startsWith(month));
  const practiceDays = days.filter((d) => d.practicedCount > 0).length;
  const totalCents = days.reduce((s, d) => s + d.totalCents, 0);
  const passOffs = days.reduce((s, d) => s + d.passOffs.length, 0);
  const scored = days.filter((d) => d.avgScore > 0);
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.avgScore, 0) / scored.length) * 10) / 10
    : 0;
  return { practiceDays, totalCents, passOffs, avgScore };
}

// Map challenge milestone dates → short marker labels, for pinning flags onto
// the right calendar cells in the competition view. Returns date → label[].
import type { MusicChallenge } from './types';

export function challengeMilestones(challenge: MusicChallenge): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (date: string | undefined, label: string) => {
    if (!date) return;
    (out[date] ??= []).push(label);
  };
  add(challenge.startDate, '🟢 Start');
  add(challenge.finishAllBy, '🏁 All done');
  add(challenge.playAllInOneDayBy, '🌟 Play all');
  add(challenge.endDate, '🎪 Camp day');
  return out;
}

// Quality → tailwind color band for a day cell. Used by the UI; kept here so
// the legend and cells stay in sync. Returns a bg + text class pair.
export function scoreColor(avgScore: number): { bg: string; text: string; label: string } {
  if (avgScore <= 0) return { bg: 'bg-gray-50', text: 'text-gray-400', label: 'none' };
  if (avgScore < 4) return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'rough' };
  if (avgScore < 7) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'okay' };
  if (avgScore < 9) return { bg: 'bg-lime-100', text: 'text-lime-700', label: 'good' };
  return { bg: 'bg-green-200', text: 'text-green-800', label: 'great!' };
}
