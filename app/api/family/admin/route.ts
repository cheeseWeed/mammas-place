// /api/family/admin — APP ADMIN only (existing mp_parent cookie).
//
// The top tier. Admin grants Parent status and sets up families; parents then
// run their own family.
//
// GET                         → all families + all users (with parent flags)
// POST { action, ... }:
//    grantParent        { username, isParent }        — flag a user as a parent
//    createFamily       { ownerUser, name }           — create a family owned by a parent
//    addParentToFamily  { familyId, username }        — add an existing parent to a family
//    removeParent       { familyId, username }        — drop a parent from a family
//    addMember          { familyId, username }        — put a (familyless) user into a family
//    moveToFamily       { familyId, username }         — relocate a user from any family into this one
//    removeMember       { familyId, username }        — remove a user from a family
//    setParentFlag is folded into grantParent

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/family/auth';
import {
  listFamiliesAndUsers,
  setParentFlag,
  createFamily,
  setFamilyParent,
  addMember,
  removeMember,
  reassignMember,
} from '@/lib/family/family';

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
    // Add an existing user as a parent (mom AND dad) of a specific family.
    // setFamilyParent both adds them to the family's parents list AND joins
    // them as a member, fixing the orphaned-parent gap where grantParent only
    // flips the isParent flag without ever assigning a family.
    case 'addParentToFamily':
    case 'removeParent': {
      const familyId = typeof body.familyId === 'string' ? body.familyId : '';
      const username = typeof body.username === 'string' ? body.username : '';
      if (!familyId || !username) return NextResponse.json({ error: 'familyId and username required' }, { status: 400 });
      const make = body.action === 'addParentToFamily';
      try {
        await setFamilyParent(familyId, username, make);
        // setFamilyParent only edits the parents list + isParent flag. On ADD
        // we also need them joined to the family. reassignMember RELOCATES them
        // even if they're currently in another family (fixes "Dad in wrong
        // family" — addMember used to silently refuse the move).
        if (make) {
          const res = await reassignMember(familyId, username);
          if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
      }
    }
    case 'addMember': {
      const familyId = typeof body.familyId === 'string' ? body.familyId : '';
      const username = typeof body.username === 'string' ? body.username : '';
      if (!familyId || !username) return NextResponse.json({ error: 'familyId and username required' }, { status: 400 });
      const res = await addMember(familyId, username);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    // Move a user into this family no matter where they are now (relocates).
    case 'moveToFamily': {
      const familyId = typeof body.familyId === 'string' ? body.familyId : '';
      const username = typeof body.username === 'string' ? body.username : '';
      if (!familyId || !username) return NextResponse.json({ error: 'familyId and username required' }, { status: 400 });
      const res = await reassignMember(familyId, username);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case 'removeMember': {
      const familyId = typeof body.familyId === 'string' ? body.familyId : '';
      const username = typeof body.username === 'string' ? body.username : '';
      if (!familyId || !username) return NextResponse.json({ error: 'familyId and username required' }, { status: 400 });
      await removeMember(familyId, username);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
