// POST /api/money/parent/setup
// Body: { newPin, currentPin? }
// First time: any 4-digit newPin (no currentPin required).
// After: must include currentPin matching the stored hash.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
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
    return NextResponse.json({ error: 'New PIN must be 4 digits' }, { status: 400 });
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

  // First-time setup — anyone can seed, but only to the well-known 0000.
  // This stops a kid from quietly setting a custom PIN before mom logs in
  // and locking her out. Worst case = same as /parent/login's first-time
  // path: kid clicks a button, row seeds to 0000, mom logs in with 0000
  // and rotates from here using currentPin: '0000'.
  await prisma.parentConfig.create({
    data: { id: 1, parentPinHash: hashParentPin('0000') },
  });
  return NextResponse.json({ ok: true, firstTime: true });
}
