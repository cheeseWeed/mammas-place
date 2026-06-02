// Family Chores — data model.
//
// A Family (Prisma `families` table) owns a chore chart: an array of FamilyJob
// stored in the `jobs` JSON column. Server-only read/write is in
// lib/family/jobs.ts. Keep this file free of server imports — it's shared with
// client components.
//
// Design notes:
//   - A *job* is one recurring chore: a name, a room, a frequency (which sets
//     how often it's due AND a default MP value), an optional assignee, and a
//     completion history.
//   - *Due dates* are computed from frequency + the last completion (see
//     lib/family/schedule.ts). A check-off records a completion; it "resets"
//     (the check disappears) when the next period comes due. An overdue job
//     (past due, not done) sorts to the top at high priority.
//   - MP is credited on check-off automatically (no approval). A parent can
//     take points back later (claw back, ×2 for a poorly-done job).

// ----- Frequencies -----

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

export const FREQUENCIES: { value: Frequency; label: string; days: number }[] = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Bi-weekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
  { value: 'quarterly', label: 'Quarterly', days: 91 },
  { value: 'semiannual', label: 'Semi-annual', days: 182 },
  { value: 'yearly', label: 'Yearly', days: 365 },
];

// "Bigger jobs get more." Default MP by frequency — rarer = bigger payout.
// Parents can override per job. Kept here so seed + UI agree.
export const DEFAULT_MP_BY_FREQUENCY: Record<Frequency, number> = {
  daily: 5,
  weekly: 15,
  biweekly: 25,
  monthly: 50,
  quarterly: 100,
  semiannual: 150,
  yearly: 200,
};

export function frequencyDays(f: Frequency): number {
  return FREQUENCIES.find((x) => x.value === f)?.days ?? 7;
}

export function frequencyLabel(f: Frequency): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

// ----- Completion -----

export interface JobCompletion {
  date: string;      // YYYY-MM-DD (family-local) the job was checked off
  by: string;        // username who did it (normalized)
  centsAwarded: number; // MP credited for this completion
}

// ----- Job -----

export interface FamilyJob {
  id: string;
  name: string;            // "Oil change - van"
  room: string;            // "Cars" | "Kitchen" | "Garage" | ...
  frequency: Frequency;
  mp: number;              // MP awarded per completion (whole MP, not cents)
  emoji?: string;          // optional leading emoji
  assignedTo?: string;     // username, or undefined = anyone
  notes?: string;
  createdAt: string;       // ISO
  archived?: boolean;
  // Completion history, newest-last. The most recent completion's date + the
  // frequency determine whether the job is currently "done" or due again.
  completions: JobCompletion[];
}

// Distinct rooms in a job list, in first-seen order (for filter chips).
export function roomsOf(jobs: FamilyJob[]): string[] {
  const seen: string[] = [];
  for (const j of jobs) if (!j.archived && !seen.includes(j.room)) seen.push(j.room);
  return seen;
}

// Coerce the raw JSON column into a typed job array.
export function coerceJobs(raw: unknown): FamilyJob[] {
  if (!Array.isArray(raw)) return [];
  return raw as FamilyJob[];
}

// Coerce the parents JSON column.
export function coerceParents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => typeof x === 'string') as string[];
}
