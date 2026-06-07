'use client';

// Dress Up Studio — a playful "decorate the LETTER" canvas for the Letters &
// Sounds section (preschool / kindergarten). A kid picks a letter, then dresses
// the giant letter GLYPH itself to look like the animal it stands for
// (A → Alligator) OR makes a silly mashup.
//
// KEY DESIGN: the decorations attach to the LETTER ITSELF, not to a card/box.
// We render ONE giant colored character (e.g. a green "A") as the body. The
// glyph lives inside a tightly-sized inline-block "stage" so that absolute
// positioning (top/left/%) is measured against the GLYPH, not a square card.
// Eyes, jaws, ears, hat, tail, spikes, etc. are absolutely positioned OVER the
// glyph so the LETTER looks like the creature.
//
// No image files, no external libs — everything is emoji + CSS shapes.
//
// Model: slot-based (reliable on touch). Each slot (eyes / mouth / ears / hat /
// tail / extra) holds ONE chosen piece. Tapping a piece in the sidebar sets the
// slot's piece; tapping "None" clears it. The Colors tab recolors the glyph. A
// "Surprise!" button auto-dresses the letter as its themed animal. Tapping the
// big letter plays the letter's sound via the shared playLetter() helper.

import { useState } from 'react';
import { LETTERS, type LetterEntry } from '@/lib/letters/data';
import { speak, playLetter } from '@/lib/letters/speak';

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

// Selected pieces per slot (undefined = empty slot).
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

// Slit-pupil reptile eye for gators / iguanas / snakes.
function ReptileEye({ size = 42 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 40%, #fde047 0%, #ca8a04 80%)',
        border: '3px solid #111827',
        position: 'relative',
        display: 'inline-block',
        boxShadow: '0 2px 4px rgba(0,0,0,.25)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: Math.max(4, size * 0.14),
          height: size * 0.78,
          background: '#111827',
          borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      />
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

// ----- CSS shape sub-components ---------------------------------------------
// Declared before the catalogs that reference them.

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

// Big open alligator jaws: top + bottom rows of pointy teeth on a red mouth.
function Jaws({ w }: { w: number }) {
  const teeth = 7;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {Array.from({ length: teeth }).map((_, i) => (
          <Triangle key={i} size={w / teeth} color="#fff" rotate={180} />
        ))}
      </span>
      <span style={{ width: w, height: Math.max(6, w * 0.06), background: '#7f1d1d', borderRadius: 3 }} />
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {Array.from({ length: teeth }).map((_, i) => (
          <Triangle key={i} size={w / teeth} color="#fff" />
        ))}
      </span>
    </span>
  );
}

// A round snout (bear / pig) — an oval with two nostrils.
function Snout({ w, color = '#1f2937' }: { w: number; color?: string }) {
  return (
    <span
      style={{
        width: w,
        height: w * 0.66,
        background: color,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: w * 0.16,
        boxShadow: '0 2px 4px rgba(0,0,0,.2)',
      }}
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: w * 0.14,
            height: w * 0.22,
            background: 'rgba(0,0,0,.55)',
            borderRadius: '50%',
          }}
        />
      ))}
    </span>
  );
}

function Tongue({ w }: { w: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <Smile w={w} />
      <span
        style={{
          width: w * 0.32,
          height: w * 0.3,
          background: '#fb7185',
          borderRadius: '0 0 999px 999px',
          marginTop: -w * 0.08,
          border: '2px solid #be123c',
        }}
      />
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

// Floppy round ears (dog / elephant).
function FloppyEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.1 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s,
            height: s * 1.4,
            background: '#a16207',
            border: '3px solid #78350f',
            borderRadius: '50% 50% 50% 50%',
            display: 'inline-block',
            transform: i === 0 ? 'rotate(-18deg)' : 'rotate(18deg)',
          }}
        />
      ))}
    </span>
  );
}

// Curly ram / goat horns.
function Horns({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.4 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s * 0.8,
            height: s,
            border: `${Math.max(4, s * 0.18)}px solid #d6d3d1`,
            borderRadius: '50%',
            borderBottomColor: 'transparent',
            borderRightColor: i === 0 ? 'transparent' : '#d6d3d1',
            borderLeftColor: i === 1 ? 'transparent' : '#d6d3d1',
            display: 'inline-block',
            transform: i === 0 ? 'rotate(-30deg)' : 'rotate(30deg)',
          }}
        />
      ))}
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

