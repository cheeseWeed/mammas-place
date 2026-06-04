'use client';

// Home-page Sabbath note — shown only on Sundays (family timezone, or when the
// admin "view as Sunday" override is on). Quotes the commandment to keep the
// Sabbath holy and encourages scripture study. Client component so it follows
// the visitor's local day and the admin day-override cookie.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  isSabbath,
  SABBATH_COMMANDMENT,
  SABBATH_COMMANDMENT_REF,
  SABBATH_ENCOURAGEMENT,
} from '@/lib/sabbath';

export default function SabbathNote() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isSabbath());
  }, []);

  if (!show) return null;

  return (
    <section className="bg-gradient-to-br from-amber-50 to-yellow-50 border-y-2 border-amber-200 px-4 py-8">
      <div className="max-w-3xl mx-auto text-center">
        <div className="text-4xl mb-2">🕊️</div>
        <h2 className="text-2xl font-black text-amber-900 mb-3">
          Today is the Sabbath
        </h2>
        <blockquote className="text-amber-900 text-lg italic mb-1">
          “{SABBATH_COMMANDMENT}”
        </blockquote>
        <div className="text-amber-700 text-sm font-bold mb-4">
          — {SABBATH_COMMANDMENT_REF}
        </div>
        <p className="text-amber-800 text-sm max-w-2xl mx-auto mb-5">
          {SABBATH_ENCOURAGEMENT}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/scripture-study"
            className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-full transition-colors"
          >
            📖 Study the Scriptures
          </Link>
          <a
            href="https://www.churchofjesuschrist.org/?lang=eng"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white border-2 border-amber-300 hover:border-amber-500 text-amber-900 font-bold px-6 py-3 rounded-full transition-colors"
          >
            ⛪ ChurchofJesusChrist.org
          </a>
        </div>
      </div>
    </section>
  );
}
