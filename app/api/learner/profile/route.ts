// /api/learner/profile
//
// GET  ?user=<name>  → LearnerSummary (404 if no record)
// PUT  { user, displayName?, ageYears?, gradeLevel? } → 200 { ok: true }
//
// This is the shared profile endpoint used by every learning section. The
// underlying row is `DriveUser` (legacy table name kept for Drive cookie
// compatibility), but profile fields and per-section progress are layered
// on top.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import type { Prisma } from '@prisma/client';

type LearnerSummary = {
  name: string;
  displayName: string;
  ageYears: number | null;
  gradeLevel: string | null;
  sections: {
    drive: { attemptCount: number; lastActive?: number };
    geography: { phasesCompleted: number; lastActive?: number };
    spelling: { level: number; lastActive?: number };
  };
};

// Local helpers — pull a number/array safely out of a JSON blob so the
// summary computation can't throw on unexpected DB shapes. Accept `unknown`
// so callers can chain (e.g. asObject(asObject(blob).nested)) without each
// hop needing to satisfy Prisma's recursive JsonValue type.
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
function asNumberOr<T>(value: unknown, fallback: T): number | T {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);

  const row = await prisma.driveUser.findUnique({ where: { name: userKey } });
  if (!row) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  const spelling = asObject(row.spelling);
  const geography = asObject(row.geography);

  const summary: LearnerSummary = {
    name: row.name,
    displayName: row.displayName ?? row.name,
    ageYears: row.ageYears ?? null,
    gradeLevel: row.gradeLevel ?? null,
    sections: {
      drive: {
        attemptCount: asArray(row.attempts).length,
        lastActive: row.updatedAt.getTime(),
      },
      geography: {
        // Geography uses opt-in sync; if/when it lands, phases is a map of
        // phase id → completion data. Count truthy entries.
        phasesCompleted: Object.values(asObject(geography.phases))
          .filter((v) => v && typeof v === 'object').length,
        lastActive: asNumberOr(geography.lastActive, undefined as number | undefined),
      },
      spelling: {
        level: asNumberOr(spelling.level, 0),
        lastActive: asNumberOr(spelling.lastSession, undefined as number | undefined),
      },
    },
  };

  return NextResponse.json(summary);
}

export async function PUT(req: NextRequest) {
  let body: {
    user?: unknown;
    displayName?: unknown;
    ageYears?: unknown;
    gradeLevel?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);

  // Build a narrow update payload — only touch fields actually supplied so a
  // caller can patch one field without nuking the rest.
  const updates: Prisma.DriveUserUpdateInput = {};
  if (typeof body.displayName === 'string') {
    const trimmed = body.displayName.trim().slice(0, 60);
    updates.displayName = trimmed.length ? trimmed : null;
  }
  if (body.ageYears === null) {
    updates.ageYears = null;
  } else if (
    typeof body.ageYears === 'number' &&
    Number.isFinite(body.ageYears) &&
    body.ageYears >= 0 &&
    body.ageYears <= 120
  ) {
    updates.ageYears = Math.floor(body.ageYears);
  }
  if (body.gradeLevel === null) {
    updates.gradeLevel = null;
  } else if (typeof body.gradeLevel === 'string') {
    const trimmed = body.gradeLevel.trim().slice(0, 16);
    updates.gradeLevel = trimmed.length ? trimmed : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  try {
    await prisma.driveUser.update({ where: { name: userKey }, data: updates });
  } catch {
    // Most likely cause: user doesn't exist (P2025). Treat as 404.
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