function FluffyTail({ s }: { s: number }) {
  return (
    <span
      style={{
        width: 60 * s,
        height: 60 * s,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #fff 0%, #e5e7eb 70%)',
        border: '3px solid #d1d5db',
        display: 'inline-block',
      }}
    />
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
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: d.c,
            opacity: 0.9,
          }}
        />
      ))}
    </>
  );
}

function Stripes() {
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'repeating-linear-gradient(20deg, rgba(0,0,0,.55) 0 10px, transparent 10px 34px)',
        WebkitMaskImage: 'radial-gradient(circle, #000 60%, transparent 78%)',
        maskImage: 'radial-gradient(circle, #000 60%, transparent 78%)',
        borderRadius: '1.5rem',
      }}
    />
  );
}

// ----- Piece catalogs ------------------------------------------------------
// Each slot has a "None" implicit option (the Clear button). Variety is the
// point: a kid can theme the animal OR make a goofy mashup. Each slot has
// 5-8 options.

const EYES: Piece[] = [
  { id: 'cartoon', label: 'Cartoon eyes', preview: row(<><CartoonEye size={22} /><CartoonEye size={22} /></>), render: row(<><CartoonEye size={50} /><CartoonEye size={50} /></>) },
  { id: 'googly', label: 'Googly eyes', preview: row(<><GooglyEye size={22} /><GooglyEye size={22} /></>), render: row(<><GooglyEye size={48} /><GooglyEye size={48} /></>) },
  { id: 'reptile', label: 'Reptile eyes', preview: row(<><ReptileEye size={22} /><ReptileEye size={22} /></>), render: row(<><ReptileEye size={48} /><ReptileEye size={48} /></>) },
  { id: 'emoji', label: 'Big eyes', preview: <span style={{ fontSize: 30 }}>👀</span>, render: <span style={{ fontSize: 70 }}>👀</span> },
  { id: 'shades', label: 'Cool shades', preview: <span style={{ fontSize: 30 }}>😎</span>, render: <span style={{ fontSize: 76 }}>🕶️</span> },
  { id: 'sleepy', label: 'Sleepy eyes', preview: row(<><SleepyEye w={22} /><SleepyEye w={22} /></>), render: row(<><SleepyEye w={48} /><SleepyEye w={48} /></>) },
  { id: 'star', label: 'Star eyes', preview: <span style={{ fontSize: 28 }}>🤩</span>, render: <span style={{ fontSize: 70 }}>🤩</span> },
];

const MOUTH: Piece[] = [
  { id: 'jaws', label: 'Gator jaws', preview: <Jaws w={44} />, render: <Jaws w={160} /> },
  { id: 'grin', label: 'Toothy grin', preview: <ToothyGrin w={40} />, render: <ToothyGrin w={130} /> },
  { id: 'smile', label: 'Happy smile', preview: <Smile w={40} />, render: <Smile w={120} /> },
  { id: 'snout', label: 'Animal snout', preview: <Snout w={40} />, render: <Snout w={120} /> },
  { id: 'beaver', label: 'Beaver teeth', preview: <BeaverTeeth s={14} />, render: <BeaverTeeth s={34} /> },
  { id: 'beak', label: 'Bird beak', preview: <span style={{ fontSize: 28 }}>🔶</span>, render: <Triangle size={64} color="#f59e0b" rotate={180} /> },
  { id: 'tongue', label: 'Silly tongue', preview: <span style={{ fontSize: 28 }}>😛</span>, render: <Tongue w={120} /> },
  { id: 'teeth', label: 'Tooth', preview: <span style={{ fontSize: 30 }}>🦷</span>, render: <span style={{ fontSize: 64 }}>🦷</span> },
];

