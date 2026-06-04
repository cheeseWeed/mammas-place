// Metadata wrapper — page.tsx is a client component so it can't export metadata directly.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Math',
  description:
    'Math practice for kids — fact families, word problems, and timed practice drills.',
};

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return children;
}
