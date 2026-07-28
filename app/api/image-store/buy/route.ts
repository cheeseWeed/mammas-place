// POST /api/image-store/buy   { imageId }
//
// Buys ONE digital original for the logged-in kid.
//
// Three things this route refuses to trust:
//   1. The PRICE — read from data/image-store.json by id (lib/image-store/
//      catalog.ts). A body price is never even parsed.
//   2. The BUYER — taken from the dl_user cookie via currentUser(), never from
//      the body, so nobody can spend another kid's MP. (The older
//      /api/money/order still accepts a body `user`; new routes don't.)
//   3. The CLIENT'S "I don't own this yet" — the DB unique constraint decides,
//      inside the same transaction as the debit.
//
// Sabbath: buying is shopping, so Sunday is a 403 exactly like
// /api/money/order. Viewing and re-downloading something already owned is NOT
// shopping and stays open — see the download route.

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/family/auth';
import { touchSession } from '@/lib/auth-touch';
import { isSabbath } from '@/lib/sabbath';
import { centsToMP } from '@/lib/money/format';
import { purchaseImage } from '@/lib/image-store/purchase';

export async function POST(req: NextRequest) {
  // Sabbath first — before we read a body or touch the DB.
  if (isSabbath(new Date(), req.headers.get('cookie') ?? '')) {
    return NextResponse.json(
      {
        error: 'The image store is closed on the Sabbath. Come back tomorrow!',
        sabbath: true,
      },
      { status: 403 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to buy artwork' }, { status: 401 });
  }
  // Slide the 8h dl_user window forward — same as the other kid-authed
  // endpoints, so browsing the store all afternoon never logs them out.
  await touchSession();

  let body: { imageId?: unknown };
  try {
    body = (await req.json()) as { imageId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.imageId !== 'string' || !body.imageId.trim()) {
    return NextResponse.json({ error: 'Which picture?' }, { status: 400 });
  }

  const result = await purchaseImage(user, body.imageId);

  switch (result.status) {
    case 'purchased':
      return NextResponse.json({
        ok: true,
        status: result.status,
        imageId: result.imageId,
        title: result.title,
        pricePaidCents: result.pricePaidCents,
        balanceCents: result.balanceCents,
        message: `${result.title} is yours! Find it in My Collection.`,
        downloadUrl: `/api/image-store/download/${encodeURIComponent(result.imageId)}`,
      });

    case 'already-owned':
      // Not a crash and not an error the kid did anything wrong — they own it,
      // and the download link is right there.
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          alreadyOwned: true,
          imageId: result.imageId,
          title: result.title,
          balanceCents: result.balanceCents,
          message: `You already own ${result.title} — it's in My Collection, and downloads are free forever.`,
          downloadUrl: `/api/image-store/download/${encodeURIComponent(result.imageId)}`,
        },
        { status: 409 },
      );

    case 'insufficient-funds':
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error: 'Insufficient funds',
          imageId: result.imageId,
          title: result.title,
          priceCents: result.priceCents,
          balanceCents: result.balanceCents,
          neededCents: result.priceCents,
          shortfallCents: result.shortfallCents,
          message: `${result.title} costs ${centsToMP(result.priceCents)} and you have ${centsToMP(
            result.balanceCents,
          )}. You need ${centsToMP(result.shortfallCents)} more — go earn it!`,
        },
        { status: 402 },
      );

    case 'unknown-image':
      return NextResponse.json(
        { ok: false, status: result.status, error: 'That picture is not in the store' },
        { status: 404 },
      );

    case 'unknown-user':
      return NextResponse.json(
        { ok: false, status: result.status, error: 'User not found' },
        { status: 404 },
      );
  }
}
