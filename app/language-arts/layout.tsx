// Metadata wrapper — page.tsx is a client component so it can't export metadata directly.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Language Arts',
  description:
    'Language Arts for homeschool kids — phonics, grammar, punctuation, homophones, thesaurus, and dictionary work.',
};

export default function LanguageArtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
