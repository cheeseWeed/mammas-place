// Kid-side form prompt banks. Imported by the AskDadPanel CLIENT component,
// so this file MUST stay free of any server-only imports (no prisma, no
// next/headers, no fs). It's pure data + a tiny random-pick helper.
//
// The server-side decision engine and reply bank live in lib/money/dad.ts.

export const DAD_GREETINGS: readonly string[] = [
  "What do you need?",
  "Oh, you're back.",
  "How much this time?",
  "What's the ask?",
  "Lay it on me.",
  "What did you break?",
  "What's the damage?",
  "Yes, sweetheart?",
  "What now?",
  "Talk to me.",
  "Out with it.",
  "What is it, kiddo?",
  "I'm listening.",
  "Hit me.",
  "Make it good.",
  "What are we asking for?",
  "How can I help? (Famous last words.)",
  "Better be a good one.",
  "Alright, let's hear it.",
  "You again?",
  "Long time no see. Two minutes, I think.",
  "What's the pitch?",
  "Spit it out.",
  "Ok, go.",
  "I've got 30 seconds. Go.",
];

export const DAD_PROMPT_LABELS: readonly string[] = [
  "What do you need it for?",
  "Why?",
  "What's the reason?",
  "Tell me why.",
  "Sell it to me.",
  "Convince me.",
  "What's it for, kiddo?",
  "Make your case.",
  "What's the story?",
  "Give me a reason.",
  "I'm all ears — why?",
  "What are we funding?",
  "What's the cause?",
  "What's it for?",
  "Lay out the why.",
  "Pitch it.",
  "Justify the ask.",
  "Run it by me.",
  "What's the angle?",
  "Tell me a good story.",
];

export const DAD_AMOUNT_LABELS: readonly string[] = [
  "How much?",
  "How much this time?",
  "What's the number?",
  "Name a price.",
  "How big are we going?",
  "Damage?",
  "How much do you need?",
  "What's the ask?",
  "How much MP?",
  "Drop a number on me.",
  "How many MP we talking?",
  "Number, please.",
  "Quote me.",
  "How much we asking for?",
  "MP amount?",
  "What's the figure?",
  "How much (be honest)?",
  "How much would do it?",
  "Talk numbers.",
  "How much MP do you want?",
];

export const DAD_SUBMIT_LABELS: readonly string[] = [
  "Ask Dad",
  "Send it",
  "Ask away",
  "Make the ask",
  "Float it past Dad",
  "Roll the dice",
  "Pitch Dad",
  "Send to Dad",
  "Plead the case",
  "Submit ask",
  "Make my case",
  "Try Dad",
  "Lay it on Dad",
  "Send the ask",
  "Throw it at Dad",
];

// Pick a random element from a tuple. Used by the UI for rotating labels.
export function pickPrompt<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
