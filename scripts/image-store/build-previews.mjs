// Image Store — watermarked preview builder.
//
// Reads `data/image-store.json` and, for every catalog entry, rasterizes the
// gated original SVG to a PNG and stamps a repeating diagonal "Mamma's Place"
// watermark across it. Previews land in `public/image-store/previews/<id>.png`
// (publicly served — that is the point); the ORIGINALS live outside `public/`
// in `assets/image-store/originals/` so they can never be fetched by URL. A
// kid who pays MP gets the original through a server route; everyone else only
// ever sees the watermarked raster.
//
// The watermark is NON-DESTRUCTIVE: nothing is written back over the source
// SVG. It only exists in the generated PNG, which is fully disposable.
//
// Usage:
//   node scripts/image-store/build-previews.mjs           # incremental
//   node scripts/image-store/build-previews.mjs --force    # rebuild everything
//   node scripts/image-store/build-previews.mjs arch-ball-001 mis-bow-002
//
// Idempotent: same inputs produce byte-identical output, and an entry is
// skipped entirely when its PNG is newer than both the source SVG and this
// script. Safe to re-run any number of times.
//
// NOTE: this is a BUILD-TIME tool meant to be run on a developer machine (the
// generated PNGs are committed). It renders text through librsvg/fontconfig,
// so it needs the system fonts listed in FONT_STACK to be installed.

import sharp from 'sharp';
import { readFile, writeFile, mkdir, stat, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

const CATALOG_PATH = join(REPO_ROOT, 'data/image-store.json');
const PREVIEW_DIR = join(REPO_ROOT, 'public/image-store/previews');
const LEGACY_PUBLIC_IMAGES = join(REPO_ROOT, 'public/images');

// ---- Render settings ---------------------------------------------------
const PREVIEW_WIDTH = 800;   // px, longest edge target for the rasterized art
const RASTER_DENSITY = 240;  // DPI handed to librsvg before the downscale
const FONT_STACK = 'Arial, Helvetica, Verdana, sans-serif';

// ---- Watermark settings ------------------------------------------------
const WM_TEXT = "Mamma's Place";
const WM_ANGLE = -30;        // degrees; negative = bottom-left to top-right
const WM_FONT_SIZE = 26;
const WM_STEP_X = 260;       // horizontal spacing between tiled stamps
const WM_STEP_Y = 120;       // vertical spacing between tiled rows
const WM_FILL_OPACITY = 0.34;
const WM_STROKE_OPACITY = 0.22;
const BANNER_HEIGHT = 34;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the watermark overlay as an SVG sized to the rasterized art.
 *
 * Two layers, both semi-transparent so the artwork stays readable:
 *   1. a tiled grid of rotated "Mamma's Place" stamps in white with a dark
 *      outline, so it survives on both light and dark art;
 *   2. a bottom banner reading "PREVIEW - <id>" that identifies the piece.
 */
function watermarkSvg(width, height, id) {
  const stamps = [];
  // Overscan the grid so the rotated text still covers the corners.
  const startX = -Math.round(width * 0.5);
  const endX = Math.round(width * 1.5);
  const startY = -Math.round(height * 0.25);
  const endY = Math.round(height * 1.25);

  let row = 0;
  for (let y = startY; y <= endY; y += WM_STEP_Y) {
    // Offset every other row so the tiling does not read as rigid columns.
    const offset = row % 2 === 0 ? 0 : Math.round(WM_STEP_X / 2);
    for (let x = startX + offset; x <= endX; x += WM_STEP_X) {
      stamps.push(
        `<text x="${x}" y="${y}" transform="rotate(${WM_ANGLE} ${x} ${y})" ` +
        `font-family="${FONT_STACK}" font-size="${WM_FONT_SIZE}" font-weight="bold" ` +
        `fill="#ffffff" fill-opacity="${WM_FILL_OPACITY}" ` +
        `stroke="#1f2937" stroke-width="1" stroke-opacity="${WM_STROKE_OPACITY}" ` +
        `letter-spacing="1.5">${escapeXml(WM_TEXT)}</text>`
      );
    }
    row++;
  }

  const bannerY = height - BANNER_HEIGHT;
  const banner =
    `<rect x="0" y="${bannerY}" width="${width}" height="${BANNER_HEIGHT}" fill="#111827" fill-opacity="0.62"/>` +
    `<text x="14" y="${bannerY + 23}" font-family="${FONT_STACK}" font-size="15" font-weight="bold" ` +
    `fill="#ffffff" fill-opacity="0.92" letter-spacing="1">PREVIEW</text>` +
    `<text x="${width - 14}" y="${bannerY + 23}" text-anchor="end" font-family="${FONT_STACK}" ` +
    `font-size="13" fill="#ffffff" fill-opacity="0.72">${escapeXml(id)}</text>`;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    stamps.join('') + banner +
    `</svg>`
  );
}

