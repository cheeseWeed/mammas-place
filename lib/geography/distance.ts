// Distance math + projection inversion helpers for Phase 6.5 (Distance Measure).
//
// All projection math uses d3-geo's geoAlbersUsa() configured with the exact
// scale (1280) and translate (VIEW_W/2, VIEW_H/2) the visible layers
// (CapitalLayer, LabelLayer) use. The visible layers ALSO apply a
// `transform="translate(-3, -5)"` correction at the SVG group level — that's
// a paint-only offset to align d3's projection with the bundled political
// SVG's painted state outlines. To go from a *click on the painted map* back
// to a true geographic lat/lon, we need to undo that offset BEFORE handing
// the point to projection.invert(). Concretely: add 3 to x, add 5 to y, then
// invert. (If you skip this, clicks on Sacramento will return a point ~5-10
// miles east-southeast of the actual capital.)
//
// All distances are returned in miles (kid app — imperial is the default).

import { geoAlbersUsa } from 'd3-geo';

// Must match VIEW_W / VIEW_H in USMap.tsx and CapitalLayer.tsx.
const VIEW_W = 959;
const VIEW_H = 593;

// Must match the visible CapitalLayer's empirical correction (transform="translate(-3, -5)").
const PAINT_OFFSET_X = 3;
const PAINT_OFFSET_Y = 5;

// Mean Earth radius in miles (WGS-84 mean, close enough for kid-app distances).
const EARTH_RADIUS_MI = 3958.7613;

// Shared projection instance. Identical configuration to CapitalLayer.
const projection = geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]);

// Haversine — great-circle distance in miles between two (lat, lon) points.
// Inputs are degrees; conversion to radians is internal.
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

// Inverse-project an SVG (x, y) click into [lat, lon].
//
// Returns null when the click is outside the projection's valid US bounds
// (i.e. d3-geo's geoAlbersUsa returns null for points off the painted map —
// far in the ocean, beyond Alaska's inset frame, etc.). Callers should
// gracefully ignore null and prompt the user to click on land.
//
// IMPORTANT: callers should pass the click's coordinates IN THE SAME
// VIEWBOX SPACE as the SVG (0..VIEW_W, 0..VIEW_H), not raw pixel
// coordinates from the screen. USMap exposes a helper for this conversion.
export function svgPointToLatLon(x: number, y: number): [number, number] | null {
  // Undo the visible -3/-5 paint offset before asking d3-geo to invert.
  // (The painted map is shifted; d3's projection is not.)
  const corrected: [number, number] = [x + PAINT_OFFSET_X, y + PAINT_OFFSET_Y];
  // d3-geo types `invert` as optional even though geoAlbersUsa always
  // provides it. Guard for the types' sake.
  if (!projection.invert) return null;
  const inv = projection.invert(corrected);
  if (!inv) return null;
  const [lon, lat] = inv;
  // Sanity: invert can return finite numbers for some off-map points.
  // Clamp to plausible global bounds; reject NaN.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

// Format miles for kid display: "1,247 mi". Negative values clamp to 0.
// Sub-mile values still get "0 mi" rather than "0.4 mi" — easier for kids.
export function formatMiles(mi: number): string {
  const n = Math.max(0, Math.round(mi));
  return `${n.toLocaleString('en-US')} mi`;
}
