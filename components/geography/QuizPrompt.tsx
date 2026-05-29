// QuizPrompt — prompt strip that sits above the quiz map.
//
// The prompt itself is the focal point: big, centered, easy to read at a
// glance. Score + progress sit on a smaller second row below so they don't
// compete for attention. Feedback chip appears inline with the prompt.
'use client';

export type QuizPromptProps = {
  prompt: string;
  current: number;
  total: number;
  score: number;
  feedback?: 'right' | 'wrong' | null;
  feedbackText?: string;
};

export default function QuizPrompt({
  prompt,
  current,
  total,
  score,
  feedback = null,
  feedbackText,
}: QuizPromptProps) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="bg-white/85 backdrop-blur-sm border-b-2 border-emerald-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
      {/* Row 1: BIG centered prompt — the focal point */}
      <div className="flex items-center justify-center gap-3 mb-1">
        <span className="text-xs sm:text-sm uppercase tracking-wider text-emerald-600 font-bold">
          Find:
        </span>
        <span className="text-2xl sm:text-3xl md:text-4xl font-black text-teal-700 leading-tight">
          {prompt}
        </span>
        {feedback === 'right' && (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-sm font-bold animate-fadeIn">
            <span>✓</span>
            <span>{feedbackText ?? 'Correct!'}</span>
          </span>
        )}
        {feedback === 'wrong' && (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold animate-fadeIn">
            <span>✗</span>
            <span>{feedbackText ?? 'Try again'}</span>
          </span>
        )}
      </div>

      {/* Row 2: smaller score + progress bar */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm">
        <span className="text-gray-600 font-medium whitespace-nowrap">
          Question <span className="font-bold text-emerald-700">{current}</span> of {total}
        </span>
        <div className="w-32 sm:w-48 md:w-64 h-2 bg-emerald-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
            aria-label={`Progress: ${current} of ${total}`}
          />
        </div>
        <span className="font-bold text-emerald-700 whitespace-nowrap">
          Score: {score}
        </span>
      </div>
    </div>
  );
}
