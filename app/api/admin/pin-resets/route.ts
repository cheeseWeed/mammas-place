// Admin-gated PIN reset queue.
//
// GET    → list pending reset requests (kids who clicked "Forgot PIN?").
// POST   { user, newPin }   → set that kid's PIN to newPin, mark their
//                             pending request(s) resolved. Admin tells the
//                             kid the new PIN; the kid changes it themselves.
// DELETE { user }           → dismiss a kid's pending request(s) without
//                             changing anything (e.g. they remembered it).
//
// All three require the admin (mp_parent) cookie.
import { NextRequest, NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import {
  hashPin,
  isValidPin,
  isValidUser,
  normalizeUser,
  readStore,
  writeStore,
} from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  const pending = await prisma.pinResetRequest.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({
    requests: pending.map((r) => ({
      id: r.id,
      user: r.userName,
      createdAt: r.createdAt.getTime(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  let body: { user?: unknown; newPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  if (!isValidPin(body.newPin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);

  const store = await readStore();
  const record = store.users[userKey];
  if (!record) {
    return NextResponse.json({ error: 'No such user' }, { status: 404 });
  }
  record.pinHash = hashPin(body.newPin as string);
  await writeStore(store);

  await prisma.pinResetRequest.updateMany({
    where: { userName: userKey, status: 'pending' },
    data: { status: 'resolved', resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
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
  await prisma.pinResetRequest.updateMany({
    where: { userName: userKey, status: 'pending' },
    data: { status: 'dismissed', resolvedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
