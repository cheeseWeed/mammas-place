// GET /api/image-store/download/[id]
//
// Streams the ORIGINAL artwork file — the one thing in the store that is worth
// MP. This route IS the security boundary for the whole image store:
//
//   * The originals live at assets/image-store/originals/, OUTSIDE public/, so
//     Next never serves them statically and there is no URL to guess.
//   * A request must carry a dl_user cookie (401 without it).
//   * That user must have an ImagePurchase row for this exact image (403
//     without it). No admin bypass, no "preview" escape hatch, no signed-URL
//     shortcut — one row, one check.
//   * The file path is derived from the CATALOG ENTRY, never from the URL. The
//     URL only supplies an id, and an id that is not in the catalog 404s before
//     any filesystem work happens, so `..%2f..%2f.env` never becomes a path.
//     resolveOriginalPath() then basenames the catalog value and re-verifies
//     containment inside the originals dir (lib/image-store/originals.ts).
//
// NOT Sabbath-gated, on purpose: re-downloading something you already bought is
// not shopping. Buying is (see the buy route).

import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/family/auth';
import { getImageById } from '@/lib/image-store/catalog';
import { ownsImage } from '@/lib/image-store/purchase';
import { contentTypeFor, downloadFileName, readOriginal } from '@/lib/image-store/originals';

// fs access — must run on the Node runtime, and must never be cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to download your artwork' }, { status: 401 });
  }

  const { id: rawId } = await params;
  // Catalog lookup FIRST: an unknown id can never reach the filesystem.
  const entry = getImageById(rawId);
  if (!entry) {
    return NextResponse.json({ error: 'That picture is not in the store' }, { status: 404 });
  }

  // The ownership gate. Everything below assumes it passed.
  if (!(await ownsImage(user, entry.id))) {
    return NextResponse.json(
      {
        error: "You don't own this one yet",
        message: `Buy ${entry.title} in the image store to download the original.`,
        imageId: entry.id,
      },
      { status: 403 },
    );
  }

  const bytes = await readOriginal(entry);
  if (!bytes) {
    // Either the file is missing on disk or the resolved path escaped the
    // originals dir. Both are OUR bug, not the kid's — say so plainly and do
    // not leak which one it was, or any path.
    return NextResponse.json(
      { error: 'That file is missing. Tell a grown-up and we will fix it.' },
      { status: 404 },
    );
  }

  const fileName = downloadFileName(entry.title, entry.sourceFile);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(entry.sourceFile),
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      // Entitlement-gated bytes: never let a shared/CDN cache hold them.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
