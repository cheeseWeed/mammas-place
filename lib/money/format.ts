// Money formatting helpers — all internal math is in 1/100 units (Int).
// Format at the UI edge only.
//
// "MP" is the currency unit (Mamma's Place). Whole amounts render compactly
// (10MP); fractional amounts show both parts (10.54MP).

export function centsToMP(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const remainder = abs % 100;
  if (remainder === 0) return `${sign}${whole}MP`;
  return `${sign}${whole}.${remainder.toString().padStart(2, '0')}MP`;
}

// Backwards-compat alias — keeps any unswapped imports working.
export const centsToDollars = centsToMP;

// "12.50" / "12" / "12MP" / "$12.50" → 1250. Returns null on garbage.
export function dollarsInputToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '').replace(/MP$/i, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}
