// /api/feedback
//   POST → public submission. Kid (or anyone) writes a short note from a
//          floating widget in the header. Rate-limited per IP (in-memory)
//          to keep griefers from flooding the inbox.
//   GET  → parent-gated. List feedback rows for the admin tab.
//
// Body shape (POST): { body: string, authorName?: string, page?: string }
// Body shape limits: body 1..2000 chars, authorName <=60, page <=200.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isParentAuthenticated } from '@/lib/money/parent';

export const dynamic = 'force-dynamic';

// ---- Rate limit (in-memory, mirrors /api/money/give) -------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipHits = new Map<string, number[]>();

function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const prior = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (prior.length >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((prior[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    ipHits.set(ip, prior);
    return { ok: false, retryAfterSec };
  }
  prior.push(now);
  ipHits.set(ip, prior);
  return { ok: true };
}

function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

// ---- POST: public submission -------------------------------------------
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: 'Too many feedback submissions from this address; try again later.',
        retryAfterSec: limit.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } },
    );
  }

  let body: { body?: unknown; authorName?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Feedback body is required' }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Feedback is too long (max 2000 chars)' }, { status: 400 });
  }

  const authorName =
    typeof body.authorName === 'string' && body.authorName.trim()
      ? body.authorName.trim().slice(0, 60)
      : null;
  const page =
    typeof body.page === 'string' && body.page.trim()
      ? body.page.trim().slice(0, 200)
      : null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = (await (prisma as any).feedback.create({
      data: { body: text, authorName, page, userAgent },
    })) as { id: string; createdAt: Date };
    return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---- GET: parent-gated list --------------------------------------------
// Query params:
//   status=new|read|archived|all  (default: all)
//   limit=N (default 100, max 500)
export async function GET(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'all';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));

  const where = status === 'all' ? {} : { status };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (prisma as any).feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Also tally how many are still 'new' so the admin tab can show an unread badge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newCount = await (prisma as any).feedback.count({ where: { status: 'new' } });

  return NextResponse.json({ feedback: rows, newCount });
}