/** Resolve the on-disk source for an entry: gated original first, legacy public copy as fallback. */
function resolveSource(entry) {
  const gated = join(REPO_ROOT, entry.originalPath);
  if (existsSync(gated)) return gated;
  const legacy = join(LEGACY_PUBLIC_IMAGES, entry.sourceFile);
  if (existsSync(legacy)) return legacy;
  return null;
}

async function mtime(path) {
  try { return (await stat(path)).mtimeMs; } catch { return -1; }
}

async function buildOne(entry, { force, scriptMtime }) {
  const src = resolveSource(entry);
  if (!src) return { id: entry.id, status: 'missing-source' };

  const outPath = join(PREVIEW_DIR, `${entry.id}.png`);
  if (!force) {
    const outM = await mtime(outPath);
    const srcM = await mtime(src);
    if (outM > 0 && outM >= srcM && outM >= scriptMtime) {
      return { id: entry.id, status: 'skipped', bytes: (await stat(outPath)).size };
    }
  }

  const svg = await readFile(src);

  // Rasterize at high density, then downscale to the display size. `fit:
  // inside` preserves the source aspect ratio; flatten onto white because a
  // lot of these SVGs assume an opaque page behind them.
  const base = await sharp(svg, { density: RASTER_DENSITY })
    .resize({ width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, fit: 'inside', withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

  const { width, height } = await sharp(base).metadata();
  const overlay = watermarkSvg(width, height, entry.id);

  const out = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, out);
  return { id: entry.id, status: 'built', bytes: out.length, width, height };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const prune = args.includes('--prune');
  const only = new Set(args.filter(a => !a.startsWith('--')));

  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  if (!Array.isArray(catalog)) throw new Error('data/image-store.json must be an array of catalog entries');

  await mkdir(PREVIEW_DIR, { recursive: true });
  const scriptMtime = await mtime(fileURLToPath(import.meta.url));

  const targets = only.size ? catalog.filter(e => only.has(e.id)) : catalog;
  if (only.size && targets.length !== only.size) {
    const found = new Set(targets.map(t => t.id));
    for (const id of only) if (!found.has(id)) console.warn(`  ! no catalog entry with id "${id}"`);
  }

  const tally = { built: 0, skipped: 0, 'missing-source': 0 };
  const failures = [];

  for (const entry of targets) {
    try {
      const r = await buildOne(entry, { force, scriptMtime });
      tally[r.status] = (tally[r.status] ?? 0) + 1;
      if (r.status === 'missing-source') {
        failures.push(`${entry.id}: source not found (${entry.originalPath})`);
      }
    } catch (err) {
      failures.push(`${entry.id}: ${err.message}`);
    }
  }

  // Drop previews whose catalog entry has gone away (opt-in).
  if (prune) {
    const keep = new Set(catalog.map(e => `${e.id}.png`));
    for (const f of await readdir(PREVIEW_DIR)) {
      if (f.endsWith('.png') && !keep.has(f)) {
        await unlink(join(PREVIEW_DIR, f));
        console.log(`  pruned ${f}`);
      }
    }
  }

  console.log(
    `previews: ${tally.built} built, ${tally.skipped} up-to-date, ` +
    `${tally['missing-source']} missing source (of ${targets.length})`
  );
  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`);
    for (const f of failures) console.error('  - ' + f);
    process.exitCode = 1;
  }
}

await main();