const EARS: Piece[] = [
  { id: 'bear', label: 'Bear ears', preview: <BearEars s={16} />, render: <BearEars s={50} /> },
  { id: 'cat', label: 'Cat ears', preview: <CatEars s={18} />, render: <CatEars s={52} /> },
  { id: 'bunny', label: 'Bunny ears', preview: <span style={{ fontSize: 28 }}>🐰</span>, render: <BunnyEars /> },
  { id: 'floppy', label: 'Floppy ears', preview: <FloppyEars s={16} />, render: <FloppyEars s={46} /> },
  { id: 'horns', label: 'Goat horns', preview: <Horns s={18} />, render: <Horns s={52} /> },
  { id: 'antlers', label: 'Antlers', preview: <span style={{ fontSize: 28 }}>🦌</span>, render: <span style={{ fontSize: 90 }}>🦌</span> },
];

const HAT: Piece[] = [
  { id: 'crown', label: 'Crown', preview: <span style={{ fontSize: 30 }}>👑</span>, render: <span style={{ fontSize: 86 }}>👑</span> },
  { id: 'tophat', label: 'Top hat', preview: <span style={{ fontSize: 30 }}>🎩</span>, render: <span style={{ fontSize: 86 }}>🎩</span> },
  { id: 'cap', label: 'Ball cap', preview: <span style={{ fontSize: 30 }}>🧢</span>, render: <span style={{ fontSize: 86 }}>🧢</span> },
  { id: 'party', label: 'Party hat', preview: <span style={{ fontSize: 30 }}>🥳</span>, render: <PartyHat /> },
  { id: 'wizard', label: 'Wizard hat', preview: <span style={{ fontSize: 30 }}>🧙</span>, render: <span style={{ fontSize: 86 }}>🪄</span> },
  { id: 'bow', label: 'Big bow', preview: <span style={{ fontSize: 30 }}>🎀</span>, render: <span style={{ fontSize: 80 }}>🎀</span> },
];

const TAIL: Piece[] = [
  { id: 'spiked', label: 'Spiky tail', preview: <span style={{ fontSize: 26 }}>🦎</span>, render: <SpikedTail /> },
  { id: 'curvy', label: 'Curvy tail', preview: <CurvyTail s={0.45} />, render: <CurvyTail s={1} /> },
  { id: 'paddle', label: 'Beaver tail', preview: <PaddleTail s={0.4} />, render: <PaddleTail s={1} /> },
  { id: 'fluffy', label: 'Fluffy tail', preview: <FluffyTail s={0.45} />, render: <FluffyTail s={1} /> },
  { id: 'fish', label: 'Fish tail', preview: <span style={{ fontSize: 26 }}>🐟</span>, render: <span style={{ fontSize: 80 }}>🐟</span> },
  { id: 'mouse', label: 'Mouse tail', preview: <span style={{ fontSize: 26 }}>〰️</span>, render: <span style={{ fontSize: 70, transform: 'rotate(20deg)', display: 'inline-block' }}>〰️</span> },
];

