// "Misprint Edition" badge.
//
// A misprint is FLAWED ON PURPOSE — a smudge, an off-register colour pass, a
// happy accident — and the flaw is exactly what makes it collectible. So this
// badge is celebratory, not a warning: gold, not grey, and never worded as a
// defect or a discount. Misprints are also the rarest thing in the store (they
// sit out of the weekly pool entirely and only surface on a rare-reveal week —
// lib/image-store/rotation.ts), which is why they cost the most.

export default function MisprintBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 ' +
        'text-amber-950 font-black shadow border border-amber-500/40 ' +
        (big ? 'text-sm px-4 py-1.5' : 'text-[11px] px-2.5 py-1')
      }
    >
      <span aria-hidden>✨</span>
      <span className="uppercase tracking-wide">Misprint Edition</span>
    </span>
  );
}
