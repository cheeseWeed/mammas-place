// Phase registry for the WORLD section of the Geography hub.
//
// Parallel to data/geography-phases.ts (US phases). Lives in a separate file
// so the two registries can evolve independently — US numbering stays stable
// even when we add more world phases (or vice versa).
//
// Render order on the hub is array order. Add a new world phase by appending
// to WORLD_PHASES and (if it has stored progress) widening the type in
// lib/geography/progress.ts.

export type WorldPhaseId =
  | 'world-study'
  | 'world-name-quiz'
  | 'world-capital-quiz'
  | 'world-flag-match'
  | 'world-continent-quiz'
  | 'world-country-deep-dive'
  | 'world-physical-quiz';

export type WorldPhase = {
  id: WorldPhaseId;
  number: string;        // 'W1', 'W2' — display label
  title: string;         // 'World Map'
  subtitle: string;      // one-line description for the hub card
  route: string;         // '/geography/world/study'
  shipped: boolean;      // true = link works, false = grayed out
};

export const WORLD_PHASES: WorldPhase[] = [
  {
    id: 'world-study',
    number: 'W1',
    title: 'World Map',
    subtitle: 'Spin the globe. Hover any country to see its capital. Click to dig in.',
    route: '/geography/world/study',
    shipped: true,
  },
  {
    id: 'world-name-quiz',
    number: 'W2',
    title: 'Name the Country',
    subtitle: 'A country name appears. Click it on the world map.',
    route: '/geography/world/name-quiz',
    shipped: true,
  },
  {
    id: 'world-capital-quiz',
    number: 'W3',
    title: 'Find the Capital',
    subtitle: 'A capital city appears. Click the country it belongs to.',
    route: '/geography/world/capital-quiz',
    shipped: true,
  },
  {
    id: 'world-flag-match',
    number: 'W4',
    title: 'Country Flag Match',
    subtitle: 'Match each flag to its country. Or each country to its flag.',
    route: '/geography/world/flag-match',
    shipped: true,
  },
  {
    id: 'world-continent-quiz',
    number: 'W5',
    title: 'Continent Quiz',
    subtitle: 'Which continent is this country in? Six big choices.',
    route: '/geography/world/continent-quiz',
    shipped: true,
  },
  {
    id: 'world-country-deep-dive',
    number: 'W6',
    title: 'Country Deep-Dive',
    subtitle: 'Pick any country from the map to see its flag, facts, landmarks, and features.',
    // Deep-dive entry point is the study map itself (click a country to drill in),
    // matching the US Phase 6 (State Deep-Dive) pattern.
    route: '/geography/world/study',
    shipped: true,
  },
  {
    id: 'world-physical-quiz',
    number: 'W7',
    title: 'World Features Quiz',
    subtitle: 'Find the Amazon. Find the Eiffel Tower. Find the Himalayas.',
    route: '/geography/world/physical-quiz',
    shipped: true,
  },
];

// Convenience: only the phases whose routes are live.
export function getShippedWorldPhases(): WorldPhase[] {
  return WORLD_PHASES.filter((p) => p.shipped);
}

// Lookup by id. Returns undefined if the id isn't registered.
export function getWorldPhaseById(id: WorldPhaseId): WorldPhase | undefined {
  return WORLD_PHASES.find((p) => p.id === id);
}
