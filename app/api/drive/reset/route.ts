// POST /api/drive/reset
// Body: { user: string }
// NON-DESTRUCTIVE. Files an "I forgot my PIN" request for the admin to handle.
// It NEVER deletes the account or its progress. The admin sees pending
// requests on the MP Bank dashboard, sets a new PIN, and tells the kid; the
// kid then logs in and can change it from the "Change PIN" spot.
//
// (Replaces the old flow that wiped the user record entirely.)
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  let body: { user?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);

  // Collapse duplicates: if this kid already has a pending request, don't
  // pile on another — just report it's already waiting.
  const existing = await prisma.pinResetRequest.findFirst({
    where: { userName: userKey, status: 'pending' },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyPending: true });
  }

  await prisma.pinResetRequest.create({
    data: { userName: userKey, status: 'pending' },
  });

  return NextResponse.json({ ok: true });
}