const EXTRA: Piece[] = [
  { id: 'spikes', label: 'Back spikes', preview: <SpikeRow s={0.5} />, render: <SpikeRow s={1} /> },
  { id: 'stripes', label: 'Tiger stripes', preview: <span style={{ fontSize: 26 }}>🐯</span>, render: <Stripes /> },
  { id: 'dots', label: 'Polka dots', preview: <span style={{ fontSize: 26 }}>🔴</span>, render: <PolkaDots /> },
  { id: 'scarf', label: 'Cozy scarf', preview: <Scarf s={0.45} />, render: <Scarf s={1} /> },
  { id: 'star', label: 'Sparkles', preview: <span style={{ fontSize: 28 }}>🌟</span>, render: <span style={{ fontSize: 60 }}>✨</span> },
  { id: 'whiskers', label: 'Whiskers', preview: <span style={{ fontSize: 26 }}>🐱</span>, render: <span style={{ fontSize: 80 }}>🐾</span> },
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
  '#6b7280', '#f97316', // gray, orange
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

// ----- Themed presets (per-letter relevance + Surprise!) -------------------
// `outfit` = the costume to auto-apply. `color` = themed glyph color.
// `highlight` = piece ids per slot that are "on-theme" for this animal — used
// to sort/star the most relevant pieces FIRST in the sidebar.

interface Preset {
  outfit: Outfit;
  color: string;
  highlight: Partial<Record<Slot, string[]>>;
}

function presetFor(entry: LetterEntry): Preset {
  const a = entry.animal.toLowerCase();

  const make = (
    outfit: Outfit,
    color: string,
    highlight: Partial<Record<Slot, string[]>>,
  ): Preset => ({ outfit, color, highlight });

  if (a.includes('alligator'))
    return make({ eyes: 'reptile', mouth: 'jaws', tail: 'spiked', extra: 'spikes' }, '#22c55e',
      { eyes: ['reptile'], mouth: ['jaws'], tail: ['spiked'], extra: ['spikes'] });
  if (a.includes('bear'))
    return make({ eyes: 'cartoon', mouth: 'snout', ears: 'bear', extra: 'scarf' }, '#92400e',
      { eyes: ['cartoon'], mouth: ['snout'], ears: ['bear'] });
  if (a.includes('cat'))
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'curvy', extra: 'whiskers' }, '#f59e0b',
      { eyes: ['cartoon'], ears: ['cat'], tail: ['curvy'], extra: ['whiskers'] });
  if (a.includes('dog'))
    return make({ eyes: 'cartoon', mouth: 'tongue', ears: 'floppy', tail: 'curvy' }, '#eab308',
      { eyes: ['cartoon'], mouth: ['tongue'], ears: ['floppy'], tail: ['curvy'] });
  if (a.includes('elephant'))
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'floppy' }, '#9ca3af',
      { eyes: ['cartoon'], ears: ['floppy'] });
  if (a.includes('fish'))
    return make({ eyes: 'googly', mouth: 'smile', tail: 'fish', extra: 'dots' }, '#0ea5e9',
      { eyes: ['googly'], tail: ['fish'] });
  if (a.includes('goat'))
    return make({ eyes: 'cartoon', mouth: 'beaver', ears: 'horns' }, '#10b981',
      { eyes: ['cartoon'], ears: ['horns'] });
  if (a.includes('horse'))
    return make({ eyes: 'cartoon', mouth: 'beaver', ears: 'cat', tail: 'curvy' }, '#a16207',
      { eyes: ['cartoon'], tail: ['curvy'] });
  if (a.includes('iguana') || a.includes('newt'))
    return make({ eyes: 'reptile', mouth: 'grin', tail: 'spiked', extra: 'spikes' }, '#22c55e',
      { eyes: ['reptile'], mouth: ['grin'], tail: ['spiked'], extra: ['spikes'] });
  if (a.includes('jellyfish'))
    return make({ eyes: 'googly', mouth: 'smile', extra: 'dots' }, '#a855f7',
      { eyes: ['googly'], extra: ['dots'] });
  if (a.includes('kangaroo'))
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'paddle' }, '#3b82f6',
      { eyes: ['cartoon'], ears: ['cat'], tail: ['paddle'] });
  if (a.includes('lion'))
    return make({ eyes: 'cartoon', mouth: 'grin', ears: 'bear', tail: 'curvy', extra: 'whiskers' }, '#f59e0b',
      { eyes: ['cartoon'], mouth: ['grin'], extra: ['whiskers'] });
  if (a.includes('monkey'))
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'bear', tail: 'curvy' }, '#92400e',
      { eyes: ['cartoon'], ears: ['bear'], tail: ['curvy'] });
  if (a.includes('newt'))
    return make({ eyes: 'reptile', mouth: 'grin', tail: 'spiked', extra: 'spikes' }, '#16a34a',
      { eyes: ['reptile'], tail: ['spiked'], extra: ['spikes'] });
  if (a.includes('octopus'))
    return make({ eyes: 'googly', mouth: 'smile', extra: 'dots' }, '#d946ef',
      { eyes: ['googly'], extra: ['dots'] });
  if (a.includes('pig'))
    return make({ eyes: 'cartoon', mouth: 'snout', ears: 'floppy', tail: 'curvy' }, '#f472b6',
      { mouth: ['snout'], ears: ['floppy'], tail: ['curvy'] });
  if (a.includes('queen') || a.includes('bee'))
    return make({ eyes: 'cartoon', mouth: 'smile', hat: 'crown', extra: 'star' }, '#eab308',
      { hat: ['crown'], extra: ['star'] });
  if (a.includes('rabbit'))
    return make({ eyes: 'cartoon', mouth: 'beaver', ears: 'bunny', tail: 'fluffy' }, '#f472b6',
      { mouth: ['beaver'], ears: ['bunny'], tail: ['fluffy'] });
  if (a.includes('snake'))
    return make({ eyes: 'reptile', mouth: 'tongue', tail: 'curvy' }, '#16a34a',
      { eyes: ['reptile'], mouth: ['tongue'] });
  if (a.includes('tiger'))
    return make({ eyes: 'cartoon', mouth: 'grin', ears: 'cat', tail: 'curvy', extra: 'stripes' }, '#f59e0b',
      { ears: ['cat'], extra: ['stripes'], mouth: ['grin'] });
  if (a.includes('umbrella') || a.includes('vulture') || a.includes('bird'))
    return make({ eyes: 'googly', mouth: 'beak', extra: 'star' }, '#84cc16',
      { eyes: ['googly'], mouth: ['beak'] });
  if (a.includes('whale'))
    return make({ eyes: 'cartoon', mouth: 'smile', tail: 'fish' }, '#3b82f6',
      { tail: ['fish'] });
  if (a.includes('fox'))
    return make({ eyes: 'cartoon', mouth: 'grin', ears: 'cat', tail: 'fluffy' }, '#f97316',
      { ears: ['cat'], tail: ['fluffy'] });
  if (a.includes('yak'))
    return make({ eyes: 'cartoon', mouth: 'beaver', ears: 'horns', extra: 'scarf' }, '#6b7280',
      { ears: ['horns'] });
  if (a.includes('zebra'))
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'cat', tail: 'curvy', extra: 'stripes' }, '#111827',
      { extra: ['stripes'] });

  // Generic friendly fallback.
  return make({ eyes: 'cartoon', mouth: 'smile', ears: 'bear' }, entry.color,
    { eyes: ['cartoon'], mouth: ['smile'] });
}

