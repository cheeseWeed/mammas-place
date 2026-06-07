'use client';

// Dress Up Studio — a playful "decorate the letter" canvas for the Letters &
// Sounds section (preschool / kindergarten). A kid picks a letter, then dresses
// the giant letter to look like the animal it stands for (A → Alligator) OR
// makes a silly mashup. No image files, no external libs — everything is emoji
// + CSS shapes, absolutely positioned over a big colored letter "stage".
//
// Model: slot-based (reliable on touch). Each slot (eyes / mouth / ears / hat /
// tail / extra) holds ONE chosen piece. Tapping a piece in the sidebar swaps
// the slot's piece; tapping the same piece again (or the "None" option) clears
// it. The Colors tab changes the letter's background. A "Surprise!" button
// auto-dresses the letter as its themed animal. Tapping the big letter speaks
// the letter's sound via the shared speak() helper.

import { useState } from 'react';
import { LETTERS, type LetterEntry } from '@/lib/letters/data';
import { speak } from '@/lib/letters/speak';

// ----- Slots & pieces ------------------------------------------------------

type Slot = 'eyes' | 'mouth' | 'ears' | 'hat' | 'tail' | 'extra';

type TabKey = Slot | 'colors';

// A piece is a CSS-rendered decoration. `id` is unique within its slot.
interface Piece {
  id: string;
  label: string;            // shown as a tooltip / aria-label
  preview: React.ReactNode; // how it looks in the sidebar button
  render: React.ReactNode;  // how it looks on the letter (positioned by slot)
}

// Selected pieces per slot (null = empty slot).
type Outfit = Partial<Record<Slot, string>>;

// ----- Small CSS shape helpers (used by several pieces) --------------------

function GooglyEye({ size = 38 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        border: '3px solid #1f2937',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,.25)',
      }}
    >
      <span
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: '50%',
          background: '#111827',
        }}
      />
    </span>
  );
}

function CartoonEye({ size = 42 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size * 1.15,
        borderRadius: '50%',
        background: '#fff',
        border: '3px solid #111827',
        position: 'relative',
        display: 'inline-block',
        boxShadow: '0 2px 4px rgba(0,0,0,.2)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '52%',
          top: '40%',
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: '50%',
          background: '#1d4ed8',
          transform: 'translate(-50%,-50%)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '30%',
            top: '25%',
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
      </span>
    </span>
  );
}

function SleepyEye({ w = 42 }: { w?: number }) {
  return (
    <span
      style={{
        width: w,
        height: w * 0.5,
        borderTop: '4px solid #111827',
        borderTopLeftRadius: w,
        borderTopRightRadius: w,
        display: 'inline-block',
      }}
    />
  );
}

function Triangle({
  size = 30,
  color = '#fff',
  rotate = 0,
}: { size?: number; color?: string; rotate?: number }) {
  return (
    <span
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
        display: 'inline-block',
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}

function row(children: React.ReactNode) {
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'flex-end' }}>{children}</span>
  );
}

// ----- Piece catalogs ------------------------------------------------------
// Each slot has a "None" implicit option (the Clear button). Variety is the
// point: a kid can theme the animal OR make a goofy mashup.

const EYES: Piece[] = [
  { id: 'emoji', label: 'Big eyes', preview: <span style={{ fontSize: 30 }}>👀</span>, render: <span style={{ fontSize: 64 }}>👀</span> },
  { id: 'googly', label: 'Googly eyes', preview: row(<><GooglyEye size={22} /><GooglyEye size={22} /></>), render: row(<><GooglyEye size={46} /><GooglyEye size={46} /></>) },
  { id: 'cartoon', label: 'Cartoon eyes', preview: row(<><CartoonEye size={22} /><CartoonEye size={22} /></>), render: row(<><CartoonEye size={48} /><CartoonEye size={48} /></>) },
  { id: 'shades', label: 'Cool shades', preview: <span style={{ fontSize: 30 }}>😎</span>, render: <span style={{ fontSize: 70 }}>🕶️</span> },
  { id: 'sleepy', label: 'Sleepy eyes', preview: row(<><SleepyEye w={22} /><SleepyEye w={22} /></>), render: row(<><SleepyEye w={46} /><SleepyEye w={46} /></>) },
];

