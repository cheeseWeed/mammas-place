// Job scheduling — pure functions, no DB.
//
// Turns a job's frequency + completion history into "is it done right now, or
// is it due (or overdue)?" — which drives the chart's check-off behavior:
//
//   - A job checked off today is DONE until its next due date.
//   - When the next period comes due, the check "disappears" (status flips back
//     to due) — we don't store a separate flag; we derive it from the last
//     completion date + the frequency window.
//   - A job past its due date with no fresh completion is OVERDUE and sorts to
//     the top at high priority.
//
// All deterministic given (job, today). Callers pass `todayStr` (YYYY-MM-DD);
// no Date.now() in here so it stays testable.

import type { FamilyJob, Frequency } from './types';
import { frequencyDays } from './types';

function parseUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(dateStr: string, days: number): string {
  const ms = parseUTC(dateStr) + days * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function daysBetween(aStr: string, bStr: string): number {
  return Math.round((parseUTC(bStr) - parseUTC(aStr)) / 86_400_000);
}

export type JobStatus = 'due' | 'done' | 'overdue';

export interface JobSchedule {
  status: JobStatus;
  lastDone?: string;     // YYYY-MM-DD of the most recent completion
  dueDate: string;       // YYYY-MM-DD this job is next due (or was due)
  daysUntilDue: number;  // negative = overdue by that many days
  doneToday: boolean;    // checked off on `todayStr`
}

// The most recent completion date, or undefined.
export function lastCompletion(job: FamilyJob): string | undefined {
  if (!job.completions.length) return undefined;
  return job.completions.reduce((max, c) => (c.date > max ? c.date : max), job.completions[0].date);
}

// Compute a job's schedule relative to `todayStr`.
//
// Due-date model: a job is due every `frequencyDays` days. If it's never been
// done, it's due today (status 'due'). After a completion on day D, the next
// due date is D + frequencyDays. Between D and the next due date it's 'done'.
// On/after the next due date it's 'due' again — and if today is strictly past
// it, 'overdue'.
export function scheduleFor(job: FamilyJob, todayStr: string): JobSchedule {
  const period = frequencyDays(job.frequency);
  const last = lastCompletion(job);
  const doneToday = job.completions.some((c) => c.date === todayStr);

  if (!last) {
    // Never done → due now.
    return { status: 'due', dueDate: todayStr, daysUntilDue: 0, doneToday };
  }

  const dueDate = addDays(last, period);
  const daysUntilDue = daysBetween(todayStr, dueDate);

  let status: JobStatus;
  if (daysUntilDue > 0) status = 'done';        // not due yet → the check stands
  else if (daysUntilDue === 0) status = 'due';  // due exactly today
  else status = 'overdue';                       // past due, not re-done

  return { status, lastDone: last, dueDate, daysUntilDue, doneToday };
}

// Sort key for the chart: overdue first (most overdue at the very top), then
// due, then done. Within a tier, earlier due date first. Returns a number;
// lower sorts earlier.
export function sortRank(s: JobSchedule): number {
  // Big negative for overdue (more overdue = smaller = higher), 0 for due,
  // positive for done (sooner-due first).
  if (s.status === 'overdue') return -1_000_000 + s.daysUntilDue; // daysUntilDue is negative
  if (s.status === 'due') return 0;
  return 1_000_000 + s.daysUntilDue;
}

// Does a job match a frequency filter bucket? The chart filters by
// day/week/month/quarter; map each to the frequencies that belong there.
export function matchesFrequencyBucket(f: Frequency, bucket: string): boolean {
  switch (bucket) {
    case 'all':
      return true;
    case 'daily':
      return f === 'daily';
    case 'weekly':
      return f === 'weekly' || f === 'biweekly';
    case 'monthly':
      return f === 'monthly';
    case 'quarterly':
      return f === 'quarterly' || f === 'semiannual' || f === 'yearly';
    default:
      return true;
  }
}

export { addDays, daysBetween };
