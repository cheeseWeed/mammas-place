// Chess theme registry — themes are data, not code.
//
// Adding a 5th theme = one entry here + 12 SVGs under public/chess/{id}/.
// No component edits.
//
// Each theme defines:
//   - piece artwork URL pattern (one SVG per color × type)
//   - board square colors (light + dark)
//   - highlight color (legal-move dots, selected-square ring)
//
// Contrast rule for piece SVGs: every piece MUST have fill + opposite-color
// stroke so it reads on both light and dark squares. White = white fill +
// black stroke, black = black fill + white stroke. See PLAN.md section 6.

export type ChessColor = 'w' | 'b';
export type ChessPieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export type ChessThemeId = 'classic' | 'storybook' | 'royal' | 'holiday';

export type ChessTheme = {
  id: ChessThemeId;
  label: string;
  description: string;
  pieceUrl: (color: ChessColor, type: ChessPieceType) => string;
  light: string;     // CSS color for light squares
  dark: string;      // CSS color for dark squares
  highlight: string; // legal-move dots + selected-square outline
};

function makeUrl(id: ChessThemeId, color: ChessColor, type: ChessPieceType): string {
  return `/chess/${id}/${color}${type}.svg`;
}

export const CHESS_THEMES: ChessTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Clean Staunton pieces on wood-tone squares. The set you remember.',
    pieceUrl: (color, type) => makeUrl('classic', color, type),
    light: '#f0d9b5',
    dark: '#b58863',
    highlight: '#f6ce4a',
  },
  {
    id: 'storybook',
    label: 'Storybook',
    description: 'Hand-drawn cartoon pieces. Friendly and bright.',
    pieceUrl: (color, type) => makeUrl('storybook', color, type),
    light: '#fef3c7',
    dark: '#a78bfa',
    highlight: '#fb7185',
  },
  {
    id: 'royal',
    label: 'Royal',
    description: 'Ornate medieval set on gold and deep wood.',
    pieceUrl: (color, type) => makeUrl('royal', color, type),
    light: '#fef9c3',
    dark: '#854d0e',
    highlight: '#facc15',
  },
  {
    id: 'holiday',
    label: 'Holiday',
    description: 'Christmas set — Santa kings, gingerbread pawns, reindeer knights.',
    pieceUrl: (color, type) => makeUrl('holiday', color, type),
    light: '#fee2e2',
    dark: '#166534',
    highlight: '#fde047',
  },
];

export const DEFAULT_THEME_ID: ChessThemeId = 'classic';

export function getTheme(id: string): ChessTheme {
  const found = CHESS_THEMES.find((t) => t.id === id);
  return found ?? CHESS_THEMES[0];
}