// Order a slot's pieces so on-theme ones come first.
function orderedPieces(slot: Slot, highlight: string[]): Piece[] {
  const list = CATALOG[slot];
  if (!highlight.length) return list;
  const hi = list.filter((p) => highlight.includes(p.id));
  const rest = list.filter((p) => !highlight.includes(p.id));
  return [...hi, ...rest];
}

// ----- Slot positioning over the GLYPH -------------------------------------
// Positions are relative to the glyph stage (tightly sized around the letter),
// so pieces sit ON the letter — not on a separate card.

function slotStyle(slot: Slot): React.CSSProperties {
  switch (slot) {
    case 'eyes':
      return { top: '20%', left: '50%', transform: 'translate(-50%,-50%)' };
    case 'mouth':
      return { top: '60%', left: '50%', transform: 'translate(-50%,-50%)' };
    case 'ears':
      return { top: '2%', left: '50%', transform: 'translate(-50%,-100%)' };
    case 'hat':
      return { top: '-2%', left: '50%', transform: 'translate(-50%,-100%)' };
    case 'tail':
      return { top: '58%', right: '-4%', transform: 'translate(100%,0)' };
    case 'extra':
      return { inset: 0 }; // extras decorate the whole glyph area
    default:
      return {};
  }
}

// ----- Main component ------------------------------------------------------
// Exported with NO required props — the page renders <DressUpStudio />.

