// Family-local "today" (America/Denver), YYYY-MM-DD. Same rationale as the
// music tracker — Vercel runs UTC but the family lives in Mountain time, so a
// late-evening check-off should log as today, not tomorrow.

const TZ = 'America/Denver';

export function familyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}
