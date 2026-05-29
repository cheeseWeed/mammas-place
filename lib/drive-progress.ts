// Shared helpers for the Utah Driver License multi-user progress store.
// Backed by Neon Postgres via Prisma.
//
// The route handlers use readStore()/writeStore() which load and persist the
// full user list. For 1-10 users this is fine; if it grows, swap to per-user
// fetches.

import { createHash } from 'crypto';
import { prisma } from './prisma';

const SALT = 'utahdl-salt';

export interface QuizAttempt {
  quiz: string;
  score: number;
  total: number;
  pct: number;
  pass: boolean;
  ts: number;
}

export interface UnitScore {
  pct: number;
  ts: number;
}

export interface SrRecord {
  next_due_ts: number;
  interval_days: number;
  ease: number;
  last_seen_ts?: number;
}

export interface UserRecord {
  pinHash: string;
  createdAt: number;
  updatedAt: number;
  attempts: QuizAttempt[];
  misses: string[];
  unitScores: Record<string, UnitScore>;
  sr: Record<string, SrRecord>;
  mode: 'quick' | 'deep' | null;
  deckCompletions: Record<string, number>;
}

export interface ProgressStore {
  users: Record<string, UserRecord>;
}

export const hashPin = (pin: string): string =>
  createHash('sha256').update(pin + SALT).digest('hex');

export const normalizeUser = (raw: string): string =>
  String(raw || '').trim().toLowerCase();

// Read all users into the legacy ProgressStore shape so existing route logic
// (which mutates store.users[name] then calls writeStore) keeps working.
export async function readStore(): Promise<ProgressStore> {
  const rows = await prisma.driveUser.findMany();
  const users: Record<string, UserRecord> = {};
  for (const row of rows) {
    users[row.name] = {
      pinHash: row.pinHash,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      attempts: (row.attempts as unknown as QuizAttempt[]) ?? [],
      misses: (row.misses as unknown as string[]) ?? [],
      unitScores: (row.unitScores as unknown as Record<string, UnitScore>) ?? {},
      sr: (row.sr as unknown as Record<string, SrRecord>) ?? {},
      mode: (row.mode as 'quick' | 'deep' | null) ?? null,
      deckCompletions: (row.deckCompletions as unknown as Record<string, number>) ?? {},
    };
  }
  return { users };
}

// Persist by diffing: upsert every user currently in the store, delete users
// that are no longer present.
export async function writeStore(store: ProgressStore): Promise<void> {
  const existingRows = await prisma.driveUser.findMany({ select: { name: true } });
  const existingNames = new Set(existingRows.map((r) => r.name));
  const incomingNames = new Set(Object.keys(store.users));

  // Upsert each incoming user.
  const upserts = Object.entries(store.users).map(([name, u]) =>
    prisma.driveUser.upsert({
      where: { name },
      create: {
        name,
        pinHash: u.pinHash,
        createdAt: new Date(u.createdAt),
        attempts: u.attempts as unknown as object,
        misses: u.misses as unknown as object,
        unitScores: u.unitScores as object,
        sr: u.sr as object,
        mode: u.mode,
        deckCompletions: u.deckCompletions as object,
      },
      update: {
        pinHash: u.pinHash,
        attempts: u.attempts as unknown as object,
        misses: u.misses as unknown as object,
        unitScores: u.unitScores as object,
        sr: u.sr as object,
        mode: u.mode,
        deckCompletions: u.deckCompletions as object,
      },
    })
  );

  // Delete users that are no longer present (used by /reset).
  const deletes: string[] = [];
  for (const n of existingNames) {
    if (!incomingNames.has(n)) deletes.push(n);
  }
  const deletePromise = deletes.length
    ? prisma.driveUser.deleteMany({ where: { name: { in: deletes } } })
    : Promise.resolve();

  await Promise.all([...upserts, deletePromise]);
}

export function emptyUser(pinHash: string): UserRecord {
  const now = Date.now();
  return {
    pinHash,
    createdAt: now,
    updatedAt: now,
    attempts: [],
    misses: [],
    unitScores: {},
    sr: {},
    mode: null,
    deckCompletions: {},
  };
}

// 4-digit numeric PIN
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// Usernames: 1-30 chars, letters/numbers/space/hyphen/underscore/apostrophe.
export function isValidUser(user: unknown): user is string {
  if (typeof user !== 'string') return false;
  const trimmed = user.trim();
  if (trimmed.length < 1 || trimmed.length > 30) return false;
  return /^[A-Za-z0-9 _'\-]+$/.test(trimmed);
}
