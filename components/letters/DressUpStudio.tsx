'use client';

// Dress Up Studio — a playful "decorate the LETTER" canvas for the Letters &
// Sounds section (preschool / kindergarten). A kid picks a letter, then dresses
// the giant BARE letter GLYPH itself to look like the animal it stands for
// (A → Alligator) OR makes a silly mashup.
//
// KEY DESIGN (new model): there is NO face box / panel. The huge bold colored
// LETTER GLYPH is the character. Decorations go directly over and around the
// glyph. We do NOT auto-anchor pieces (letter shapes vary wildly — a smile on a
// C lands in a corner). Instead:
//
//   TAP TO ADD, then DRAG TO MOVE.
//   - Tapping a piece in the sidebar ADDS it to the canvas near the letter.
//   - Each placed piece can then be DRAGGED anywhere (Pointer Events, so it
//     works on mouse AND touch / iPad). Drags are clamped to the canvas.
//   - A placed piece shows a small ✕ to delete it. "Start over" clears all.
//
// The canvas holds a LIST of placed pieces, each {id, kind, pieceId, x, y},
// with free positions. Multiple pieces of the same kind are allowed (two eyes,
// several spikes). The sidebar tabs just choose which piece to ADD next.
//
// No image files, no external libs — everything is emoji + CSS shapes.
// Tapping the big letter plays the letter's sound via playLetter().

import { useCallback, useRef, useState } from 'react';
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
  render: React.ReactNode;  // how it looks on the canvas
}

// A piece the kid has placed on the canvas. Free x/y as a PERCENT of the canvas
// (0–100) so it scales with the responsive play area.
interface Placed {
  uid: string;   // unique instance id
  kind: Slot;    // which catalog it came from
  pieceId: string;
  x: number;     // 0–100 (% of canvas width)
  y: number;     // 0–100 (% of canvas height)
}

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

// An angry eye: a white eye with a slanted brow over it.
function AngryEye({ size = 42, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size * 1.2 }}>
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: Math.max(5, size * 0.18),
          background: '#111827',
          borderRadius: 4,
          transform: `rotate(${flip ? -22 : 22}deg)`,
          transformOrigin: 'center',
          zIndex: 2,
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#fff',
          border: '3px solid #111827',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '55%',
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: '50%',
            background: '#111827',
            transform: 'translate(-50%,-50%)',
          }}
        />
      </span>
    </span>
  );
}

// A spiral / dizzy eye.
function SpiralEye({ size = 44 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        border: '3px solid #111827',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,.2)',
      }}
    >
      <span
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: '50%',
          border: `${Math.max(3, size * 0.1)}px solid #1f2937`,
          borderTopColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '55%',
            height: '55%',
            margin: '18% auto',
            borderRadius: '50%',
            border: `${Math.max(2, size * 0.07)}px solid #1f2937`,
            borderBottomColor: 'transparent',
            borderRightColor: 'transparent',
          }}
        />
      </span>
    </span>
  );
}

// A pair of cartoon eyes with long curly eyelashes.
function LashEye({ size = 42 }: { size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'absolute', top: -size * 0.18, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', zIndex: 2 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: size * 0.32,
              background: '#111827',
              borderRadius: 3,
              transform: `rotate(${(i - 1) * 22}deg)`,
            }}
          />
        ))}
      </span>
      <CartoonEye size={size} />
    </span>
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

function Frown({ w }: { w: number }) {
  return (
    <span
      style={{
        width: w,
        height: w * 0.55,
        border: `${Math.max(4, w * 0.06)}px solid #111827`,
        borderBottom: 'none',
        borderRadius: `${w}px ${w}px 0 0`,
        display: 'inline-block',
      }}
    />
  );
}

// A round open "O" mouth (surprise / whistle).
function OpenMouth({ w, color = '#7f1d1d' }: { w: number; color?: string }) {
  return (
    <span
      style={{
        width: w * 0.7,
        height: w * 0.7,
        borderRadius: '50%',
        background: color,
        border: '4px solid #450a0a',
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

// Two pointy fangs hanging from a lip line.
function Fangs({ w }: { w: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ width: w, height: Math.max(5, w * 0.08), background: '#111827', borderRadius: 4 }} />
      <span style={{ display: 'inline-flex', justifyContent: 'space-between', width: w * 0.7, marginTop: -2 }}>
        <Triangle size={w * 0.26} color="#fff" />
        <Triangle size={w * 0.26} color="#fff" />
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

// A bushy mustache.
function Mustache({ w }: { w: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: w * 0.5,
            height: w * 0.42,
            background: '#3f2d1c',
            borderRadius: i === 0 ? '80% 10% 60% 40%' : '10% 80% 40% 60%',
            transform: i === 0 ? 'scaleX(1)' : 'scaleX(1)',
          }}
        />
      ))}
    </span>
  );
}

