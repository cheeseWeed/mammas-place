// POST /api/money/parent/setup
// Body: { newPin, currentPin? }
// First time (no row yet): seeds the parent PIN to the well-known SEED_PARENT_PIN
//   (`mp2186`) regardless of what the caller sent. Stops a kid from secretly
//   picking a custom PIN and locking mom out.
// After: must be authenticated AND include matching currentPin to rotate.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  SEED_PARENT_PIN,
  getParentConfig,
  hashParentPin,
  isParentAuthenticated,
  isValidParentPin,
} from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  let body: { newPin?: unknown; currentPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidParentPin(body.newPin)) {
    return NextResponse.json({ error: 'New PIN must be 4-12 alphanumeric chars' }, { status: 400 });
  }

  const cfg = await getParentConfig();
  if (cfg) {
    // Must be authenticated AND know current PIN to rotate.
    if (!(await isParentAuthenticated())) {
      return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
    }
    if (!isValidParentPin(body.currentPin) || cfg.parentPinHash !== hashParentPin(body.currentPin)) {
      return NextResponse.json({ error: 'Current PIN is wrong' }, { status: 401 });
    }
    await prisma.parentConfig.update({
      where: { id: 1 },
      data: { parentPinHash: hashParentPin(body.newPin) },
    });
    return NextResponse.json({ ok: true });
  }

  // First-time setup — anyone can seed, but only to the well-known SEED PIN.
  // This stops a kid from quietly setting a custom PIN before mom logs in
  // and locking her out. Mom logs in with SEED_PARENT_PIN and rotates from
  // here using currentPin = SEED_PARENT_PIN.
  await prisma.parentConfig.create({
    data: { id: 1, parentPinHash: hashParentPin(SEED_PARENT_PIN) },
  });
  return NextResponse.json({ ok: true, firstTime: true });
}
