// GET /api/money/gift/recipients
// Kid-authed (dl_user cookie). Returns the list of OTHER learners the logged-in
// kid can send a gift to — name + displayName only (no balances, no PII). The
// caller themselves is excluded so the picker never offers a self-send.
//
// This is a minimal, self-scoped list (there's no kid-facing learner list
// elsewhere — listAllLearners is parent-gated and leaks balances), so a kid
// can pick a sibling from a dropdown instead of typing an exact username.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'dl_user';

export async function GET() {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  const rows = await prisma.driveUser.findMany({
    where: { name: { not: userKey } },
    select: { name: true, displayName: true },
    orderBy: { name: 'asc' },
  });
  const recipients = rows.map((r) => ({
    name: r.name,
    displayName: (r.displayName?.trim() || r.name).trim(),
  }));
  return NextResponse.json({ recipients });
}