// Kissy lips.
function KissyLips({ w }: { w: number }) {
  return (
    <span
      style={{
        width: w * 0.5,
        height: w * 0.5,
        background: '#e11d48',
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        display: 'inline-block',
        boxShadow: 'inset 0 -3px 4px rgba(0,0,0,.25)',
      }}
    />
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

// Big elephant ears — wide floppy fans.
function ElephantEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 0.6 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s * 1.4,
            height: s * 1.6,
            background: '#9ca3af',
            border: '3px solid #6b7280',
            borderRadius: '60% 60% 70% 70%',
            display: 'inline-block',
            transform: i === 0 ? 'rotate(-10deg)' : 'rotate(10deg)',
          }}
        />
      ))}
    </span>
  );
}

// Round mouse ears.
function MouseEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.4 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: s * 1.1,
            height: s * 1.1,
            borderRadius: '50%',
            background: '#d1d5db',
            border: '3px solid #9ca3af',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

// Pink pig ears (small forward-flopping triangles).
function PigEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.3 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: 0,
            height: 0,
            borderLeft: `${s * 0.45}px solid transparent`,
            borderRight: `${s * 0.45}px solid transparent`,
            borderTop: `${s}px solid #f9a8d4`,
            display: 'inline-block',
            transform: i === 0 ? 'rotate(-18deg)' : 'rotate(18deg)',
          }}
        />
      ))}
    </span>
  );
}

// Fox ears — tall pointy with dark tips.
function FoxEars({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.1, alignItems: 'flex-end' }}>
      {[0, 1].map((i) => (
        <span key={i} style={{ position: 'relative' }}>
          <Triangle size={s} color="#f97316" rotate={i === 0 ? -12 : 12} />
          <span
            style={{
              position: 'absolute',
              top: -2,
              left: '50%',
              transform: `translateX(-50%) rotate(${i === 0 ? -12 : 12}deg)`,
            }}
          >
            <Triangle size={s * 0.5} color="#1f2937" />
          </span>
        </span>
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

// Straight devil horns.
function DevilHorns({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: s * 1.6 }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: 0,
            height: 0,
            borderLeft: `${s * 0.35}px solid transparent`,
            borderRight: `${s * 0.35}px solid transparent`,
            borderBottom: `${s * 1.2}px solid #dc2626`,
            display: 'inline-block',
            transform: i === 0 ? 'rotate(-22deg)' : 'rotate(22deg)',
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

// A simple knit beanie — half-dome with a brim.
function Beanie({ w }: { w: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: w * 0.3 }}>🔴</span>
      <span
        style={{
          width: w,
          height: w * 0.55,
          background: '#2563eb',
          borderRadius: `${w}px ${w}px 0 0`,
          marginTop: -w * 0.12,
        }}
      />
      <span style={{ width: w * 1.1, height: w * 0.18, background: '#1e3a8a', borderRadius: 6, marginTop: -2 }} />
    </span>
  );
}

// A propeller beanie.
function PropellerHat({ w }: { w: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ width: w, height: 4, background: '#ef4444', borderRadius: 4 }} />
      <span style={{ width: 8, height: 8, background: '#111827', borderRadius: '50%', marginTop: -2 }} />
      <span
        style={{
          width: w * 0.9,
          height: w * 0.5,
          background: 'conic-gradient(#22c55e 0 90deg,#eab308 90deg 180deg,#3b82f6 180deg 270deg,#ef4444 270deg)',
          borderRadius: `${w}px ${w}px 0 0`,
          marginTop: 2,
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

// A thin curly pig tail.
function CurlyPigTail({ s }: { s: number }) {
  const w = 50 * s;
  return (
    <span
      style={{
        width: w,
        height: w,
        border: `${Math.max(4, 7 * s)}px solid #f472b6`,
        borderRadius: '50%',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        display: 'inline-block',
        transform: 'rotate(-20deg)',
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

// A curled scorpion tail with a stinger.
function ScorpionTail({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
      <span
        style={{
          width: 60 * s,
          height: 60 * s,
          border: `${Math.max(5, 12 * s)}px solid #1f2937`,
          borderRadius: '50%',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          display: 'inline-block',
          transform: 'rotate(135deg)',
        }}
      />
      <Triangle size={22 * s} color="#dc2626" rotate={200} />
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

// A bushy fox tail with a white tip.
function FoxTail({ s }: { s: number }) {
  return (
    <span
      style={{
        width: 100 * s,
        height: 46 * s,
        background: 'linear-gradient(90deg, #f97316 0%, #f97316 60%, #fff 100%)',
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        display: 'inline-block',
        transform: 'rotate(-20deg)',
        border: '3px solid #c2410c',
      }}
    />
  );
}

// A thin mouse tail (curved line).
function MouseTail({ s }: { s: number }) {
  return (
    <span
      style={{
        width: 90 * s,
        height: 50 * s,
        border: `${Math.max(3, 5 * s)}px solid #d1d5db`,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderRadius: '50%',
        display: 'inline-block',
        transform: 'rotate(35deg)',
      }}
    />
  );
}

// A devil tail with an arrow tip.
function DevilTail({ s }: { s: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
      <span
        style={{
          width: 70 * s,
          height: 70 * s,
          border: `${Math.max(4, 9 * s)}px solid #dc2626`,
          borderRadius: '50%',
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          display: 'inline-block',
          transform: 'rotate(45deg)',
        }}
      />
      <Triangle size={22 * s} color="#991b1b" rotate={150} />
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

// A small cluster of polka dots (placed as one draggable blob).
function DotCluster() {
  const dots = [
    { dx: 0, dy: 0, c: '#fef08a' },
    { dx: 34, dy: 12, c: '#fb7185' },
    { dx: 14, dy: 38, c: '#60a5fa' },
    { dx: 48, dy: 44, c: '#fff' },
    { dx: -8, dy: 28, c: '#a7f3d0' },
  ];
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 70, height: 70 }}>
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: 10 + d.dx,
            top: 10 + d.dy,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: d.c,
            border: '2px solid rgba(0,0,0,.15)',
          }}
        />
      ))}
    </span>
  );
}

// A patch of tiger stripes.
function StripePatch() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 90,
        height: 90,
        borderRadius: '50%',
        background:
          'repeating-linear-gradient(20deg, rgba(0,0,0,.6) 0 8px, transparent 8px 26px)',
        WebkitMaskImage: 'radial-gradient(circle, #000 55%, transparent 75%)',
        maskImage: 'radial-gradient(circle, #000 55%, transparent 75%)',
      }}
    />
  );
}

