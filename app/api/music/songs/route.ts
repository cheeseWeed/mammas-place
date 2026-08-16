// POST /api/music/songs
//
// Saves a song a kid wrote by hand in the Music Writer.
//
// It lands in the SAME music.sheetUploads array that imported files use, so a
// written song shows up in the Note Reader picker next to an uploaded one with
// no second code path to keep in sync. status is 'ready' immediately — there is
// nothing to transcribe, the kid already entered the notes.
//
// The server VALIDATES every note rather than trusting the posted shape. The
// Note Reader clamps earned MP against the song it looks up server-side, so a
// song with 50,000 notes posted here would become a way to mint MP. Length and
// pitch limits close that.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import type { SongNote } from '@/lib/music/sightread';

const COOKIE_NAME = 'dl_user';

/** A real piece a child writes is well under this. Anything larger is abuse. */
const MAX_NOTES = 2000;

function sanitizeNotes(input: unknown): SongNote[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_NOTES) return null;

  const out: SongNote[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const n = raw as Record<string, unknown>;

    const midi = Number(n.midi);
    const beats = Number(n.beats);
    if (!Number.isFinite(midi) || midi < 21 || midi > 108) return null;
    if (!Number.isFinite(beats) || beats <= 0 || beats > 16) return null;

    const note: SongNote = { midi: Math.round(midi), beats };
    // Markings are display/playback only and never scored, so they are copied
    // through as plain booleans without further meaning attached.
    if (n.rest) note.rest = true;
    if (n.staccato) note.staccato = true;
    if (n.accent) note.accent = true;
    if (n.fermata) note.fermata = true;
    if (n.slurToNext) note.slurToNext = true;
    if (typeof n.dynamic === 'string' && ['pp', 'p', 'mp', 'mf', 'f', 'ff'].includes(n.dynamic)) {
      note.dynamic = n.dynamic as SongNote['dynamic'];
    }
    out.push(note);
  }
  return out;
}

export async function POST(req: Request) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Log in to save a song' }, { status: 401 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read that song' }, { status: 400 });
  }

  const notes = sanitizeNotes(body.notes);
  if (!notes) {
    return NextResponse.json({ error: 'That song has no usable notes' }, { status: 400 });
  }

  const title = String(body.title ?? '').trim().slice(0, 80) || 'My song';
  const bpmRaw = Number(body.bpm);
  const bpm = Number.isFinite(bpmRaw) ? Math.max(30, Math.min(240, Math.round(bpmRaw))) : 80;
  const clef = ['treble', 'bass', 'grand'].includes(String(body.clef)) ? String(body.clef) : 'treble';
  const level = ['starter', 'easy', 'medium', 'hard'].includes(String(body.level))
    ? String(body.level)
    : 'easy';

  try {
    const user = await prisma.driveUser.findUnique({
      where: { name: userKey },
      select: { music: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const music = (user.music ?? {}) as Record<string, unknown>;
    const uploads = Array.isArray(music.sheetUploads) ? [...music.sheetUploads] : [];

    const id = `written-${userKey}-${Date.now()}`;
    uploads.push({
      id,
      title,
      fileName: `${title}.written`,
      kind: 'written',
      status: 'ready',
      uploadedAt: new Date().toISOString(),
      song: { id, title, source: 'transcribed', bpm, clef, level, notes },
    });

    await prisma.driveUser.update({
      where: { name: userKey },
      data: { music: { ...music, sheetUploads: uploads } },
    });

    return NextResponse.json({ ok: true, id, notes: notes.length });
  } catch {
    return NextResponse.json({ error: 'Could not save that song' }, { status: 500 });
  }
}
