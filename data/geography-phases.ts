// Phase registry for the Geography hub.
//
// Single source of truth for what phases exist, their route, display order,
// and whether they're shipped yet. The hub page renders one card per entry;
// unshipped phases render grayed out (no link).
//
// To add a phase: add an id to GeographyPhaseId, then push the matching entry
// into GEOGRAPHY_PHASES. Keep `number` as a display string so we can insert
// half-steps (e.g. '6.5') without renumbering everything.

export type GeographyPhaseId =
  | 'study'
  | 'name-quiz'
  | 'capital-quiz'
  | 'drag-match'
  | 'silhouette-puzzle'
  | 'state-deep-dive'
  | 'distance'
  | 'physical-quiz';

export type GeographyPhase = {
  id: GeographyPhaseId;
  number: string;        // '1', '2', '6.5' — display order
  title: string;         // 'Study Map'
  subtitle: string;      // one-line description for the hub card
  route: string;         // '/geography/study'
  shipped: boolean;      // true = link works, false = grayed out
  hiddenStateLabels?: 'none' | 'some' | 'all';   // hint for the map component
  hiddenCapitalNames?: 'none' | 'some' | 'all';
};

export const GEOGRAPHY_PHASES: GeographyPhase[] = [
  {
    id: 'study',
    number: '1',
    title: 'Study Map',
    subtitle: 'Explore the United States. See every state, capital, and learn at your own pace.',
    route: '/geography/study',
    shipped: true,
    hiddenStateLabels: 'none',
    hiddenCapitalNames: 'none',
  },
  {
    id: 'name-quiz',
    number: '2',
    title: 'Name the State',
    subtitle: 'Some state names disappear. Can you fill them back in?',
    route: '/geography/name-quiz',
    shipped: true,
    hiddenStateLabels: 'some',
    hiddenCapitalNames: 'none',
  },
  {
    id: 'capital-quiz',
    number: '3',
    title: 'Find the Capital',
    subtitle: 'The stars stay. The capital names hide. How many do you know?',
    route: '/geography/capital-quiz',
    shipped: true,
    hiddenStateLabels: 'none',
    hiddenCapitalNames: 'some',
  },
  {
    id: 'drag-match',
    number: '4',
    title: 'Drag & Match',
    subtitle: 'Drag the name onto the right state. Snap = right. Shake = try again.',
    route: '/geography/drag-match',
    shipped: false,
  },
  {
    id: 'silhouette-puzzle',
    number: '5',
    title: 'Silhouette Puzzle',
    subtitle: 'Drag each state shape into the USA outline.',
    route: '/geography/silhouette-puzzle',
    shipped: false,
  },
  {
    id: 'state-deep-dive',
    number: '6',
    title: 'State Deep-Dive',
    subtitle: "Pick any state on the Study Map, or browse Utah's deep-dive as an example.",
    route: '/geography/state/ut',
    shipped: true,
  },
  {
    id: 'distance',
    number: '7',
    title: 'Distance Measure',
    subtitle: 'Click two places. See how far apart they are. Then guess the next one.',
    route: '/geography/distance',
    shipped: false,
  },
  {
    id: 'physical-quiz',
    number: '8',
    title: 'Physical Features Quiz',
    subtitle: 'Find the Mississippi. Find the Rockies. Find the Great Lakes.',
    route: '/geography/physical-quiz',
    shipped: false,
  },
];

// Convenience: only the phases whose routes are live.
export function getShippedPhases(): GeographyPhase[] {
  return GEOGRAPHY_PHASES.filter((p) => p.shipped);
}

// Lookup by id. Returns undefined if the id isn't registered (shouldn't happen
// given the union type, but guards against runtime string lookups).
export function getPhaseById(id: GeographyPhaseId): GeographyPhase | undefined {
  return GEOGRAPHY_PHASES.find((p) => p.id === id);
}