// Three rosy/whisker lines on a side (cat whiskers).
function Whiskers() {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 140, height: 60 }}>
      {[18, 30, 42].map((top, i) => (
        <span key={`l${i}`} style={{ position: 'absolute', left: 0, top, width: 56, height: 3, background: '#111827', borderRadius: 3, transform: `rotate(${(i - 1) * 12}deg)` }} />
      ))}
      {[18, 30, 42].map((top, i) => (
        <span key={`r${i}`} style={{ position: 'absolute', right: 0, top, width: 56, height: 3, background: '#111827', borderRadius: 3, transform: `rotate(${-(i - 1) * 12}deg)` }} />
      ))}
    </span>
  );
}

// Two rosy cheeks.
function RosyCheeks() {
  return (
    <span style={{ display: 'inline-flex', gap: 70 }}>
      {[0, 1].map((i) => (
        <span key={i} style={{ width: 34, height: 24, borderRadius: '50%', background: 'rgba(244,114,182,.7)' }} />
      ))}
    </span>
  );
}

// A few freckles.
function Freckles() {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 70, height: 36 }}>
      {[[6, 8], [22, 4], [40, 10], [56, 6], [14, 22], [34, 24], [52, 22]].map(([x, y], i) => (
        <span key={i} style={{ position: 'absolute', left: x, top: y, width: 6, height: 6, borderRadius: '50%', background: '#b45309' }} />
      ))}
    </span>
  );
}

// A bowtie.
function BowTie() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 0, height: 0, borderTop: '22px solid transparent', borderBottom: '22px solid transparent', borderRight: '28px solid #dc2626' }} />
      <span style={{ width: 12, height: 16, background: '#991b1b', borderRadius: 3 }} />
      <span style={{ width: 0, height: 0, borderTop: '22px solid transparent', borderBottom: '22px solid transparent', borderLeft: '28px solid #dc2626' }} />
    </span>
  );
}

// A column of buttons.
function Buttons() {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: '#111827', border: '3px solid #374151' }} />
      ))}
    </span>
  );
}

// ----- Piece catalogs ------------------------------------------------------
// Variety is the point: a kid can theme the animal OR make a goofy mashup.
// Each slot has ~12–16 options.

