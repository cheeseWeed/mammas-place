// Family management — server-only.
//
// Create a family, manage its parents (granted isParent by Admin) and members,
// and the membership checks the chore chart + parent section gate on.
//
// A user must have DriveUser.isParent = true (set by Admin) AND be listed in
// the family's `parents` array to MANAGE that family. Any user with a matching
// familyId is a MEMBER (can see the chart + check off jobs).

import 'server-only';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { coerceParents } from './types';

export interface FamilyView {
  id: string;
  name: string;
  parents: string[];
  members: { name: string; displayName: string | null; isParent: boolean; balanceCents: number }[];
}

// Admin: flag / unflag a user as a parent (the grant that lets them own a
// family). Pure DriveUser update — does not create a family.
export async function setParentFlag(rawUser: string, isParent: boolean): Promise<void> {
  const name = normalizeUser(rawUser);
  await prisma.driveUser.update({ where: { name }, data: { isParent } });
}

// Create a family owned by `ownerUser` (must already be isParent). The owner is
// added to the parents list and joined as a member. Returns the family id.
export async function createFamily(ownerUser: string, familyName: string): Promise<string> {
  const owner = normalizeUser(ownerUser);
  const user = await prisma.driveUser.findUnique({ where: { name: owner }, select: { isParent: true } });
  if (!user) throw new Error('User not found');
  if (!user.isParent) throw new Error('Only a parent (granted by Admin) can create a family');

  const family = await prisma.family.create({
    data: {
      name: familyName.trim().slice(0, 80) || 'My Family',
      parents: [owner],
      jobs: [],
    },
    select: { id: true },
  });
  // Join the owner to the family.
  await prisma.driveUser.update({ where: { name: owner }, data: { familyId: family.id } });
  return family.id;
}

// Is this user a manager (parent) of the given family?
export async function isFamilyParent(rawUser: string, familyId: string): Promise<boolean> {
  const name = normalizeUser(rawUser);
  const fam = await prisma.family.findUnique({ where: { id: familyId }, select: { parents: true } });
  if (!fam) return false;
  return coerceParents(fam.parents).includes(name);
}

// The family a user belongs to (member or parent), or null.
export async function familyOf(rawUser: string): Promise<string | null> {
  const name = normalizeUser(rawUser);
  const u = await prisma.driveUser.findUnique({ where: { name }, select: { familyId: true } });
  return u?.familyId ?? null;
}

// Add an existing user (by username) as a member of a family. Invite-by-name —
// no codes. Caller must already be verified as a parent of `familyId`.
export async function addMember(familyId: string, rawUser: string): Promise<{ ok: boolean; error?: string }> {
  const name = normalizeUser(rawUser);
  const user = await prisma.driveUser.findUnique({ where: { name }, select: { name: true, familyId: true } });
  if (!user) return { ok: false, error: `No user named "${name}". They need to register first.` };
  if (user.familyId && user.familyId !== familyId) {
    return { ok: false, error: `${name} is already in another family.` };
  }
  await prisma.driveUser.update({ where: { name }, data: { familyId } });
  return { ok: true };
}

// Remove a member from a family (also drops them from parents if present).
export async function removeMember(familyId: string, rawUser: string): Promise<void> {
  const name = normalizeUser(rawUser);
  await prisma.driveUser.update({ where: { name }, data: { familyId: null } });
  const fam = await prisma.family.findUnique({ where: { id: familyId }, select: { parents: true } });
  if (fam) {
    const parents = coerceParents(fam.parents).filter((p) => p !== name);
    await prisma.family.update({ where: { id: familyId }, data: { parents } });
  }
}

// Grant/revoke parent-of-this-family (adds to the family's parents list AND
// flips the user's isParent flag so they can actually manage). Used so a
// family can have mom AND dad.
export async function setFamilyParent(familyId: string, rawUser: string, makeParent: boolean): Promise<void> {
  const name = normalizeUser(rawUser);
  const fam = await prisma.family.findUnique({ where: { id: familyId }, select: { parents: true } });
  if (!fam) throw new Error('Family not found');
  const parents = new Set(coerceParents(fam.parents));
  if (makeParent) parents.add(name);
  else parents.delete(name);
  await prisma.family.update({ where: { id: familyId }, data: { parents: [...parents] } });
  await prisma.driveUser.update({ where: { name }, data: { isParent: makeParent } });
}

// Full view of a family — its parents + members with balances. For the parent
// section + admin.
export async function getFamilyView(familyId: string): Promise<FamilyView | null> {
  const fam = await prisma.family.findUnique({ where: { id: familyId } });
  if (!fam) return null;
  const members = await prisma.driveUser.findMany({
    where: { familyId },
    select: { name: true, displayName: true, isParent: true, balanceCents: true },
    orderBy: { name: 'asc' },
  });
  return {
    id: fam.id,
    name: fam.name,
    parents: coerceParents(fam.parents),
    members,
  };
}

// Admin helper: list every family + size, and every user with their parent
// flag, so the Admin can assign parents and see the family map.
export async function listFamiliesAndUsers() {
  const [families, users] = await Promise.all([
    prisma.family.findMany({ select: { id: true, name: true, parents: true }, orderBy: { name: 'asc' } }),
    prisma.driveUser.findMany({
      select: { name: true, displayName: true, isParent: true, familyId: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return {
    families: families.map((f) => ({ id: f.id, name: f.name, parents: coerceParents(f.parents) })),
    users,
  };
}