const MOUTH: Piece[] = [
  { id: 'teeth', label: 'Big teeth', preview: <span style={{ fontSize: 30 }}>🦷</span>, render: <span style={{ fontSize: 60 }}>🦷</span> },
  {
    id: 'grin',
    label: 'Toothy grin',
    preview: <ToothyGrin w={40} />,
    render: <ToothyGrin w={120} />,
  },
  {
    id: 'beaver',
    label: 'Beaver teeth',
    preview: <BeaverTeeth s={14} />,
    render: <BeaverTeeth s={34} />,
  },
  { id: 'beak', label: 'Bird beak', preview: <span style={{ fontSize: 28 }}>🔶</span>, render: <Triangle size={56} color="#f59e0b" rotate={180} /> },
  {
    id: 'smile',
    label: 'Happy smile',
    preview: <Smile w={40} />,
    render: <Smile w={120} />,
  },
  {
    id: 'jaws',
    label: 'Alligator jaws',
    preview: <Jaws w={44} />,
    render: <Jaws w={150} />,
  },
];

const EARS: Piece[] = [
  { id: 'bear', label: 'Bear ears', preview: <BearEars s={16} />, render: <BearEars s={46} /> },
  { id: 'bunny', label: 'Bunny ears', preview: <span style={{ fontSize: 28 }}>🐰</span>, render: <BunnyEars /> },
  { id: 'cat', label: 'Cat ears', preview: <CatEars s={18} />, render: <CatEars s={48} /> },
];

const HAT: Piece[] = [
  { id: 'tophat', label: 'Top hat', preview: <span style={{ fontSize: 30 }}>🎩</span>, render: <span style={{ fontSize: 80 }}>🎩</span> },
  { id: 'crown', label: 'Crown', preview: <span style={{ fontSize: 30 }}>👑</span>, render: <span style={{ fontSize: 80 }}>👑</span> },
  { id: 'cap', label: 'Cap', preview: <span style={{ fontSize: 30 }}>🧢</span>, render: <span style={{ fontSize: 80 }}>🧢</span> },
  { id: 'party', label: 'Party hat', preview: <span style={{ fontSize: 30 }}>🥳</span>, render: <PartyHat /> },
];

const TAIL: Piece[] = [
  { id: 'curvy', label: 'Curvy tail', preview: <CurvyTail s={0.45} />, render: <CurvyTail s={1} /> },
  { id: 'spiked', label: 'Spiked tail', preview: <span style={{ fontSize: 26 }}>🦎</span>, render: <SpikedTail /> },
  { id: 'paddle', label: 'Beaver tail', preview: <PaddleTail s={0.4} />, render: <PaddleTail s={1} /> },
];

const EXTRA: Piece[] = [
  { id: 'spikes', label: 'Back spikes', preview: <SpikeRow s={0.5} />, render: <SpikeRow s={1} /> },
  { id: 'scarf', label: 'Cozy scarf', preview: <Scarf s={0.45} />, render: <Scarf s={1} /> },
  { id: 'dots', label: 'Polka dots', preview: <span style={{ fontSize: 26 }}>🔴</span>, render: <PolkaDots /> },
  { id: 'star', label: 'Sparkle', preview: <span style={{ fontSize: 28 }}>🌟</span>, render: <span style={{ fontSize: 60 }}>🌟</span> },
];

const CATALOG: Record<Slot, Piece[]> = {
  eyes: EYES,
  mouth: MOUTH,
  ears: EARS,
  hat: HAT,
  tail: TAIL,
  extra: EXTRA,
};

const COLORS = [
  '#22c55e', '#16a34a', // greens (alligator)
  '#a16207', '#92400e', // browns (bear)
  '#3b82f6', '#0ea5e9', // blues
  '#ec4899', '#f472b6', // pinks
  '#eab308', '#f59e0b', // yellows
  '#8b5cf6', '#a855f7', // purples
  '#ef4444', '#111827', // red, black
];

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'eyes', label: 'Eyes', emoji: '👀' },
  { key: 'mouth', label: 'Mouth', emoji: '😬' },
  { key: 'ears', label: 'Ears', emoji: '👂' },
  { key: 'hat', label: 'Hat', emoji: '🎩' },
  { key: 'tail', label: 'Tail', emoji: '🦎' },
  { key: 'extra', label: 'Extras', emoji: '🌟' },
  { key: 'colors', label: 'Colors', emoji: '🎨' },
];

