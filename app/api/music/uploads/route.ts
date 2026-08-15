// GET /api/music/uploads
//
// Lists the sheet music this kid has uploaded, with its status.
//
// This exists because of a real bug: uploads were being WRITTEN and never
// READ. Shepherd uploaded the same PDF three times in nine minutes — each
// upload succeeded, and then vanished from his view, so of course he assumed
// it had failed. A kid needs to see that their file arrived, and what is
// happening to it, or they will keep trying.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';

const COOKIE_NAME = 'dl_user';

export async function GET() {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Log in to see your uploads' }, { status: 401 });
  }
  const userKey = normalizeUser(cookieUser);

  try {
    const user = await prisma.driveUser.findUnique({
      where: { name: userKey },
      select: { music: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const music = (user.music ?? {}) as Record<string, unknown>;
    const rawAll = Array.isArray(music.sheetUploads) ? music.sheetUploads : [];

    // DEDUPE by filename, newest wins. Uploads were invisible until now, so
    // kids re-uploaded the same file repeatedly assuming it had failed —
    // Shepherd sent the same PDF six times and one MIDI three times. Showing
    // every copy is just noise now that the list is visible.
    const seen = new Set<string>();
    const raw: unknown[] = [];
    for (let i = rawAll.length - 1; i >= 0; i--) {
      const u = rawAll[i] as Record<string, unknown>;
      const key = String(u.fileName ?? u.title ?? i).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      raw.unshift(u);
    }

    // The blob URL is deliberately NOT returned: the store is private, so the
    // URL is useless to the browser anyway, and there is no reason to hand a
    // storage path to the client.
    const uploads = raw
      .map((u) => u as Record<string, unknown>)
      .map((u) => ({
        id: String(u.id ?? ''),
        title: String(u.title ?? 'Untitled'),
        fileName: String(u.fileName ?? ''),
        kind: String(u.kind ?? ''),
        status: String(u.status ?? ''),
        uploadedAt: String(u.uploadedAt ?? ''),
        noteCount: Array.isArray((u.song as { notes?: unknown[] } | undefined)?.notes)
          ? ((u.song as { notes: unknown[] }).notes.length)
          : null,
        warnings: Array.isArray(u.warnings) ? (u.warnings as string[]) : [],
        // The parsed melody itself, so an uploaded song is actually PLAYABLE.
        // Without this the file said "ready to play" and then could not be
        // chosen anywhere — the parse was stored and never used.
        song: (u.song as unknown) ?? null,
      }))
      .reverse(); // newest first

    return NextResponse.json({ ok: true, uploads });
  } catch {
    return NextResponse.json({ error: 'Could not load your uploads' }, { status: 500 });
  }
}
