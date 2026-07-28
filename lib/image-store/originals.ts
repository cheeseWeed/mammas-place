// Resolving the GATED original files.
//
// The originals live at `assets/image-store/originals/` — deliberately OUTSIDE
// public/, so there is no URL that serves them and no way to guess one. The
// only path to a file is the download route, and the only path through the
// download route is an ImagePurchase row.
//
// TRAVERSAL RULE: the filename is derived from the CATALOG ENTRY, never from
// the request. A request only ever supplies an image *id*, which either matches
// a catalog row or 404s — `../../.env` is not a catalog id, so it cannot even
// reach this file. `resolveOriginalPath` is the second belt-and-braces layer:
// it basenames the catalog value (so a malformed catalog row can't escape
// either) and then re-verifies that the resolved absolute path is still inside
// the originals directory before anyone reads it.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Repo-relative home of the gated originals. Nothing is served from outside it. */
export const ORIGINALS_REL_DIR = 'assets/image-store/originals';

/** Absolute originals dir, resolved against the process CWD (the repo root). */
export function originalsDir(): string {
  return path.resolve(process.cwd(), ORIGINALS_REL_DIR);
}

/** Catalog-shaped input — only the two fields this module needs. */
export interface OriginalSource {
  sourceFile?: string | null;
  originalPath?: string | null;
}

/**
 * Absolute path to an entry's original file, or null if it would land outside
 * the originals dir.
 *
 * Steps, in order:
 *   1. Take the filename from the catalog (`sourceFile`, else the basename of
 *      `originalPath`).
 *   2. `path.basename()` it — strips any `../`, any absolute prefix, and any
 *      directory component, on both POSIX and Windows separators.
 *   3. Reject the degenerate names ('', '.', '..') that basename can return.
 *   4. Resolve against the originals dir and CONFIRM containment. Belt and
 *      braces: after step 2 nothing should escape, but the containment check
 *      is what makes that a guarantee instead of an assumption (and it survives
 *      symlink-free path tricks like a name that normalizes away).
 */
export function resolveOriginalPath(entry: OriginalSource | null | undefined): string | null {
  if (!entry) return null;

  const declared =
    (typeof entry.sourceFile === 'string' && entry.sourceFile.trim()) ||
    (typeof entry.originalPath === 'string' && entry.originalPath.trim()) ||
    '';
  if (!declared) return null;

  // Normalize Windows separators first so basename() behaves the same on POSIX.
  const fileName = path.basename(declared.replace(/\\/g, '/'));
  if (!fileName || fileName === '.' || fileName === '..') return null;
  // A resolved name must still be a plain filename — no separators survived.
  if (fileName.includes('/') || fileName.includes('\\')) return null;

  const dir = originalsDir();
  const resolved = path.resolve(dir, fileName);

  // Containment check: the resolved path must sit DIRECTLY inside the originals
  // dir. `dir + path.sep` prevents the classic sibling-prefix escape
  // (".../originals-secret/x.svg" starts with ".../originals" but is not in it).
  if (!resolved.startsWith(dir + path.sep)) return null;
  if (path.dirname(resolved) !== dir) return null;

  return resolved;
}

/** Read an original's bytes. Returns null if it is missing or unreadable. */
export async function readOriginal(entry: OriginalSource): Promise<Buffer | null> {
  const abs = resolveOriginalPath(entry);
  if (!abs) return null;
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

/**
 * Safe `Content-Disposition` filename. Header values cannot carry quotes,
 * newlines, or non-ASCII without breaking the download (or, worse, letting a
 * title inject a second header), so the title is squashed to a plain ASCII
 * slug and the real extension is taken from the catalog filename.
 */
export function downloadFileName(title: string, sourceFile: string): string {
  const ext = path.extname(sourceFile || '').replace(/[^A-Za-z0-9.]/g, '') || '.svg';
  const slug =
    String(title || '')
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mammas-place-original';
  return `${slug}${ext}`;
}

/** Content type for a served original. SVG is all we ship today. */
export function contentTypeFor(sourceFile: string): string {
  const ext = path.extname(sourceFile || '').toLowerCase();
  switch (ext) {
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}