// ----- Themed auto-dress presets ------------------------------------------
// Picks pieces that evoke the letter's animal. Animals not listed fall back to
// a friendly generic costume (cartoon eyes + smile + ears).

interface Preset {
  outfit: Outfit;
  color?: string;
}

function presetFor(entry: LetterEntry): Preset {
  const a = entry.animal.toLowerCase();
  const generic: Preset = {
    outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'bear' },
    color: entry.color,
  };
  if (a.includes('alligator')) return { outfit: { eyes: 'googly', mouth: 'jaws', tail: 'spiked', extra: 'spikes' }, color: '#22c55e' };
  if (a.includes('bear')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'bear' }, color: '#92400e' };
  if (a.includes('cat')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'curvy' }, color: '#f59e0b' };
  if (a.includes('dog')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'bear', tail: 'curvy' }, color: '#eab308' };
  if (a.includes('elephant')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'bear' }, color: '#9ca3af' };
  if (a.includes('fish')) return { outfit: { eyes: 'googly', mouth: 'smile', tail: 'paddle' }, color: '#0ea5e9' };
  if (a.includes('goat')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'cat' }, color: '#10b981' };
  if (a.includes('horse')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'cat', tail: 'curvy' }, color: '#a16207' };
  if (a.includes('iguana') || a.includes('newt')) return { outfit: { eyes: 'googly', mouth: 'grin', tail: 'spiked', extra: 'spikes' }, color: '#22c55e' };
  if (a.includes('jellyfish')) return { outfit: { eyes: 'googly', mouth: 'smile', extra: 'dots' }, color: '#a855f7' };
  if (a.includes('kangaroo')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'paddle' }, color: '#3b82f6' };
  if (a.includes('lion')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'bear', tail: 'curvy' }, color: '#f59e0b' };
  if (a.includes('monkey')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'bear', tail: 'curvy' }, color: '#92400e' };
  if (a.includes('octopus')) return { outfit: { eyes: 'googly', mouth: 'smile', extra: 'dots' }, color: '#d946ef' };
  if (a.includes('pig')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'curvy' }, color: '#f472b6' };
  if (a.includes('queen') || a.includes('bee')) return { outfit: { eyes: 'cartoon', mouth: 'smile', hat: 'crown', extra: 'star' }, color: '#eab308' };
  if (a.includes('rabbit')) return { outfit: { eyes: 'cartoon', mouth: 'beaver', ears: 'bunny' }, color: '#f472b6' };
  if (a.includes('snake')) return { outfit: { eyes: 'googly', mouth: 'grin', tail: 'curvy' }, color: '#16a34a' };
  if (a.includes('tiger')) return { outfit: { eyes: 'cartoon', mouth: 'jaws', ears: 'cat', tail: 'curvy' }, color: '#f59e0b' };
  if (a.includes('vulture') || a.includes('umbrella') || a.includes('bird')) return { outfit: { eyes: 'googly', mouth: 'beak', extra: 'star' }, color: '#84cc16' };
  if (a.includes('whale')) return { outfit: { eyes: 'cartoon', mouth: 'smile', tail: 'paddle' }, color: '#3b82f6' };
  if (a.includes('fox')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'cat', tail: 'curvy' }, color: '#f97316' };
  if (a.includes('yak')) return { outfit: { eyes: 'cartoon', mouth: 'teeth', ears: 'bear' }, color: '#6b7280' };
  if (a.includes('zebra')) return { outfit: { eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'curvy' }, color: '#111827' };
  return generic;
}

// ----- CSS shape sub-components --------------------------------------------

function ToothyGrin({ w }: { w: number }) {
  const teeth = 5;
  return (
    <span
      style={{
        width: w,
        height: w * 0.5,
        background: '#b91c1c',
        borderRadius: `0 0 ${w}px ${w}px`,
        display: 'inline-flex',
        gap: w * 0.02,
        padding: `2px ${w * 0.06}px`,
        alignItems: 'flex-start',
        overflow: 'hidden',
        border: '3px solid #7f1d1d',
        boxSizing: 'border-box',
      }}
    >
      {Array.from({ length: teeth }).map((_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: w * 0.2,
            background: '#fff',
            borderRadius: '0 0 4px 4px',
          }}
        />
      ))}
    </span>
  );
}