const EYES: Piece[] = [
  { id: 'cartoon', label: 'Cartoon eyes', preview: row(<><CartoonEye size={22} /><CartoonEye size={22} /></>), render: row(<><CartoonEye size={50} /><CartoonEye size={50} /></>) },
  { id: 'googly', label: 'Googly eyes', preview: row(<><GooglyEye size={22} /><GooglyEye size={22} /></>), render: row(<><GooglyEye size={48} /><GooglyEye size={48} /></>) },
  { id: 'reptile', label: 'Reptile eyes', preview: row(<><ReptileEye size={22} /><ReptileEye size={22} /></>), render: row(<><ReptileEye size={48} /><ReptileEye size={48} /></>) },
  { id: 'big', label: 'Big eyes', preview: <span style={{ fontSize: 30 }}>👀</span>, render: <span style={{ fontSize: 70 }}>👀</span> },
  { id: 'shades', label: 'Cool shades', preview: <span style={{ fontSize: 30 }}>😎</span>, render: <span style={{ fontSize: 76 }}>🕶️</span> },
  { id: 'sleepy', label: 'Sleepy eyes', preview: row(<><SleepyEye w={22} /><SleepyEye w={22} /></>), render: row(<><SleepyEye w={48} /><SleepyEye w={48} /></>) },
  { id: 'star', label: 'Star eyes', preview: <span style={{ fontSize: 28 }}>🤩</span>, render: <span style={{ fontSize: 70 }}>🤩</span> },
  { id: 'angry', label: 'Angry eyes', preview: row(<><AngryEye size={20} /><AngryEye size={20} flip /></>), render: row(<><AngryEye size={46} /><AngryEye size={46} flip /></>) },
  { id: 'heart', label: 'Love eyes', preview: <span style={{ fontSize: 28 }}>😍</span>, render: <span style={{ fontSize: 70 }}>😍</span> },
  { id: 'wink', label: 'Winking', preview: <span style={{ fontSize: 28 }}>😉</span>, render: <span style={{ fontSize: 70 }}>😉</span> },
  { id: 'cyclops', label: 'One big eye', preview: <GooglyEye size={30} />, render: <GooglyEye size={86} /> },
  { id: 'spiral', label: 'Dizzy eyes', preview: row(<><SpiralEye size={22} /><SpiralEye size={22} /></>), render: row(<><SpiralEye size={48} /><SpiralEye size={48} /></>) },
  { id: 'glasses', label: 'Nerd glasses', preview: <span style={{ fontSize: 30 }}>🤓</span>, render: <span style={{ fontSize: 76 }}>👓</span> },
  { id: 'lashes', label: 'Eyelashes', preview: row(<><LashEye size={20} /><LashEye size={20} /></>), render: row(<><LashEye size={46} /><LashEye size={46} /></>) },
];

const MOUTH: Piece[] = [
  { id: 'jaws', label: 'Gator jaws', preview: <Jaws w={44} />, render: <Jaws w={150} /> },
  { id: 'grin', label: 'Toothy grin', preview: <ToothyGrin w={40} />, render: <ToothyGrin w={130} /> },
  { id: 'smile', label: 'Happy smile', preview: <Smile w={40} />, render: <Smile w={120} /> },
  { id: 'frown', label: 'Sad frown', preview: <Frown w={40} />, render: <Frown w={120} /> },
  { id: 'open', label: 'Open O', preview: <OpenMouth w={36} />, render: <OpenMouth w={100} /> },
  { id: 'snout', label: 'Animal snout', preview: <Snout w={40} />, render: <Snout w={120} /> },
  { id: 'beaver', label: 'Beaver teeth', preview: <BeaverTeeth s={14} />, render: <BeaverTeeth s={34} /> },
  { id: 'beak', label: 'Bird beak', preview: <span style={{ fontSize: 28 }}>🔶</span>, render: <Triangle size={64} color="#f59e0b" rotate={180} /> },
  { id: 'tongue', label: 'Silly tongue', preview: <span style={{ fontSize: 28 }}>👅</span>, render: <Tongue w={120} /> },
  { id: 'mustache', label: 'Mustache', preview: <Mustache w={44} />, render: <Mustache w={130} /> },
  { id: 'fangs', label: 'Fangs', preview: <Fangs w={40} />, render: <Fangs w={120} /> },
  { id: 'kissy', label: 'Kissy lips', preview: <KissyLips w={44} />, render: <KissyLips w={130} /> },
  { id: 'lips', label: 'Big lips', preview: <span style={{ fontSize: 30 }}>👄</span>, render: <span style={{ fontSize: 76 }}>👄</span> },
  { id: 'tooth', label: 'Tooth', preview: <span style={{ fontSize: 30 }}>🦷</span>, render: <span style={{ fontSize: 64 }}>🦷</span> },
  { id: 'whistle', label: 'Whistle', preview: <span style={{ fontSize: 28 }}>😗</span>, render: <span style={{ fontSize: 70 }}>😗</span> },
];

