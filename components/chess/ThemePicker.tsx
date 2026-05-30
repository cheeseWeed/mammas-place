// ThemePicker — four tile cards, one per theme, showing a 2x2 mini-board
// with that theme's pieces sitting on the theme's square colors.
//
// Tap to select. The active theme is outlined in yellow.
//
// Used on the hub page (browse-only) and on the play config screen (binds to
// the player's selection).

'use client';

import { CHESS_THEMES, type ChessTheme, type ChessThemeId } from '@/data/chess-themes';
import PieceSprite from './PieceSprite';

export type ThemePickerProps = {
  selectedId: ChessThemeId;
  onSelect: (id: ChessThemeId) => void;
};

export default function ThemePicker({ selectedId, onSelect }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CHESS_THEMES.map((theme) => (
        <ThemeTile
          key={theme.id}
          theme={theme}
          selected={theme.id === selectedId}
          onSelect={() => onSelect(theme.id)}
        />
      ))}
    </div>
  );
}

function ThemeTile({
  theme,
  selected,
  onSelect,
}: {
  theme: ChessTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group bg-white rounded-2xl p-3 border-4 transition-all text-left ${
        selected
          ? 'border-yellow-400 shadow-lg scale-[1.02]'
          : 'border-purple-200 hover:border-purple-400 hover:shadow-md'
      }`}
    >
      {/* Mini 2x2 preview board with one piece per square */}
      <div className="grid grid-cols-2 grid-rows-2 rounded-lg overflow-hidden mb-2 aspect-square">
        <MiniSquare bg={theme.light} piece={{ color: 'w', type: 'K' }} theme={theme} />
        <MiniSquare bg={theme.dark} piece={{ color: 'b', type: 'Q' }} theme={theme} />
        <MiniSquare bg={theme.dark} piece={{ color: 'w', type: 'N' }} theme={theme} />
        <MiniSquare bg={theme.light} piece={{ color: 'b', type: 'P' }} theme={theme} />
      </div>
      <div className="font-black text-purple-900 text-sm">{theme.label}</div>
      <div className="text-xs text-purple-700 leading-tight mt-0.5">
        {theme.description}
      </div>
    </button>
  );
}

function MiniSquare({
  bg,
  piece,
  theme,
}: {
  bg: string;
  piece: { color: 'w' | 'b'; type: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' };
  theme: ChessTheme;
}) {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <div className="w-[80%] h-[80%]">
        <PieceSprite color={piece.color} type={piece.type} theme={theme} />
      </div>
    </div>
  );
}
