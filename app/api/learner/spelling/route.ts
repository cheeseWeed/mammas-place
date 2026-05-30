// /api/learner/spelling
//
// GET  ?user=<name>   → { spelling: SpellingProgress }   (404 if no record)
// PUT  { user, spelling }   → 200 { ok: true }
//
// Mirrors the existing /api/drive/progress pattern but stores its blob in
// the new `spelling` JSONB column on `drive_users`. The Spelling section
// owns the shape of the JSON payload — this endpoint validates only the
// envelope and persists whatever object the client sends.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);

  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { spelling: true },
  });
  if (!row) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  // Always coerce to an object so the client can safely spread the result.
  const spelling =
    row.spelling && typeof row.spelling === 'object' && !Array.isArray(row.spelling)
      ? (row.spelling as Prisma.JsonObject)
      : ({} as Prisma.JsonObject);

  return NextResponse.json({ spelling });
}

export async function PUT(req: NextRequest) {
  let body: { user?: unknown; spelling?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  if (
    !body.spelling ||
    typeof body.spelling !== 'object' ||
    Array.isArray(body.spelling)
  ) {
    return NextResponse.json(
      { error: 'spelling must be a plain object' },
      { status: 400 },
    );
  }
  const userKey = normalizeUser(body.user as string);

  // Don't auto-create — registration owns that. If the user doesn't exist,
  // surface a 404 so the caller knows to send them through the login flow.
  try {
    await prisma.driveUser.update({
      where: { name: userKey },
      data: { spelling: body.spelling as Prisma.InputJsonValue },
    });
  } catch {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