const EARS: Piece[] = [
  { id: 'bear', label: 'Bear ears', preview: <BearEars s={16} />, render: <BearEars s={50} /> },
  { id: 'cat', label: 'Cat ears', preview: <CatEars s={18} />, render: <CatEars s={52} /> },
  { id: 'bunny', label: 'Bunny ears', preview: <span style={{ fontSize: 28 }}>🐰</span>, render: <BunnyEars /> },
  { id: 'floppy', label: 'Floppy dog ears', preview: <FloppyEars s={16} />, render: <FloppyEars s={46} /> },
  { id: 'horns', label: 'Goat horns', preview: <Horns s={18} />, render: <Horns s={52} /> },
  { id: 'antlers', label: 'Antlers', preview: <span style={{ fontSize: 28 }}>🦌</span>, render: <span style={{ fontSize: 90 }}>🦌</span> },
  { id: 'mouse', label: 'Mouse ears', preview: <MouseEars s={16} />, render: <MouseEars s={48} /> },
  { id: 'elephant', label: 'Elephant ears', preview: <ElephantEars s={16} />, render: <ElephantEars s={46} /> },
  { id: 'pig', label: 'Pig ears', preview: <PigEars s={18} />, render: <PigEars s={50} /> },
  { id: 'fox', label: 'Fox ears', preview: <FoxEars s={18} />, render: <FoxEars s={52} /> },
  { id: 'devil', label: 'Devil horns', preview: <DevilHorns s={18} />, render: <DevilHorns s={50} /> },
  { id: 'unicorn', label: 'Unicorn horn', preview: <span style={{ fontSize: 28 }}>🦄</span>, render: <span style={{ fontSize: 84 }}>🦄</span> },
  { id: 'feathers', label: 'Feathers', preview: <span style={{ fontSize: 28 }}>🪶</span>, render: <span style={{ fontSize: 84 }}>🪶</span> },
];

const HAT: Piece[] = [
  { id: 'crown', label: 'Crown', preview: <span style={{ fontSize: 30 }}>👑</span>, render: <span style={{ fontSize: 86 }}>👑</span> },
  { id: 'tophat', label: 'Top hat', preview: <span style={{ fontSize: 30 }}>🎩</span>, render: <span style={{ fontSize: 86 }}>🎩</span> },
  { id: 'cap', label: 'Ball cap', preview: <span style={{ fontSize: 30 }}>🧢</span>, render: <span style={{ fontSize: 86 }}>🧢</span> },
  { id: 'party', label: 'Party hat', preview: <span style={{ fontSize: 30 }}>🥳</span>, render: <PartyHat /> },
  { id: 'wizard', label: 'Wizard hat', preview: <span style={{ fontSize: 30 }}>🧙</span>, render: <span style={{ fontSize: 86 }}>🧙</span> },
  { id: 'bow', label: 'Big bow', preview: <span style={{ fontSize: 30 }}>🎀</span>, render: <span style={{ fontSize: 80 }}>🎀</span> },
  { id: 'cowboy', label: 'Cowboy hat', preview: <span style={{ fontSize: 30 }}>🤠</span>, render: <span style={{ fontSize: 86 }}>🤠</span> },
  { id: 'grad', label: 'Graduation cap', preview: <span style={{ fontSize: 30 }}>🎓</span>, render: <span style={{ fontSize: 86 }}>🎓</span> },
  { id: 'halo', label: 'Halo', preview: <span style={{ fontSize: 30 }}>😇</span>, render: <span style={{ fontSize: 80 }}>😇</span> },
  { id: 'beanie', label: 'Beanie', preview: <Beanie w={40} />, render: <Beanie w={96} /> },
  { id: 'flower', label: 'Flower', preview: <span style={{ fontSize: 30 }}>🌸</span>, render: <span style={{ fontSize: 76 }}>🌸</span> },
  { id: 'propeller', label: 'Propeller hat', preview: <PropellerHat w={40} />, render: <PropellerHat w={96} /> },
];

const TAIL: Piece[] = [
  { id: 'spiked', label: 'Spiky tail', preview: <span style={{ fontSize: 26 }}>🦎</span>, render: <SpikedTail /> },
  { id: 'curvy', label: 'Curvy tail', preview: <CurvyTail s={0.45} />, render: <CurvyTail s={1} /> },
  { id: 'paddle', label: 'Beaver paddle', preview: <PaddleTail s={0.4} />, render: <PaddleTail s={1} /> },
  { id: 'fluffy', label: 'Fluffy fox tail', preview: <FluffyTail s={0.45} />, render: <FluffyTail s={1} /> },
  { id: 'foxtail', label: 'Bushy fox tail', preview: <FoxTail s={0.4} />, render: <FoxTail s={1} /> },
  { id: 'fish', label: 'Fish tail', preview: <span style={{ fontSize: 26 }}>🐟</span>, render: <span style={{ fontSize: 80 }}>🐟</span> },
  { id: 'mouse', label: 'Mouse tail', preview: <MouseTail s={0.45} />, render: <MouseTail s={1} /> },
  { id: 'lizard', label: 'Lizard tail', preview: <span style={{ fontSize: 26 }}>〰️</span>, render: <span style={{ fontSize: 70, transform: 'rotate(20deg)', display: 'inline-block' }}>〰️</span> },
  { id: 'peacock', label: 'Peacock tail', preview: <span style={{ fontSize: 26 }}>🦚</span>, render: <span style={{ fontSize: 96 }}>🦚</span> },
  { id: 'devil', label: 'Devil tail', preview: <DevilTail s={0.4} />, render: <DevilTail s={1} /> },
  { id: 'bushy', label: 'Bushy tail', preview: <span style={{ fontSize: 26 }}>🐿️</span>, render: <span style={{ fontSize: 84 }}>🐿️</span> },
  { id: 'curly', label: 'Curly pig tail', preview: <CurlyPigTail s={0.55} />, render: <CurlyPigTail s={1.2} /> },
  { id: 'scorpion', label: 'Scorpion tail', preview: <ScorpionTail s={0.4} />, render: <ScorpionTail s={1} /> },
];

