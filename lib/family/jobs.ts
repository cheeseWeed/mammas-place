// Family chore jobs — server-only read/write of the `jobs` blob on Family,
// plus check-off (MP credit), take-points (claw back), and redeem (debit).
//
// Reuses the MP ledger (lib/money/balance.ts credit/debit) so chore earnings
// and redemptions land in the same wallet + transaction log as everything else.

import 'server-only';
import { randomUUID } from 'crypto';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { credit, debit, InsufficientFundsError } from '../money/balance';
import {
  coerceJobs,
  DEFAULT_MP_BY_FREQUENCY,
  type FamilyJob,
  type Frequency,
} from './types';

function newId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

async function readJobs(familyId: string): Promise<FamilyJob[]> {
  const fam = await prisma.family.findUnique({ where: { id: familyId }, select: { jobs: true } });
  if (!fam) throw new Error('Family not found');
  return coerceJobs(fam.jobs);
}

async function writeJobs(familyId: string, jobs: FamilyJob[]): Promise<void> {
  await prisma.family.update({ where: { id: familyId }, data: { jobs: jobs as unknown as object } });
}

// ----- job CRUD (parent) -----

export interface AddJobInput {
  name: string;
  room: string;
  frequency: Frequency;
  mp?: number;          // override; defaults to DEFAULT_MP_BY_FREQUENCY[frequency]
  emoji?: string;
  assignedTo?: string;
  notes?: string;
}

export async function addJob(familyId: string, input: AddJobInput): Promise<FamilyJob> {
  const jobs = await readJobs(familyId);
  const job: FamilyJob = {
    id: newId(),
    name: input.name.trim().slice(0, 120),
    room: input.room.trim().slice(0, 60) || 'General',
    frequency: input.frequency,
    mp: Number.isFinite(input.mp) && (input.mp as number) >= 0
      ? Math.round(input.mp as number)
      : DEFAULT_MP_BY_FREQUENCY[input.frequency],
    emoji: input.emoji?.trim() || undefined,
    assignedTo: input.assignedTo ? normalizeUser(input.assignedTo) : undefined,
    notes: input.notes?.trim().slice(0, 200) || undefined,
    createdAt: new Date().toISOString(),
    completions: [],
  };
  jobs.push(job);
  await writeJobs(familyId, jobs);
  return job;
}

export async function updateJob(
  familyId: string,
  jobId: string,
  patch: Partial<AddJobInput> & { archived?: boolean },
): Promise<FamilyJob | null> {
  const jobs = await readJobs(familyId);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return null;
  if (patch.name !== undefined) job.name = patch.name.trim().slice(0, 120);
  if (patch.room !== undefined) job.room = patch.room.trim().slice(0, 60) || 'General';
  if (patch.frequency !== undefined) job.frequency = patch.frequency;
  if (patch.mp !== undefined && Number.isFinite(patch.mp)) job.mp = Math.max(0, Math.round(patch.mp));
  if (patch.emoji !== undefined) job.emoji = patch.emoji?.trim() || undefined;
  if (patch.assignedTo !== undefined) job.assignedTo = patch.assignedTo ? normalizeUser(patch.assignedTo) : undefined;
  if (patch.notes !== undefined) job.notes = patch.notes?.trim().slice(0, 200) || undefined;
  if (patch.archived !== undefined) job.archived = patch.archived;
  await writeJobs(familyId, jobs);
  return job;
}

export async function deleteJob(familyId: string, jobId: string): Promise<boolean> {
  const jobs = await readJobs(familyId);
  const next = jobs.filter((j) => j.id !== jobId);
  if (next.length === jobs.length) return false;
  await writeJobs(familyId, next);
  return true;
}

// ----- check off (member) -----

export type CheckOffResult =
  | { ok: true; centsEarned: number; balanceCents: number; job: FamilyJob }
  | { ok: true; centsEarned: 0; alreadyDone: true; job: FamilyJob }
  | { ok: false; error: string };

// A member checks off a job today. Credits the job's MP to the doer, records
// the completion, and writes the ledger. Idempotent per (job, day): a second
// check-off the same day is a no-op (no double pay). MP is credited
// immediately — no parent approval.
export async function checkOffJob(
  familyId: string,
  jobId: string,
  rawUser: string,
  todayStr: string,
): Promise<CheckOffResult> {
  const doer = normalizeUser(rawUser);
  const jobs = await readJobs(familyId);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job not found' };
  if (job.archived) return { ok: false, error: 'Job is archived' };

  if (job.completions.some((c) => c.date === todayStr)) {
    return { ok: true, centsEarned: 0, alreadyDone: true, job };
  }

  const cents = Math.max(0, Math.round(job.mp)) * 100;
  job.completions.push({ date: todayStr, by: doer, centsAwarded: cents });
  await writeJobs(familyId, jobs);

  if (cents > 0) {
    const balanceCents = await credit(doer, cents, 'earn', `Chore: ${job.name}`);
    return { ok: true, centsEarned: cents, balanceCents, job };
  }
  const row = await prisma.driveUser.findUnique({ where: { name: doer }, select: { balanceCents: true } });
  return { ok: true, centsEarned: 0, balanceCents: row?.balanceCents ?? 0, job } as CheckOffResult;
}

