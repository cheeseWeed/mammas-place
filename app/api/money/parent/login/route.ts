// POST /api/money/parent/login
// Body: { pin }
// If no parent config exists yet AND pin is "0000", auto-seeds it (first-time setup).
// Otherwise compares against the stored hash.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  SEED_PARENT_PIN,
  getParentConfig,
  hashParentPin,
  isValidParentPin,
  setParentCookie,
} from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  let body: { pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidParentPin(body.pin)) {
    return NextResponse.json({ error: 'PIN must be 4-12 alphanumeric chars' }, { status: 400 });
  }

  const cfg = await getParentConfig();
  if (!cfg) {
    if (body.pin !== SEED_PARENT_PIN) {
      return NextResponse.json(
        { error: `Parent PIN not set yet. Use ${SEED_PARENT_PIN} for first-time setup.` },
        { status: 401 },
      );
    }
    await prisma.parentConfig.create({
      data: { id: 1, parentPinHash: hashParentPin(SEED_PARENT_PIN) },
    });
    await setParentCookie();
    return NextResponse.json({ ok: true, firstTime: true });
  }

  if (cfg.parentPinHash !== hashParentPin(body.pin)) {
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
  }
  await setParentCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { clearParentCookie } = await import('@/lib/money/parent');
  await clearParentCookie();
  return NextResponse.json({ ok: true });
}
