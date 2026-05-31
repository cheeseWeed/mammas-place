// Tiny client helper that any learning section can call when a kid finishes
// a round/quiz/drill. The server decides the reward — the client just
// describes what happened.
//
// Returns whatever the server says (centsEarned, balanceCents, reason,
// capped flags). Callers typically pop a toast with `reason` + `centsEarned`.

'use client';

export type EarnSection =
  | 'math'
  | 'spelling'
  | 'languageArts'
  | 'geography'
  | 'drive'
  | 'chess';

export type EarnResponse =
  | { ok: true; centsEarned: number; balanceCents: number; reason: string; capped?: boolean; capCents?: number }
  | {
      ok: true;
      pending: true;
      centsEarned: number;
      reason: string;
      section: EarnSection;
      kind: string;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    }
  | { error: string };

export function isPending(
  res: EarnResponse,
): res is Extract<EarnResponse, { pending: true }> {
  return 'pending' in res && res.pending === true;
}

export async function submitEarn(
  section: EarnSection,
  kind: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<EarnResponse> {
  try {
    const res = await fetch('/api/money/earn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section, kind, payload, idempotencyKey }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { error: typeof data.error === 'string' ? data.error : `HTTP ${res.status}` };
    }
    return data as EarnResponse;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

// Stable-ish idempotency token: includes a random nonce so two consecutive
// rounds with identical scores don't dedupe by accident. Callers should
// generate one once per round/quiz/drill (NOT once per submit retry — the
// whole point of idempotency is that retries reuse the same key).
export function newIdempotencyKey(prefix: string): string {
  const rand = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${prefix}-${rand}`;
}