function BeaverTeeth({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 0.18 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s,
            height: s * 1.4,
            background: '#fff7ed',
            border: '3px solid #92400e',
            borderRadius: '4px 4px 6px 6px',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function Smile({ w }: { w: number }) {
  return (
    <span
      style={{
        width: w,
        height: w * 0.55,
        border: `${Math.max(4, w * 0.06)}px solid #111827`,
        borderTop: 'none',
        borderRadius: `0 0 ${w}px ${w}px`,
        display: 'inline-block',
      }}
    />
  );
}

function Jaws({ w }: { w: number }) {
  const teeth = 7;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {Array.from({ length: teeth }).map((_, i) => (
          <Triangle key={i} size={w / teeth} color="#fff" rotate={180} />
        ))}
      </span>
      <span style={{ width: w, height: 4, background: '#7f1d1d' }} />
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {Array.from({ length: teeth }).map((_, i) => (
          <Triangle key={i} size={w / teeth} color="#fff" />
        ))}
      </span>
    </span>
  );
}

function BearEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.4 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s,
            height: s,
            borderRadius: '50%',
            background: '#92400e',
            border: '3px solid #78350f',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function BunnyEars() {
  return (
    <span style={{ display: 'inline-flex', gap: 14 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: 26,
            height: 80,
            background: '#fff',
            border: '3px solid #d1d5db',
            borderRadius: '50% 50% 45% 45%',
            display: 'inline-block',
            position: 'relative',
            transform: i === 0 ? 'rotate(-12deg)' : 'rotate(12deg)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: '10px 8px',
              background: '#fbcfe8',
              borderRadius: '50% 50% 45% 45%',
            }}
          />
        </span>
      ))}
    </span>
  );
}

function CatEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.2, alignItems: 'flex-end' }}>
      <Triangle size={s} color="#111827" rotate={-15} />
      <Triangle size={s} color="#111827" rotate={15} />
    </span>
  );
}

function PartyHat() {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: 22, marginBottom: -6 }}>🎀</span>
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: '34px solid transparent',
          borderRight: '34px solid transparent',
          borderBottom: '70px solid #ec4899',
        }}
      />
    </span>
  );
}

function CurvyTail({ s }: { s: number }) {
  const w = 90 * s;
  return (
    <span
      style={{
        width: w,
        height: w,
        border: `${Math.max(5, 12 * s)}px solid #16a34a`,
        borderRadius: '50%',
        borderLeftColor: 'transparent',
        borderTopColor: 'transparent',
        display: 'inline-block',
        transform: 'rotate(45deg)',
      }}
    />
  );
}

function SpikedTail() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 70, height: 18, background: '#16a34a', borderRadius: 9 }} />
      {[24, 18, 12].map((sz, i) => (
        <Triangle key={i} size={sz} color="#15803d" rotate={90} />
      ))}
    </span>
  );
}

function PaddleTail({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 40 * s, height: 14 * s, background: '#92400e' }} />
      <span
        style={{
          width: 60 * s,
          height: 80 * s,
          background: '#a16207',
          border: '3px solid #78350f',
          borderRadius: '40% 40% 40% 40%',
        }}
      />
    </span>
  );
}

function SpikeRow({ s }: { s: number }) {
  const n = 7;
  return (
    <span style={{ display: 'inline-flex', gap: 2 * s, alignItems: 'flex-end' }}>
      {Array.from({ length: n }).map((_, i) => (
        <Triangle key={i} size={(i === 3 ? 34 : 22 + (i % 3) * 4) * s} color="#15803d" />
      ))}
    </span>
  );
}

function Scarf({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span
        style={{
          width: 200 * s,
          height: 34 * s,
          background: 'repeating-linear-gradient(45deg,#dc2626 0 14px,#fff 14px 28px)',
          borderRadius: 10,
          border: '3px solid #991b1b',
        }}
      />
      <span
        style={{
          width: 30 * s,
          height: 50 * s,
          background: 'repeating-linear-gradient(45deg,#dc2626 0 14px,#fff 14px 28px)',
          borderRadius: 6,
          border: '3px solid #991b1b',
          marginTop: -4,
        }}
      />
    </span>
  );
}