export default function DressUpStudio() {
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<TabKey>('eyes');
  const [outfit, setOutfit] = useState<Outfit>({});
  const [color, setColor] = useState<string>(LETTERS[0].color);

  const entry = LETTERS[idx];
  const preset = presetFor(entry);

  const goLetter = (next: number) => {
    const i = (next + LETTERS.length) % LETTERS.length;
    setIdx(i);
    setOutfit({});                  // reset the costume on a fresh letter
    setColor(LETTERS[i].color);
    playLetter(LETTERS[i]);
  };

  const pickPiece = (slot: Slot, id: string) => {
    setOutfit((o) => ({ ...o, [slot]: o[slot] === id ? undefined : id }));
  };

  const clearSlot = (slot: Slot) => setOutfit((o) => ({ ...o, [slot]: undefined }));

  const surprise = () => {
    setOutfit(preset.outfit);
    setColor(preset.color);
    speak(`Look! ${entry.letter} is ${anA(entry.animal)} ${entry.animal}!`);
  };

  const startOver = () => {
    setOutfit({});
    setColor(entry.color);
  };

  // Render one decoration piece, positioned relative to the glyph stage.
  const renderSlot = (slot: Slot) => {
    const id = outfit[slot];
    if (!id) return null;
    const piece = CATALOG[slot].find((p) => p.id === id);
    if (!piece) return null;
    return (
      <span
        key={slot}
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: slot === 'extra' ? 6 : 5,
          pointerEvents: 'none',
          ...slotStyle(slot),
        }}
      >
        {piece.render}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-4 sm:p-6">
      {/* Suggestion banner */}
      <div className="text-center mb-4">
        <p className="text-purple-800 font-black text-lg sm:text-2xl">
          Make {entry.letter} look like {anA(entry.animal)} {entry.animal}! {entry.emoji}
        </p>
        <p className="text-purple-400 text-xs sm:text-sm font-bold">
          Dress the letter, not a box — give {entry.letter} some eyes! 👀
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---- Stage (the LETTER is the body) ---- */}
        <div className="flex-1 flex flex-col items-center">
          {/* A neutral playmat so the glyph + decorations read clearly. The mat
              is NOT decorated — only the letter is. */}
          <div className="relative w-full rounded-[2rem] bg-gradient-to-b from-purple-50 to-white border-2 border-purple-100 flex items-center justify-center py-10 px-6 overflow-visible"
               style={{ minHeight: 380 }}>
            {/* Tight glyph stage: sized to the letter so decorations attach to
                the GLYPH, not a square card. */}
            <button
              onClick={() => playLetter(entry)}
              aria-label={`Hear the sound for the letter ${entry.letter}`}
              className="relative focus:outline-none active:scale-95 transition-transform"
              style={{ lineHeight: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {/* the giant colored LETTER itself = the creature's body */}
              <span
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  fontWeight: 900,
                  fontSize: 'min(46vw, 340px)',
                  lineHeight: 0.92,
                  color,
                  textShadow: '0 6px 0 rgba(0,0,0,0.14), 0 10px 18px rgba(0,0,0,0.18)',
                  userSelect: 'none',
                  WebkitTextStroke: '3px rgba(0,0,0,0.18)',
                  transition: 'color 0.3s',
                  padding: '0 0.06em',
                }}
              >
                {entry.letter}
                {/* decorations attach ON the glyph (slots positioned relative
                    to THIS inline-block span). Render order = z-stacking. */}
                {(['extra', 'tail', 'hat', 'ears', 'eyes', 'mouth'] as Slot[]).map((s) =>
                  renderSlot(s),
                )}
              </span>
            </button>
          </div>
          <p className="text-center text-purple-400 text-xs mt-2">👆 Tap the letter to hear its sound</p>

          {/* prev / next */}
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
          <div className="flex flex-wrap gap-1 justify-center mt-4 max-w-[480px]">
            {LETTERS.map((l, i) => (
              <button
                key={l.letter}
                onClick={() => goLetter(i)}
                className={`w-8 h-8 rounded-lg font-black text-white text-xs transition-transform hover:scale-110 ${i === idx ? 'ring-4 ring-purple-300' : ''}`}
                style={{ background: l.color }}
                aria-label={`Dress up the letter ${l.letter}`}
              >
                {l.letter}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Sidebar (stacks under the letter on small screens) ---- */}
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
                    aria-label={`Color the letter ${c}`}
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
                {orderedPieces(tab as Slot, preset.highlight[tab as Slot] ?? []).map((p) => {
                  const active = outfit[tab as Slot] === p.id;
                  const themed = (preset.highlight[tab as Slot] ?? []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickPiece(tab as Slot, p.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl bg-white border-2 p-2 h-24 hover:bg-purple-100 transition-colors overflow-hidden ${
                        active
                          ? 'border-purple-500 ring-2 ring-purple-300'
                          : themed
                            ? 'border-pink-300'
                            : 'border-purple-100'
                      }`}
                      aria-label={themed ? `${p.label} (perfect for ${entry.animal})` : p.label}
                      title={p.label}
                    >
                      {themed && (
                        <span className="absolute top-0.5 right-1 text-xs" aria-hidden>⭐</span>
                      )}
                      <span className="flex-1 flex items-center justify-center overflow-hidden">{p.preview}</span>
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
            ⭐ = perfect for {anA(entry.animal)} {entry.animal}. Mix any pieces for a silly mash-up! 🤪
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