const EXTRA: Piece[] = [
  { id: 'spikes', label: 'Back spikes', preview: <SpikeRow s={0.5} />, render: <SpikeRow s={1} /> },
  { id: 'stripes', label: 'Tiger stripes', preview: <span style={{ fontSize: 26 }}>🐯</span>, render: <StripePatch /> },
  { id: 'dots', label: 'Polka dots', preview: <span style={{ fontSize: 26 }}>🔴</span>, render: <DotCluster /> },
  { id: 'scarf', label: 'Cozy scarf', preview: <Scarf s={0.45} />, render: <Scarf s={1} /> },
  { id: 'sparkles', label: 'Sparkles', preview: <span style={{ fontSize: 28 }}>✨</span>, render: <span style={{ fontSize: 64 }}>✨</span> },
  { id: 'whiskers', label: 'Whiskers', preview: <span style={{ fontSize: 26 }}>🐱</span>, render: <Whiskers /> },
  { id: 'freckles', label: 'Freckles', preview: <Freckles />, render: <Freckles /> },
  { id: 'wings', label: 'Wings', preview: <span style={{ fontSize: 28 }}>🪽</span>, render: <span style={{ fontSize: 90 }}>🪽</span> },
  { id: 'bowtie', label: 'Bowtie', preview: <BowTie />, render: <BowTie /> },
  { id: 'buttons', label: 'Buttons', preview: <Buttons />, render: <Buttons /> },
  { id: 'flower', label: 'Flower', preview: <span style={{ fontSize: 28 }}>🌼</span>, render: <span style={{ fontSize: 64 }}>🌼</span> },
  { id: 'cheeks', label: 'Rosy cheeks', preview: <span style={{ fontSize: 26 }}>😊</span>, render: <RosyCheeks /> },
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
// `set` = the themed pieces to auto-place, each with a good default x/y so the
// "Surprise me!" costume lands looking right for the animal. `color` = themed
// glyph color. `highlight` = piece ids per slot that are "on-theme" — used to
// sort/star the most relevant pieces FIRST in the sidebar.

interface SetPiece { kind: Slot; pieceId: string; x: number; y: number }

interface Preset {
  set: SetPiece[];
  color: string;
  highlight: Partial<Record<Slot, string[]>>;
}

// Sensible default positions (percent of canvas) per slot — used for both the
// "Surprise me!" themed set and where a tapped piece first lands.
const DEFAULT_POS: Record<Slot, { x: number; y: number }> = {
  eyes: { x: 50, y: 36 },
  mouth: { x: 50, y: 60 },
  ears: { x: 50, y: 14 },
  hat: { x: 50, y: 8 },
  tail: { x: 78, y: 70 },
  extra: { x: 24, y: 50 },
};

function presetFor(entry: LetterEntry): Preset {
  const a = entry.animal.toLowerCase();

  // Build a themed SET from a slot→pieceId map, placing each at its default
  // spot (eyes up top, mouth below, tail to the side, etc).
  const make = (
    pieces: Partial<Record<Slot, string>>,
    color: string,
    highlight: Partial<Record<Slot, string[]>>,
  ): Preset => {
    const set: SetPiece[] = [];
    (Object.keys(pieces) as Slot[]).forEach((kind) => {
      const pieceId = pieces[kind];
      if (!pieceId) return;
      const pos = DEFAULT_POS[kind];
      set.push({ kind, pieceId, x: pos.x, y: pos.y });
    });
    return { set, color, highlight };
  };

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
    return make({ eyes: 'cartoon', mouth: 'smile', ears: 'elephant' }, '#9ca3af',
      { eyes: ['cartoon'], ears: ['elephant'] });
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
    return make({ eyes: 'reptile', mouth: 'grin', tail: 'lizard', extra: 'spikes' }, '#22c55e',
      { eyes: ['reptile'], mouth: ['grin'], tail: ['lizard'], extra: ['spikes'] });
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
  if (a.includes('octopus'))
    return make({ eyes: 'googly', mouth: 'smile', extra: 'dots' }, '#d946ef',
      { eyes: ['googly'], extra: ['dots'] });
  if (a.includes('pig'))
    return make({ eyes: 'cartoon', mouth: 'snout', ears: 'pig', tail: 'curly' }, '#f472b6',
      { mouth: ['snout'], ears: ['pig'], tail: ['curly'] });
  if (a.includes('queen') || a.includes('bee'))
    return make({ eyes: 'cartoon', mouth: 'smile', hat: 'crown', extra: 'sparkles' }, '#eab308',
      { hat: ['crown'], extra: ['sparkles'] });
  if (a.includes('rabbit'))
    return make({ eyes: 'cartoon', mouth: 'beaver', ears: 'bunny', tail: 'fluffy' }, '#f472b6',
      { mouth: ['beaver'], ears: ['bunny'], tail: ['fluffy'] });
  if (a.includes('snake'))
    return make({ eyes: 'reptile', mouth: 'tongue', tail: 'lizard' }, '#16a34a',
      { eyes: ['reptile'], mouth: ['tongue'] });
  if (a.includes('tiger'))
    return make({ eyes: 'cartoon', mouth: 'grin', ears: 'cat', tail: 'curvy', extra: 'stripes' }, '#f59e0b',
      { ears: ['cat'], extra: ['stripes'], mouth: ['grin'] });
  if (a.includes('umbrella') || a.includes('vulture') || a.includes('bird'))
    return make({ eyes: 'googly', mouth: 'beak', extra: 'wings' }, '#84cc16',
      { eyes: ['googly'], mouth: ['beak'], extra: ['wings'] });
  if (a.includes('whale'))
    return make({ eyes: 'cartoon', mouth: 'smile', tail: 'fish' }, '#3b82f6',
      { tail: ['fish'] });
  if (a.includes('fox'))
    return make({ eyes: 'cartoon', mouth: 'grin', ears: 'fox', tail: 'foxtail' }, '#f97316',
      { ears: ['fox'], tail: ['foxtail'] });
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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

let uidCounter = 0;
function nextUid() {
  uidCounter += 1;
  return `p${uidCounter}-${Date.now()}`;
}

// ----- Main component ------------------------------------------------------
// Exported with NO required props — the page renders <DressUpStudio />.

export default function DressUpStudio() {
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<TabKey>('eyes');
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [color, setColor] = useState<string>(LETTERS[0].color);

  const canvasRef = useRef<HTMLDivElement>(null);
  // Tracks an in-progress drag so move/up know what to update without re-renders.
  const dragRef = useRef<{ uid: string; pointerId: number } | null>(null);

  const entry = LETTERS[idx];
  const preset = presetFor(entry);

  const goLetter = (next: number) => {
    const i = (next + LETTERS.length) % LETTERS.length;
    setIdx(i);
    setPlaced([]);                  // changing letters clears placed pieces
    setSelected(null);
    setColor(LETTERS[i].color);
    playLetter(LETTERS[i]);
  };

  // Tap a sidebar piece → ADD it near the letter at the slot's default spot.
  // Nudge each new same-slot piece slightly so they don't stack perfectly.
  const addPiece = (kind: Slot, pieceId: string) => {
    setPlaced((list) => {
      const sameKind = list.filter((p) => p.kind === kind).length;
      const base = DEFAULT_POS[kind];
      const jitter = sameKind * 6;
      const uid = nextUid();
      setSelected(uid);
      return [
        ...list,
        {
          uid,
          kind,
          pieceId,
          x: clamp(base.x + (sameKind % 2 === 0 ? jitter : -jitter), 6, 94),
          y: clamp(base.y + jitter, 6, 94),
        },
      ];
    });
  };

  const removePiece = (uid: string) => {
    setPlaced((list) => list.filter((p) => p.uid !== uid));
    setSelected((s) => (s === uid ? null : s));
  };

  const surprise = () => {
    setColor(preset.color);
    setSelected(null);
    setPlaced(
      preset.set.map((sp) => ({
        uid: nextUid(),
        kind: sp.kind,
        pieceId: sp.pieceId,
        x: sp.x,
        y: sp.y,
      })),
    );
    speak(`Look! ${entry.letter} is ${anA(entry.animal)} ${entry.animal}!`);
  };

  const startOver = () => {
    setPlaced([]);
    setSelected(null);
    setColor(entry.color);
  };

  // ----- Pointer-event dragging (mouse + touch / iPad) ---------------------
  // Convert a client point to canvas percent, clamped to stay inside.
  const pointToPct = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = clamp(((clientX - r.left) / r.width) * 100, 4, 96);
    const y = clamp(((clientY - r.top) / r.height) * 100, 4, 96);
    return { x, y };
  }, []);

  const onPiecePointerDown = (e: React.PointerEvent, uid: string) => {
    // Don't let the canvas/letter handle it; start dragging this piece.
    e.stopPropagation();
    setSelected(uid);
    dragRef.current = { uid, pointerId: e.pointerId };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPiecePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const pct = pointToPct(e.clientX, e.clientY);
    if (!pct) return;
    setPlaced((list) =>
      list.map((p) => (p.uid === drag.uid ? { ...p, x: pct.x, y: pct.y } : p)),
    );
  };

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-100 p-4 sm:p-6">
      {/* Suggestion banner */}
      <div className="text-center mb-4">
        <p className="text-purple-800 font-black text-lg sm:text-2xl">
          Make {entry.letter} look like {anA(entry.animal)} {entry.animal}! {entry.emoji}
        </p>
        <p className="text-purple-400 text-xs sm:text-sm font-bold">
          Tap a piece to add it, then DRAG it where you want! 👆✋
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---- Stage: a big play area holding the BARE letter glyph ---- */}
        <div className="flex-1 flex flex-col items-center">
          {/* The CANVAS: a bounded play area. The huge bold LETTER is centered
              and IS the character (no face box). Placed pieces are absolutely
              positioned by percent and dragged freely, clamped to the canvas. */}
          <div
            ref={canvasRef}
            className="relative w-full rounded-[2rem] bg-gradient-to-b from-purple-50 to-white border-2 border-purple-100 overflow-hidden"
            style={{ minHeight: 420, height: 'min(82vw, 460px)', touchAction: 'none' }}
            onPointerDown={() => setSelected(null)}
          >
            {/* The big, bold, centered, COLORED LETTER glyph — the star and the
                character itself. Tap it to hear the sound. */}
            <button
              type="button"
              onClick={() => playLetter(entry)}
              aria-label={`Hear the sound for the letter ${entry.letter}`}
              className="absolute inset-0 flex items-center justify-center focus:outline-none active:scale-95 transition-transform"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <span
                style={{
                  fontWeight: 900,
                  fontSize: 'min(64vw, 320px)',
                  lineHeight: 1,
                  color,
                  textShadow:
                    '0 4px 0 rgba(0,0,0,0.16), 0 10px 18px rgba(0,0,0,0.22)',
                  userSelect: 'none',
                  WebkitTextStroke: '3px rgba(0,0,0,0.18)',
                  transition: 'color 0.3s',
                }}
              >
                {entry.letter}
              </span>
            </button>

            {/* Placed pieces — each absolutely positioned and draggable. */}
            {placed.map((p) => {
              const piece = CATALOG[p.kind].find((c) => c.id === p.pieceId);
              if (!piece) return null;
              const isSel = selected === p.uid;
              return (
                <div
                  key={p.uid}
                  onPointerDown={(e) => onPiecePointerDown(e, p.uid)}
                  onPointerMove={onPiecePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  role="button"
                  aria-label={`${piece.label} — drag to move`}
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    zIndex: isSel ? 20 : 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    borderRadius: 14,
                    outline: isSel ? '3px dashed rgba(147,51,234,0.7)' : 'none',
                    background: isSel ? 'rgba(147,51,234,0.06)' : 'transparent',
                  }}
                >
                  {piece.render}
                  {/* Delete button (✕). Bigger tap target than it looks. */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePiece(p.uid);
                    }}
                    aria-label={`Remove ${piece.label}`}
                    style={{
                      position: 'absolute',
                      top: -10,
                      right: -10,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: '#fff',
                      border: '2px solid #fff',
                      fontWeight: 900,
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                      display: isSel ? 'flex' : 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 30,
                      touchAction: 'none',
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-center text-purple-400 text-xs mt-2">
            👆 Tap the letter to hear its sound · ✋ drag pieces to move them
          </p>

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
                {orderedPieces(tab as Slot, preset.highlight[tab as Slot] ?? []).map((p) => {
                  const themed = (preset.highlight[tab as Slot] ?? []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addPiece(tab as Slot, p.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl bg-white border-2 p-2 h-24 hover:bg-purple-100 transition-colors overflow-hidden ${
                        themed ? 'border-pink-300' : 'border-purple-100'
                      }`}
                      aria-label={themed ? `${p.label} (perfect for ${entry.animal}) — tap to add` : `${p.label} — tap to add`}
                      title={`${p.label} — tap to add, then drag`}
                    >
                      {themed && (
                        <span className="absolute top-0.5 right-1 text-xs" aria-hidden>⭐</span>
                      )}
                      <span className="absolute top-0.5 left-1 text-xs text-purple-300" aria-hidden>＋</span>
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
            ⭐ = perfect for {anA(entry.animal)} {entry.animal}. Tap to add, drag to move, tap ✕ to remove. 🤪
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
