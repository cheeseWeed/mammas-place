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
//     URL only supplies an id; it can never name a file, so `..%2f..%2f.env`
//     cannot become a path — it is simply an id that no catalog row and no
//     ImagePurchase row matches. resolveOriginalPath() then basenames the
//     catalog value and re-verifies containment inside the originals dir
//     (lib/image-store/originals.ts).
//
// CHECK ORDER: ownership is decided BEFORE the catalog is consulted. The
// ImagePurchase row is what a kid paid for and /portal/collection renders a
// Download button for every row it finds — catalog entry or not — because
// "downloads are free forever" is a promise about the PURCHASE, not about the
// shelf. Looking the id up in the catalog first inverted that: retire a piece
// and its owner's button started answering "that picture is not in the store",
// which reads as "you never owned it". An owner now only ever hears about the
// FILE, never about their entitlement.
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

  // THE GATE, first. A DB lookup keyed by (userName, imageId) — no filesystem,
  // no admin bypass. An id that matches nothing simply comes back false.
  const owned = await ownsImage(user, rawId);

  // Metadata + the ONLY source of a file path. Looked up after the gate, so an
  // unknown id still never reaches the filesystem: `readOriginal` below is only
  // ever handed a catalog entry.
  const entry = getImageById(rawId);

  if (!owned) {
    if (!entry) {
      return NextResponse.json({ error: 'That picture is not in the store' }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "You don't own this one yet",
        message: `Buy ${entry.title} in the image store to download the original.`,
        imageId: entry.id,
      },
      { status: 403 },
    );
  }

  // Past this line the kid OWNS this piece. Every remaining failure is OUR
  // problem and must never be phrased as "you don't own it" or "it isn't real".
  const bytes = entry ? await readOriginal(entry) : null;
  if (!entry || !bytes) {
    // Three ways to land here, all ours: the catalog row was deleted (so we no
    // longer know which file this piece is), the file is gone from disk, or the
    // resolved path failed the containment re-check. Don't leak which one, and
    // don't leak a path — but DO make it unmistakable that the purchase still
    // stands. 410 Gone, not 404: the piece existed and is theirs, the bytes are
    // what's unavailable.
    return NextResponse.json(
      {
        error: "You own this one — we just can't find the picture file right now.",
        message:
          'Your purchase is safe and it stays in your collection. Tell a grown-up and we will put the file back.',
        // Safe to echo: ownership passed, so this id matched a real
        // ImagePurchase row of ours — it is not just whatever the URL said.
        imageId: entry?.id ?? rawId.trim(),
        owned: true,
      },
      { status: 410 },
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
