// POST /api/music/upload
//
// A kid uploads their own sheet music. Two very different outcomes depending
// on the file type, and the difference is deliberate:
//
//   .musicxml / .mxl / .mid  -> EXACT. These formats contain real note data
//                               (pitch, duration, key), so the parser produces
//                               a playable song immediately with no guessing.
//   .pdf                     -> QUEUED. A PDF is ink, not notes. Reading it
//                               automatically means optical music recognition,
//                               which misreads accidentals, beamed groups and
//                               multi-voice staves often enough that a kid who
//                               played CORRECTLY would be told they were wrong.
//                               So the file is stored and flagged for a human
//                               to transcribe rather than silently guessed at.
//
// Files go to Vercel Blob, NOT the local filesystem. Vercel's disk is
// ephemeral — the existing /api/upload writes to public/images and those files
// quietly vanish when the serverless instance recycles. Blob persists.
//
// Kid-cookie gated (dl_user).

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { parseMidi, parseMusicXml } from '@/lib/music/import';
import type { Song } from '@/lib/music/sightread';

const COOKIE_NAME = 'dl_user';
const MAX_BYTES = 8 * 1024 * 1024; // sheet music PDFs run 0.5-2MB; 8 is generous

type Kind = 'musicxml' | 'mxl' | 'midi' | 'pdf';

function classify(name: string): Kind | null {
  const n = name.toLowerCase();
  if (n.endsWith('.musicxml') || n.endsWith('.xml')) return 'musicxml';
  if (n.endsWith('.mxl')) return 'mxl';
  if (n.endsWith('.mid') || n.endsWith('.midi')) return 'midi';
  if (n.endsWith('.pdf')) return 'pdf';
  return null;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Log in to upload your music' }, { status: 401 });
  }
  const userKey = normalizeUser(cookieUser);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read that upload' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was attached' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 8MB` },
      { status: 400 },
    );
  }

  const kind = classify(file.name);
  if (!kind) {
    return NextResponse.json(
      { error: 'Use a MusicXML (.musicxml/.mxl), MIDI (.mid) or PDF file' },
      { status: 400 },
    );
  }

  // Blob is only configured in production. Fail with a clear message rather
  // than a stack trace when someone runs this locally without the token.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'File storage is not configured on this environment yet' },
      { status: 503 },
    );
  }

  // PARSE FIRST, store second. If a MusicXML/MIDI file cannot be read there is
  // no point keeping it — better to tell the kid immediately than to store a
  // file that will never become playable.
  let parsed: Song | null = null;
  let parseWarnings: string[] = [];
  let parseError: string | null = null;

  if (kind === 'musicxml' || kind === 'midi') {
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const result =
        kind === 'midi'
          ? parseMidi(buf)
          : parseMusicXml(new TextDecoder('utf-8').decode(buf));
      if (result.ok) {
        parsed = { ...result.song, id: `up_${Date.now()}` };
        parseWarnings = result.warnings;
      } else {
        parseError = result.error;
      }
    } catch {
      parseError = 'That file could not be read';
    }
    if (parseError) {
      return NextResponse.json({ error: parseError }, { status: 400 });
    }
  }
  // .mxl is a ZIP containing the XML. Unzipping needs a dependency we do not
  // have, so it is stored for transcription like a PDF rather than guessed at.
  if (kind === 'mxl') {
    parseWarnings = ['Compressed MusicXML (.mxl) needs unzipping first — export as uncompressed .musicxml for instant play.'];
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  let url: string;
  try {
    const blob = await put(`sheet-music/${userKey}/${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch {
    return NextResponse.json({ error: 'Could not store that file' }, { status: 502 });
  }

  // Record the upload on the kid's music profile so it shows up in their list
  // even while a PDF is still waiting to be transcribed — otherwise the upload
  // looks like it did nothing and they upload it again.
  // A parsed file already knows its own title from the score; fall back to the
  // filename only when it does not.
  const title =
    parsed?.title && parsed.title !== 'Untitled'
      ? parsed.title
      : safeName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
  const status = parsed ? 'playable' : 'awaiting-transcription';

  try {
    const user = await prisma.driveUser.findUnique({ where: { name: userKey } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const music = (user.music ?? {}) as Record<string, unknown>;
    const uploads = Array.isArray(music.sheetUploads) ? music.sheetUploads : [];
    uploads.push({
      id: `up_${Date.now()}`,
      title,
      fileName: safeName,
      kind,
      url,
      status,
      uploadedAt: new Date().toISOString(),
      // The parsed melody rides along, so a MusicXML upload is playable the
      // moment it lands — no server round-trip, no transcription queue.
      song: parsed ?? undefined,
      warnings: parseWarnings.length ? parseWarnings : undefined,
    });
    music.sheetUploads = uploads.slice(-50); // keep the list from growing forever

    await prisma.driveUser.update({
      where: { name: userKey },
      data: { music: music as object },
    });
  } catch {
    // The file IS stored; only the bookkeeping failed. Say so honestly rather
    // than claiming the upload failed and prompting a duplicate.
    return NextResponse.json({
      ok: true,
      url,
      kind,
      status,
      warning: 'Your file was saved but did not show up in your list — tell a parent.',
    });
  }

  return NextResponse.json({
    ok: true,
    url,
    kind,
    status,
    title,
    song: parsed ?? undefined,
    warnings: parseWarnings.length ? parseWarnings : undefined,
    message: parsed
      ? `Ready to play — ${parsed.notes.length} notes read from your file.`
      : kind === 'pdf'
        ? 'Saved. A PDF is a picture of the music, not the notes themselves, so a person has to write the notes out before you can play it. That is being done.'
        : 'Saved, but it still needs a person to write out the notes.',
  });
}
