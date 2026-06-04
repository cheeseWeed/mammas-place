// Metadata wrapper — page.tsx is a client component so it can't export metadata directly.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spelling Bee',
  description:
    'Spelling practice for kids — leveled placement, weekly word lists, and rule drills.',
};

export default function SpellingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