// Undo today's check-off (kid mis-tapped). Removes today's completion and
// claws back exactly what was awarded for it.
export async function undoCheckOff(
  familyId: string,
  jobId: string,
  rawUser: string,
  todayStr: string,
): Promise<{ ok: boolean; error?: string }> {
  const doer = normalizeUser(rawUser);
  const jobs = await readJobs(familyId);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job not found' };
  const idx = job.completions.findIndex((c) => c.date === todayStr && c.by === doer);
  if (idx === -1) return { ok: false, error: 'No check-off to undo today' };
  const removed = job.completions.splice(idx, 1)[0];
  await writeJobs(familyId, jobs);
  if (removed.centsAwarded > 0) {
    try {
      await debit(doer, removed.centsAwarded, 'adjust', `Undo chore: ${job.name}`);
    } catch (err) {
      if (!(err instanceof InsufficientFundsError)) throw err;
      // If they already spent it, the balance just goes as far as it can — but
      // debit() throws on insufficient funds, so re-add the completion to stay
      // consistent and report.
      job.completions.splice(idx, 0, removed);
      await writeJobs(familyId, jobs);
      return { ok: false, error: 'Already spent — can’t undo. Ask a parent to adjust.' };
    }
  }
  return { ok: true };
}

// ----- take points (parent claw-back) -----

// A parent docks MP from a member — e.g. a job done poorly. `mp` is the amount
// in whole MP; the UI typically passes 2× the job value for a poor job. Free
// reason. Debits immediately (clamped to available balance — never negative).
export async function takePoints(
  rawUser: string,
  mp: number,
  reason: string,
): Promise<{ ok: boolean; error?: string; balanceCents?: number; tookCents?: number }> {
  const name = normalizeUser(rawUser);
  const wantCents = Math.max(0, Math.round(mp)) * 100;
  if (wantCents <= 0) return { ok: false, error: 'Amount must be positive' };
  const row = await prisma.driveUser.findUnique({ where: { name }, select: { balanceCents: true } });
  if (!row) return { ok: false, error: 'User not found' };
  // Clamp to what they have — taking points can't push negative.
  const cents = Math.min(wantCents, row.balanceCents);
  if (cents <= 0) return { ok: true, balanceCents: 0, tookCents: 0 };
  const balanceCents = await debit(name, cents, 'adjust', reason.trim().slice(0, 120) || 'Points taken');
  return { ok: true, balanceCents, tookCents: cents };
}

// ----- redeem (member, external reward) -----

// Fun lines shown on redeem. Picked by index (no Math.random — varies by the
// redemption count so it's deterministic per call site).
const REDEEM_LINES = [
  'Have fun! 🎉',
  'Break a leg! 🦵',
  'Go get ’em! 💪',
  'Enjoy every bit of it! 🍦',
  'You earned it! ⭐',
  'Treat yourself! 🎁',
  'Make it count! 🌟',
  'Knock ’em dead! 🎬',
  'Live it up! 🎈',
  'Worth every point! 💯',
];

export interface RedeemResult {
  ok: boolean;
  error?: string;
  balanceCents?: number;
  funMessage?: string;
}

// A kid redeems MP for an external thing. Debits immediately (can't overspend),
// logs it to the family's Redemption table so parents can SEE what was spent,
// and returns a fun message. No approval — the real-world OK is in person.
export async function redeem(
  familyId: string,
  rawUser: string,
  mp: number,
  reward: string,
): Promise<RedeemResult> {
  const name = normalizeUser(rawUser);
  const cents = Math.max(0, Math.round(mp)) * 100;
  const rewardText = reward.trim().slice(0, 120);
  if (cents <= 0) return { ok: false, error: 'How much do you want to redeem?' };
  if (!rewardText) return { ok: false, error: 'What are you redeeming for?' };

  // Pick a fun line by the current redemption count (deterministic, varied).
  const count = await prisma.redemption.count({ where: { userName: name } });
  const funMessage = REDEEM_LINES[count % REDEEM_LINES.length];

  try {
    const balanceCents = await debit(name, cents, 'spend', `Redeemed: ${rewardText}`);
    await prisma.redemption.create({
      data: { familyId, userName: name, cents, reward: rewardText, funMessage },
    });
    return { ok: true, balanceCents, funMessage };
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return { ok: false, error: `Not enough MP — you have ${(err.balanceCents / 100)} MP.` };
    }
    throw err;
  }
}

// Recent redemptions for a family (parent view) or one user.
export async function listRedemptions(familyId: string, limit = 100) {
  return prisma.redemption.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ----- catalog load (parent) -----

// Load the merged starter catalog (lib/family/catalog.ts) into a family's job
// list. Skips jobs that already exist (matched by room+name, case-insensitive)
// so it's safe to re-run / top-up. MP defaults from each job's frequency.
export async function loadCatalog(familyId: string): Promise<{ added: number; skipped: number }> {
  const { CHORE_CATALOG } = await import('./catalog');
  const jobs = await readJobs(familyId);
  const have = new Set(jobs.map((j) => `${j.room.toLowerCase()}|${j.name.toLowerCase()}`));
  let added = 0;
  let skipped = 0;
  for (const c of CHORE_CATALOG) {
    const key = `${c.room.toLowerCase()}|${c.name.toLowerCase()}`;
    if (have.has(key)) { skipped++; continue; }
    have.add(key);
    jobs.push({
      id: newId(),
      name: c.name,
      room: c.room,
      frequency: c.frequency,
      mp: DEFAULT_MP_BY_FREQUENCY[c.frequency],
      createdAt: new Date().toISOString(),
      completions: [],
    });
    added++;
  }
  if (added > 0) await writeJobs(familyId, jobs);
  return { added, skipped };
}

export { readJobs };
