// /api/family/admin — APP ADMIN only (existing mp_parent cookie).
//
// The top tier. Admin grants Parent status and sets up families; parents then
// run their own family.
//
// GET                         → all families + all users (with parent flags)
// POST { action, ... }:
//    grantParent  { username, isParent }            — flag a user as a parent
//    createFamily { ownerUser, name }               — create a family owned by a parent
//    setParentFlag is folded into grantParent

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/family/auth';
import { listFamiliesAndUsers, setParentFlag, createFamily } from '@/lib/family/family';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  const data = await listFamiliesAndUsers();
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  switch (body.action) {
    case 'grantParent': {
      const username = typeof body.username === 'string' ? body.username : '';
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
      await setParentFlag(username, body.isParent !== false);
      return NextResponse.json({ ok: true });
    }
    case 'createFamily': {
      const ownerUser = typeof body.ownerUser === 'string' ? body.ownerUser : '';
      const name = typeof body.name === 'string' ? body.name : '';
      if (!ownerUser || !name) return NextResponse.json({ error: 'ownerUser and name required' }, { status: 400 });
      try {
        const id = await createFamily(ownerUser, name);
        return NextResponse.json({ ok: true, familyId: id });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
      }
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
