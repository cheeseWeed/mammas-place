# Geography — Phased Plan

Kids' US geography learning project for mammasplace. Anonymous, progress in localStorage. Architected as a layered SVG map where each phase toggles which labels/layers are visible.

## Architecture principles (locked in from day one)

1. **One map component, many modes.** `USMap.tsx` accepts a `layers` prop. Every phase renders the same map with different layers on/off. No phase rewrites the map.
2. **Labels are layers, not baked into the SVG.** State names, capital stars, capital names are each their own toggleable React layer. Hiding any subset is a prop change.
3. **Same coordinate system for political + physical maps.** So overlay works. Both SVGs use Albers USA projection.
4. **Progress is a thin wrapper.** `lib/geography/progress.ts` hides localStorage behind the same interface a future API would expose. Swap = change one file.
5. **Phase registry is data.** `data/geography-phases.ts` declares each phase's config. Adding a phase = add an entry + (if new mode) a small handler. No engine changes.
6. **Empty slots ready for later phases.** `data/states.json` already has empty `facts`, `physicalFeatures`, `parks` arrays per state for Phase 6.

## Phase ladder

| # | Phase | What kid does | New layer/data needed | Ship priority |
|---|---|---|---|---|
| **1** | **Study Map** | See all 50 states outlined, names + capital stars + capital names labeled. Hover/tap → state name tooltip. Optional toggle: show physical features (rivers, mountains, lakes) faded behind. | Political SVG, label layer, capital layer, physical SVG (optional toggle) | ✅ **Shipped** |
| **2** | **Name Quiz** | All state names hidden. Click the correct state when prompted ("Find: Nebraska"). Round sizes: 5/10/20/50. Wrong = red shake + reveals correct state. | Quiz engine, prompt component | ✅ **Shipped** |
| **3** | **Capital Quiz** | Capital stars visible, capital names hidden, state names hidden. Prompt: "Lincoln — capital of Nebraska" → click the state. | Reuses quiz engine (mode prop) | ✅ **Shipped** |
| 4 | Drag-Match Game | Tray of name tiles at bottom. Drag onto correct state — snaps + chime if right, shake + buzz + bounce back if wrong. Both name and capital modes. | Drag-drop layer (HTML5 DnD or react-dnd) | After #3 |
| 5 | Silhouette Puzzle | USA outline empty. Drag individual state *shapes* (silhouettes) into their slots. Hardest mode. | State silhouettes extracted from political SVG | After #4 |
| **6** | **State Deep-Dive** | Click any state → drawer/page with facts, physical features, national + well-known state parks. Quiz-mode toggle within. Introduce 1-2 features at a time, not a wall. | Fill `facts`, `physicalFeatures`, `parks` in states.json. Detail page. | After base mastery |
| **6.5** | **Distance Measuring** | Click two points (capitals or anywhere on map) → draw line → show miles. "Guess the distance" sub-mode for spatial intuition. | Haversine helper (~10 lines), inverse projection via d3-geo for click-anywhere mode | Bolt-on to Phase 1+ once base ships |
| 7 | Physical Features Quiz | "Click the Mississippi" / "Click the Rockies." Uses physical layer as the question surface. | Physical features as clickable paths (split out from physical SVG) | After #6 |
| 8 | Countries / continents | Same engine, different scale. North America → world. | New SVGs, same components | Future |

## File layout (locked)

```
app/geography/
  PLAN.md                    # this file
  TODO-NEXT.md               # what Phase 2 needs (written after Phase 1 ships)
  page.tsx                   # hub: lists phases, shows which are unlocked
  study/page.tsx             # Phase 1 (Phase 2+ slot in as siblings)

components/geography/
  USMap.tsx                  # inline SVG, accepts layers prop
  PoliticalLayer.tsx         # state outlines + fills (always on)
  PhysicalLayer.tsx          # rivers, lakes, mountains (toggleable)
  CapitalLayer.tsx           # stars + names (independent flags)
  LabelLayer.tsx             # state names (toggleable per-state)
  StateTooltip.tsx           # hover/tap detail
  DistanceTool.tsx           # Phase 6.5 — click two points, draw line, show miles

data/
  states.json                # 50 + DC: postal, name, capital, latlon, centroid, region, year, empty facts/features/parks
  geography-phases.ts        # phase registry

lib/geography/
  progress.ts                # localStorage wrapper, swap-ready
  distance.ts                # Phase 6.5 — Haversine + projection helpers

public/geography/
  us-states-political.svg    # Wikipedia public-domain, postal-code ids
  us-states-physical.svg     # rivers/lakes/mountains, same projection
```

## What "shipping a phase" means

- Hub page (`/geography`) lists all phases. Unshipped phases show as locked/coming-soon — kids see the roadmap.
- Each shipped phase is its own route. No conditional rendering pretending phases exist when they don't.
- `geography-phases.ts` is the single source of truth for what's shipped — flipping `shipped: true` lights up the hub entry.

## Distance phase (6.5) notes

Capital-to-capital works today using `data/states.json` lat/lon — pure math, no map projection needed.

Click-anywhere on the map needs **inverse projection** (SVG pixel → lat/lon). Approach:
- Use `d3-geo`'s `geoAlbersUsa()` projection, fit it to the SVG viewBox, then `projection.invert([x,y])` returns lat/lon.
- Then Haversine on (lat1,lon1)→(lat2,lon2) gives great-circle miles.
- Render the line as an SVG `<line>` with the two click points.

Accuracy: ~1% across continental US — fine for "how far is it" learning. Not for navigation.

## Non-goals (don't build)

- Sign-in / accounts (anonymous + localStorage is enough for homeschool use)
- Cloud sync (kids use one device — local is fine)
- Leaderboards / social
- Time-based challenges (pressure ≠ learning)