function PolkaDots() {
  const dots = [
    { top: '14%', left: '18%', c: '#fef08a' },
    { top: '60%', left: '12%', c: '#fb7185' },
    { top: '30%', left: '74%', c: '#fff' },
    { top: '70%', left: '70%', c: '#60a5fa' },
    { top: '46%', left: '44%', c: '#fff' },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: d.top,
            left: d.left,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: d.c,
            opacity: 0.9,
          }}
        />
      ))}
    </>
  );
}

// ----- Slot positioning over the letter ------------------------------------
// Each slot snaps to a sensible default spot. Absolute positions are relative
// to the letter stage box.

function slotStyle(slot: Slot): React.CSSProperties {
  switch (slot) {
    case 'eyes':
      return { top: '24%', left: '50%', transform: 'translate(-50%,-50%)' };
    case 'mouth':
      return { top: '58%', left: '50%', transform: 'translate(-50%,-50%)' };
    case 'ears':
      return { top: '-6%', left: '50%', transform: 'translate(-50%,-50%)' };
    case 'hat':
      return { top: '-18%', left: '50%', transform: 'translate(-50%,-100%)', marginTop: '12%' };
    case 'tail':
      return { top: '62%', right: '-8%', transform: 'translate(50%,0)' };
    case 'extra':
      return { inset: 0 }; // extras decorate the whole stage
    default:
      return {};
  }
}

// ----- Main component ------------------------------------------------------

export interface DressUpStudioProps {
  /** Optional starting letter, uppercase e.g. "A". Defaults to "A". */
  initialLetter?: string;
}

