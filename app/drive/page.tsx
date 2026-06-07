// Utah Driver License study tool — wraps the standalone HTML in /public/drive-assets/.
// Server component: renders login/register card (client) + jump-in links + footer.
import type { Metadata } from 'next';
import Link from 'next/link';
import SabbathGuard from '@/components/SabbathGuard';
import SectionGuard from '@/components/SectionGuard';

export const metadata: Metadata = {
  title: 'Driver Study',
  description:
    'Utah Driver License study tool — slide decks, practice quizzes, and full exam simulator',
};

export default function DrivePage() {
  return (
    <SabbathGuard label="Driver Study">
    <SectionGuard sectionKey="drive" label="Driver Study">
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-purple-900 mb-3">
            Ready to study?
          </h1>
          <p className="text-lg text-purple-600 max-w-2xl mx-auto">
            Your Utah Driver License study tool. Decks, quizzes, finals, and progress tracking.
          </p>
        </div>

        {/* No login here — the user is already signed in site-wide (one
            name+PIN covers the whole site). Progress saves to whoever's logged
            in; anonymous still works. Straight into the dashboard. */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8 text-center">
          <a
            href="/drive-assets/dashboard/index.html"
            className="inline-block bg-purple-900 hover:bg-purple-800 text-white font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Continue to dashboard →
          </a>
        </div>

        {/* Official Utah handbook + study resources */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-6 border-2 border-yellow-200 mb-10">
          <div className="flex items-start gap-4">
            <div className="bg-yellow-400 rounded-xl p-3 flex-shrink-0">
              <svg className="w-8 h-8 text-purple-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-purple-900 mb-2">Official Utah Driver Handbook</h2>
              <p className="text-gray-700 text-sm mb-3">
                Read the actual handbook the test is based on — published by the Utah Driver License Division. Use it alongside the decks for the full picture.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://dld.utah.gov/wp-content/uploads/Driver-Handbook-REV-3.2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-purple-900 hover:bg-purple-700 text-white font-medium px-5 py-2 rounded-full text-sm transition-colors"
                >
                  Open Handbook (PDF) →
                </a>
                <a
                  href="https://dld.utah.gov/written-test/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-medium px-5 py-2 rounded-full text-sm transition-colors"
                >
                  Written Test Info →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Direct entry points */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <h2 className="text-2xl font-bold text-purple-900 mb-2 text-center">Jump straight in</h2>
          <p className="text-center text-gray-600 text-sm mb-6">
            Already know what you want? Skip the dashboard and head straight to a deck or the simulator.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <a
              href="/drive-assets/decks/unit-1.html"
              className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 border border-purple-200 transition-colors"
            >
              <div className="font-bold text-purple-900">Unit 1</div>
              <div className="text-gray-600">Getting Your License</div>
            </a>
            <a
              href="/drive-assets/decks/unit-2.html"
              className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 border border-purple-200 transition-colors"
            >
              <div className="font-bold text-purple-900">Unit 2</div>
              <div className="text-gray-600">Driving Basics</div>
            </a>
            <a
              href="/drive-assets/decks/unit-3.html"
              className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 border border-purple-200 transition-colors"
            >
              <div className="font-bold text-purple-900">Unit 3</div>
              <div className="text-gray-600">Rules of the Road</div>
            </a>
            <a
              href="/drive-assets/decks/unit-4.html"
              className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 border border-purple-200 transition-colors"
            >
              <div className="font-bold text-purple-900">Unit 4</div>
              <div className="text-gray-600">Impairment</div>
            </a>
            <a
              href="/drive-assets/decks/unit-5.html"
              className="bg-purple-50 hover:bg-purple-100 rounded-lg p-3 border border-purple-200 transition-colors"
            >
              <div className="font-bold text-purple-900">Unit 5</div>
              <div className="text-gray-600">Sharing the Road</div>
            </a>
            <a
              href="/drive-assets/exams/simulator.html"
              className="bg-yellow-50 hover:bg-yellow-100 rounded-lg p-3 border border-yellow-300 transition-colors"
            >
              <div className="font-bold text-purple-900">50-Q Simulator</div>
              <div className="text-gray-600">Real DLD test format</div>
            </a>
          </div>
        </div>

        {/* Footer note */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center">
          <p className="text-purple-100 mb-2 text-sm">
            Based on the Utah Driver Handbook (Revision 3/2026)
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
    </SectionGuard>
    </SabbathGuard>
  );
}
