// Server-local "today" for the music tracker, in the family's timezone.
//
// Vercel runs in UTC, but the family practices in US Mountain time. If we used
// raw UTC, a 9pm-Utah practice on the 6th would log as the 7th. We pin to
// America/Denver via Intl so "today" matches the kid's calendar — which also
// makes weekend (perform-day) detection correct.
//
// Returns YYYY-MM-DD. Pure given the clock; `now` is injectable for tests.

const TZ = 'America/Denver';

export function musicToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly what we want.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
