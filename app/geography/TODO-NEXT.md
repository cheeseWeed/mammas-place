# Geography — What's Next

Phases 1–3 shipped. This file lists the next concrete moves, in order of value.

## What's already in place (don't rebuild)

- `<USMap>` accepts `hiddenStateLabels`, `hiddenCapitalNames`, `showCapitalStars`, `highlightedStates`, `wrongStates`, `onStateClick`, `onStateHover` — all the hooks future phases need.
- `<QuizEngine mode="name" | "capital">` — handles question queue, click judging, feedback timing, miss tracking, score callback. Add a new mode by extending the union.
- `data/states.json` — has empty `facts`, `physicalFeatures`, `parks` arrays per state. Fill, don't restructure.
- `lib/geography/progress.ts` — typed slots for every phase already exist. Don't inline localStorage anywhere else.
- `data/geography-phases.ts` — flip `shipped: true` on a phase entry and the hub card auto-lights up. Don't add UI conditionals.

## Phase 4 — Drag & Match (next ship)

**Goal:** Tray of name tiles at the bottom. Drag onto correct state. Snap + chime if right. Shake + buzz + bounce back if wrong.

**Files to add:**
- `app/geography/drag-match/page.tsx` — round-size picker, score, results card (mirror name-quiz page structure)
- `components/geography/DragMatchEngine.tsx` — manages tile queue, drop targets, success/fail feedback
- `components/geography/StateTileTray.tsx` — horizontal scrollable tray of draggable name tiles

**Reuse:**
- `<USMap>` as the drop target surface. Add a new prop: `onStateDrop?: (postal: string, droppedPayload: string) => void` triggered when a draggable is dropped over a state. (Map already attaches per-state handlers; add `onDragOver`/`onDrop` in the same loop.)
- Progress slot `drag-match` — already typed (currently `unknown` via index signature; tighten to `{ attempts, bestScore, misses }` matching the quiz slots).

**Tech notes:**
- HTML5 drag-and-drop API is enough — don't pull in react-dnd. ~30 lines.
- Mobile: drag-and-drop on touch is shaky; either tap-tile-then-tap-state OR use pointer events (preferred for one consistent path).
- Sound effects: use Web Audio API to generate a quick chime/buzz inline — no audio file dependency.

**Estimate:** half a session.

## Phase 6.5 — Distance Measure (low-hanging fruit, ship before 4 if you want a quick win)

**Goal:** Click two points → draw line → show miles. "Guess the distance" sub-mode.

**Files to add:**
- `app/geography/distance/page.tsx`
- `components/geography/DistanceTool.tsx` — listens for two clicks on the map, computes Haversine, renders SVG line + distance label
- `lib/geography/distance.ts` — `haversineMiles(lat1, lon1, lat2, lon2)` and `pixelToLatLon(x, y)` using d3-geo's `projection.invert([x,y])`

**Reuse:**
- USMap's existing d3-geo projection (already in `CapitalLayer.tsx` / `LabelLayer.tsx`) — extract to a shared `lib/geography/projection.ts` so DistanceTool can call `.invert()` on the same instance.
- For capital-to-capital mode: data is already in `states.json`. Zero new data.

**Estimate:** quarter of a session. Genuinely small.

## Phase 5 — Silhouette Puzzle (harder, ship later)

**Goal:** Drag actual state *shapes* into a blank USA outline.

**Hardest part:** Extracting per-state silhouette SVGs from `us-states-political.svg`. Approach: one-off Node script reads the SVG, splits each `<path id="XX">` into its own file under `public/geography/silhouettes/XX.svg` with a minimal viewBox tight to that path's bounds. Then DragMatchEngine becomes nearly reusable, but tiles are now silhouettes instead of name text.

**Estimate:** full session — silhouette extraction + cropping is the time sink.

## Phase 6 — State Deep-Dive (data work, then UI)

**Goal:** Click a state → drawer with facts, physical features, national/state parks. Quiz-mode toggle within.

**Step 1 (data):** Fill `facts`, `physicalFeatures`, `parks` in `data/states.json`. Don't over-do it — 3–5 entries per category per state. Kid-appropriate. Cite sources in a comment.

**Step 2 (UI):**
- Convert `<StateTooltip>` into a richer `<StateDetailDrawer>` (or add a separate component)
- On state click in study mode, slide drawer in from the right with the data
- New route `/geography/state/[postal]/page.tsx` for deep-linkable per-state pages (good for SEO and bookmarking)

**Estimate:** 2 sessions (data gathering dominates).

## Phase 1.5 — Physical features overlay (blocked on asset)

**Blocker:** No public-domain physical SVG with matching Albers USA projection was found. Options:

1. **Hand-author** key features (Mississippi, Missouri, Colorado, Rio Grande, Columbia, Great Lakes, Rockies, Appalachians, Sierra Nevada) as additional `<path>` elements on the same 959×593 canvas. ~10 SVG paths total. Source coordinates from Natural Earth shapefiles, simplify with mapshaper.org.
2. **Natural Earth raster overlay** — Natural Earth publishes a "Cross-blended hypsometric tints" raster. PNG overlay aligned to viewBox. Loses the "click the river" gameplay potential (raster has no clickable features).
3. **Skip** until needed.

Recommend (1) when Phase 7 (physical features quiz) gets prioritized — same data unlocks both.

## Phase 7 — Physical Features Quiz

**Goal:** "Click the Mississippi." "Click the Rockies."

**Depends on:** Phase 1.5 above (need clickable physical features).

**Reuse:** `<QuizEngine>` with a new `mode: 'feature'`. Question pool = the feature paths from the physical layer. Same engine, same scoring, same progress.

## Phase 8 — Countries / Continents

Same engine, different SVG (North America → World). Far future. Mention here so nobody designs phases 4–7 in a way that hardcodes "US."

## Architectural rules to keep

1. **Never inline localStorage anywhere except `lib/geography/progress.ts`.** Add a typed slot in `GeographyProgress`, then update via `updatePhase`.
2. **Never hardcode `shipped: true/false` logic in pages.** The hub is the only consumer of `shipped`. Pages just exist or don't.
3. **Never bake labels into the SVG.** All text/markers are React layers, positioned by d3-geo.
4. **One projection instance, shared.** If you find yourself calling `geoAlbersUsa()` in two files, extract it.
5. **No new npm deps without checking with main session.** We have d3-geo and that's enough for the next 3 phases.
