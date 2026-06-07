// /api/admin/sections — the learning-section kill switch.
//
//   GET  → { sections, disabled }. PUBLIC: it only reveals what's on/off, and
//          the SectionGuard on every learning page needs to read it without an
//          admin cookie. No secrets here.
//   POST → { key, enabled } toggle a single section. ADMIN-GATED via
//          isParentAuthenticated (the same mp_parent gate as the rest of the
//          admin dashboard). `key` must be in the registry.
import { NextRequest, NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import { LEARNING_SECTIONS, isValidSectionKey } from '@/lib/sections';
import { getDisabledSections, setSectionEnabled } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const disabled = await getDisabledSections();
  return NextResponse.json({ sections: LEARNING_SECTIONS, disabled });
}

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  let body: { key?: unknown; enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidSectionKey(body.key)) {
    return NextResponse.json({ error: 'Unknown section key' }, { status: 400 });
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '`enabled` must be a boolean' }, { status: 400 });
  }
  const disabled = await setSectionEnabled(body.key, body.enabled);
  return NextResponse.json({ ok: true, disabled });
}
