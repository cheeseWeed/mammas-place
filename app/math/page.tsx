'use client';

// Math hub — landing page mirroring the Geography hub pattern. One card per
// "phase" (currently just Phase 1: timer-driven drill); future phases (word
// problems, fractions, fact families) slot in as additional cards.

import Link from 'next/link';
import LoginGate from '@/components/LoginGate';

export default function MathHubPage() {
  return (
    <LoginGate
      section="math"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-sky-700">Loading…</div>
        </div>
      }
    >
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-6xl mb-3">🧮</div>
            <h1 className="text-4xl md:text-5xl font-black text-sky-900 mb-3">Math Arena</h1>
            <p className="text-lg text-sky-700 max-w-2xl mx-auto">
              Pick your operation, pick your speed. Beat the timer, earn MP.
              The better you do, the more you earn.
            </p>
          </div>

          <section className="mb-10">
            <div className="flex items-baseline gap-3 mb-4 border-b-2 border-sky-200 pb-2">
              <span className="text-3xl" aria-hidden="true">⚡</span>
              <h2 className="text-2xl md:text-3xl font-black text-sky-900">Drills</h2>
              <span className="text-sm font-semibold text-sky-700 ml-1">
                · timed practice, your rules
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <PhaseCard
                phaseLabel="Phase 1"
                title="Quick Drill"
                subtitle="Choose +, −, ×, ÷ or mix. Pick a difficulty and per-question timer. Race the clock."
                href="/math/practice"
                cta="Start drilling"
                shipped
              />
              <PhaseCard
                phaseLabel="Phase 2"
                title="Fact Families"
                subtitle="Master triangles like 4×6=24 / 24÷6=4. Fill in the blank — no timer."
                href="/math/fact-families"
                cta="Start fact families"
                shipped
              />
              <PhaseCard
                phaseLabel="Phase 3"
                title="Word Problems"
                subtitle="Read it, picture it, solve it. Type the answer."
                href="/math/word-problems"
                cta="Start word problems"
                shipped
              />
              <PhaseCard
                phaseLabel="Phase 4"
                title="Fractions & Decimals"
                subtitle="Halves, quarters, tenths. Type a decimal or a fraction — either works."
                href="/math/fractions"
                cta="Start fractions"
                shipped
              />
              <PhaseCard
                phaseLabel="Phase 5"
                title="Order of Operations"
                subtitle="PEMDAS! When +, −, ×, ÷ get tangled, who goes first?"
                href="/math/pemdas"
                cta="Start PEMDAS"
                shipped
              />
            </div>
          </section>

          <div className="bg-gradient-to-r from-sky-600 to-cyan-700 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center">
            <p className="text-sky-50 mb-3 text-sm">
              MP rewards scale with accuracy and difficulty. The better you do, the more you earn.
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
  );
}

function PhaseCard({
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
      className="group bg-white rounded-2xl border-2 border-sky-200 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] hover:border-sky-400 transition-all duration-300 relative"
    >
      <div className="absolute top-3 right-3 bg-sky-100 text-sky-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
        Open
      </div>
      <div className="text-sm font-bold text-sky-600 uppercase tracking-wide mb-2">
        {phaseLabel}
      </div>
      <h3 className="text-xl font-black text-sky-900 group-hover:text-sky-700 transition-colors mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-gray-700">{subtitle}</p>
      <div className="mt-4 text-sm font-bold text-sky-700 group-hover:text-sky-500 transition-colors">
        {cta || 'Open'} →
      </div>
    </Link>
  );
}