export default function DressUpStudio({ initialLetter = 'A' }: DressUpStudioProps = {}) {
  const startIdx = Math.max(
    0,
    LETTERS.findIndex((l) => l.letter === initialLetter.toUpperCase()),
  );
  const [idx, setIdx] = useState(startIdx === -1 ? 0 : startIdx);
  const [tab, setTab] = useState<TabKey>('eyes');
  const [outfit, setOutfit] = useState<Outfit>({});
  const [color, setColor] = useState<string>(LETTERS[startIdx === -1 ? 0 : startIdx].color);

  const entry = LETTERS[idx];

  const goLetter = (next: number) => {
    const i = (next + LETTERS.length) % LETTERS.length;
    setIdx(i);
    setOutfit({}); // reset costume on a fresh letter — cleaner
    setColor(LETTERS[i].color);
    speak(LETTERS[i].spoken);
  };

  const pickPiece = (slot: Slot, id: string) => {
    setOutfit((o) => ({ ...o, [slot]: o[slot] === id ? undefined : id }));
  };

  const clearSlot = (slot: Slot) => setOutfit((o) => ({ ...o, [slot]: undefined }));

  const surprise = () => {
    const preset = presetFor(entry);
    setOutfit(preset.outfit);
    if (preset.color) setColor(preset.color);
    speak(entry.spoken);
  };

  const startOver = () => {
    setOutfit({});
    setColor(entry.color);
  };

  const renderSlot = (slot: Slot) => {
    const id = outfit[slot];
    if (!id) return null;
    const piece = CATALOG[slot].find((p) => p.id === id);
    if (!piece) return null;
    return (
      <span
        key={slot}
        style={{ position: 'absolute', zIndex: slot === 'extra' ? 0 : 5, ...slotStyle(slot) }}
      >
        {piece.render}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-4 sm:p-6">
      {/* Suggestion + letter picker */}
      <div className="text-center mb-4">
        <p className="text-purple-800 font-black text-lg sm:text-2xl">
          Make {entry.letter} look like {anA(entry.animal)} {entry.animal}! {entry.emoji}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ---- Stage ---- */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="relative w-full"
            style={{ maxWidth: 460 }}
          >
            <button
              onClick={() => speak(entry.spoken)}
              aria-label={`Hear the sound for ${entry.letter}`}
              className="relative w-full focus:outline-none group"
              style={{ aspectRatio: '1 / 1' }}
            >
              {/* the giant letter stage */}
              <span
                className="absolute inset-0 rounded-[2rem] flex items-center justify-center shadow-inner transition-colors duration-300 group-active:scale-95"
                style={{ background: color }}
              >
                {/* extras render behind the letter glyph */}
                {outfit.extra && renderSlot('extra')}
                <span
                  className="font-black select-none"
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: 'min(58vw, 300px)',
                    lineHeight: 1,
                    textShadow: '0 4px 0 rgba(0,0,0,0.12)',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {entry.letter}
                </span>
              </span>
              {/* decoration slots (non-extra) layered on top */}
              {(['hat', 'ears', 'eyes', 'mouth', 'tail'] as Slot[]).map((s) => renderSlot(s))}
            </button>
            <p className="text-center text-purple-400 text-xs mt-2">👆 Tap the letter to hear it</p>
          </div>

          {/* letter prev / next + speak */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={() => goLetter(idx - 1)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-12 h-12 rounded-full text-xl"
              aria-label="Previous letter"
            >←</button>
            <span className="text-purple-500 font-black text-2xl w-10 text-center">{entry.letter}</span>
            <button
              onClick={() => goLetter(idx + 1)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-black w-12 h-12 rounded-full text-xl"
              aria-label="Next letter"
            >→</button>
          </div>

          {/* action buttons */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <button
              onClick={surprise}
              className="bg-gradient-to-br from-pink-500 to-orange-500 text-white font-black px-5 py-3 rounded-full shadow hover:scale-105 transition-transform animate-bounce-slow"
            >
              🎉 Surprise me!
            </button>
            <button
              onClick={startOver}
              className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-5 py-3 rounded-full"
            >
              🧽 Start over
            </button>
          </div>

          {/* A-Z strip */}
          <div className="flex flex-wrap gap-1 justify-center mt-4 max-w-[460px]">
            {LETTERS.map((l, i) => (
              <button
                key={l.letter}
                onClick={() => goLetter(i)}
                className={`w-8 h-8 rounded-lg font-black text-white text-xs transition-transform hover:scale-110 ${i === idx ? 'ring-4 ring-purple-300' : ''}`}
                style={{ background: l.color }}
                aria-label={`Dress up letter ${l.letter}`}
              >
                {l.letter}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="lg:w-80 w-full">
          {/* tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 min-w-[4.5rem] font-black text-sm px-2 py-2 rounded-xl transition-colors ${
                  tab === t.key
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                <span className="block text-lg leading-none">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* palette */}
          <div className="bg-purple-50 rounded-2xl p-3 min-h-[16rem]">
            {tab === 'colors' ? (
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-full rounded-xl transition-transform hover:scale-110 ${color === c ? 'ring-4 ring-purple-400' : 'ring-2 ring-white'}`}
                    style={{ background: c, height: 52 }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {/* Clear / None option */}
                <button
                  onClick={() => clearSlot(tab as Slot)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-white border-2 p-2 h-24 hover:bg-purple-100 ${
                    !outfit[tab as Slot] ? 'border-purple-400 ring-2 ring-purple-300' : 'border-purple-100'
                  }`}
                  aria-label="None"
                >
                  <span className="text-2xl">🚫</span>
                  <span className="text-xs font-bold text-purple-600">None</span>
                </button>
                {CATALOG[tab as Slot].map((p) => {
                  const active = outfit[tab as Slot] === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickPiece(tab as Slot, p.id)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-white border-2 p-2 h-24 hover:bg-purple-100 transition-colors overflow-hidden ${
                        active ? 'border-purple-500 ring-2 ring-purple-300' : 'border-purple-100'
                      }`}
                      aria-label={p.label}
                      title={p.label}
                    >
                      <span className="flex-1 flex items-center justify-center">{p.preview}</span>
                      <span className="text-[10px] font-bold text-purple-600 leading-tight text-center">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-center text-purple-400 text-xs mt-3">
            Pick pieces to dress up your letter — or make a silly mash-up! 🤪
          </p>
        </div>
      </div>
    </div>
  );
}

// "a" vs "an" for the suggestion line.
function anA(word: string) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
