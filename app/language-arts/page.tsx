'use client';

// Language Arts hub — mirrors the Geography / Math hub pattern. Phase L1
// (Homophones) is the only shipped phase; Grammar / Punctuation / Phonics /
// Dictionary / Thesaurus are listed as Coming Soon so the kid sees the
// roadmap.

import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SabbathGuard from '@/components/SabbathGuard';

export default function LanguageArtsHubPage() {
  return (
    <SabbathGuard label="Language Arts">
    <LoginGate
      section="languageArts"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-rose-700">Loading…</div>
        </div>
      }
    >
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-6xl mb-3">📚</div>
            <h1 className="text-4xl md:text-5xl font-black text-rose-900 mb-3">Language Arts</h1>
            <p className="text-lg text-rose-700 max-w-2xl mx-auto">
              Tricky words, sentence rules, and the little marks that make a sentence work.
              Earn MP as you go — the better you do, the more you earn.
            </p>
          </div>

          <section className="mb-10">
            <div className="flex items-baseline gap-3 mb-4 border-b-2 border-rose-200 pb-2">
              <span className="text-3xl" aria-hidden="true">🔤</span>
              <h2 className="text-2xl md:text-3xl font-black text-rose-900">Word Skills</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Card
                phaseLabel="Phase L1"
                title="Homophones & Confused Words"
                subtitle={`their / they’re / there · your / you’re · its / it’s · affect / effect · and more. Fill-in-the-blank drill with the rules along the way.`}
                href="/language-arts/homophones"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L2"
                title="Grammar Basics"
                subtitle="Parts of speech, subject-verb agreement, and verb tense. Multiple-choice drill with the rule shown on a miss."
                href="/language-arts/grammar"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L3"
                title="Punctuation"
                subtitle="Commas, apostrophes, quotation marks, end punctuation — plus semicolons, colons, and dash vs hyphen on hard tier."
                href="/language-arts/punctuation"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L4"
                title="Phonics & Sounds"
                subtitle="Short & long vowels, consonant blends, digraphs, vowel teams. Listen-and-pick drill with the rules along the way."
                href="/language-arts/phonics"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L5"
                title="Dictionary Skills"
                subtitle="Alphabetical order, guide words, pronunciation, multiple meanings, parts of speech, and word origins."
                href="/language-arts/dictionary"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L6"
                title="Thesaurus Skills"
                subtitle="Synonyms, antonyms, shade of meaning, repetition fixes, and strength scales. Pick a skill or mix them up."
                href="/language-arts/thesaurus"
                cta="Start drilling"
                shipped
              />
              <Card
                phaseLabel="Phase L7"
                title="Vocabulary Builder"
                subtitle="Big words, kid-friendly. Match words to meanings or fill in the blank."
                href="/language-arts/vocabulary"
                cta="Start drilling"
                shipped
              />
            </div>
          </section>

          <div className="bg-gradient-to-r from-rose-600 to-pink-700 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center">
            <p className="text-rose-50 mb-3 text-sm">
              MP scales with accuracy and difficulty. The better you do, the more you earn.
            </p>
            <Link
              href="/"
              className="inline-block bg-white/20 hover:bg-white/30 text-white font-medium px-6 py-2 rounded-full transition-colors text-sm"
            >
              ← Back to Mamma&apos;s Place
            </Link>
          </div>
        </div>
      </div>
    </LoginGate>
    </SabbathGuard>
  );
}

function Card({
  phaseLabel,
  title,
  subtitle,
  href,
  cta,
  shipped,
}: {
  phaseLabel: string;
  title: string;
  subtitle: string;
  href: string;
  cta?: string;
  shipped?: boolean;
}) {
  if (!shipped) {
    return (
      <div className="bg-gray-100 rounded-2xl border border-gray-200 p-6 opacity-60 relative">
        <div className="absolute top-3 right-3 bg-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
          Coming Soon
        </div>
        <div className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
          {phaseLabel}
        </div>
        <h3 className="text-xl font-black text-gray-700 mb-2 leading-tight">{title}</h3>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border-2 border-rose-200 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] hover:border-rose-400 transition-all duration-300 relative"
    >
      <div className="absolute top-3 right-3 bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
        Open
      </div>
      <div className="text-sm font-bold text-rose-600 uppercase tracking-wide mb-2">
        {phaseLabel}
      </div>
      <h3 className="text-xl font-black text-rose-900 group-hover:text-rose-700 transition-colors mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-gray-700">{subtitle}</p>
      <div className="mt-4 text-sm font-bold text-rose-700 group-hover:text-rose-500 transition-colors">
        {cta || 'Open'} →
      </div>
    </Link>
  );
}
