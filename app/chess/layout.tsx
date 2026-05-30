// Metadata wrapper — page.tsx is a client component so it can't export metadata directly.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chess',
  description:
    'Chess for homeschool kids — play against the computer and learn the rules of the game.',
};

export default function ChessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
