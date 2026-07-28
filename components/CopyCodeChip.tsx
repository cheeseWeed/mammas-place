'use client';

// Click-to-copy code chip (kid feedback: "click to copy promo codes").
// Tap/click copies the code and briefly swaps the label to "Copied!".
// Uses navigator.clipboard when available; falls back to a temporary
// off-screen textarea + document.execCommand('copy') for older browsers
// or non-secure contexts (clipboard API requires HTTPS/localhost).

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** The code that gets copied to the clipboard. */
  code: string;
  /**
   * Optional display text (e.g. "Use Code: MAMMA10"). Defaults to the code
   * itself. Only `code` is copied, never the label.
   */
  label?: string;
  /** Visual style of the chip. Behavior (copy + Copied! flash) is added on top. */
  className?: string;
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // Keep it out of view without display:none (which blocks select on iOS).
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS Safari needs an explicit range
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyCodeChip({ code, label, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't let a pending "Copied!" reset fire after unmount.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    let ok = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) ok = legacyCopy(code);
    if (!ok) return; // nothing copied → don't lie with a "Copied!" flash
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy code ${code}`}
      title="Tap to copy"
      className={
        className ??
        'bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-purple-900 font-black px-5 py-2.5 rounded-full text-sm transition-all cursor-pointer'
      }
    >
      {copied ? '✓ Copied!' : (label ?? code)}
    </button>
  );
}
