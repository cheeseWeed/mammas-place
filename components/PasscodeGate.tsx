'use client';

import { useState } from 'react';
import { usePasscode } from '@/context/PasscodeContext';

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
  const { unlocked, unlock } = usePasscode();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = unlock(code);
    if (!success) {
      setError(true);
      setShake(true);
      setCode('');
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleDigit = (d: string) => {
    if (code.length >= 6) return;
    const next = code + d;
    setCode(next);
    setError(false);
    if (next.length >= 4) {
      const success = unlock(next);
      if (!success) {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setCode('');
          setShake(false);
        }, 600);
      }
    }
  };

  const handleBackspace = () => {
    setCode(c => c.slice(0, -1));
    setError(false);
  };

  return (
    <div className="min-h-screen bg-purple-50 flex flex-col items-center justify-center">
      <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-5xl mb-1">🛍️</div>
        <h1 className="text-2xl font-bold text-purple-800 tracking-tight">Mamma&apos;s Place</h1>
        <p className="text-gray-500 text-sm text-center">Enter the passcode to continue</p>

        {/* Dots display */}
        <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < code.length
                  ? error
                    ? 'bg-red-400 border-red-400'
                    : 'bg-purple-600 border-purple-600'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm font-medium -mt-2">Incorrect passcode</p>
        )}

        {/* Numeric keypad */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-14 rounded-2xl bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-900 text-xl font-semibold transition-colors"
              >
                ★
              </button>
            ))}
            <div /> {/* spacer */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 rounded-2xl bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-900 text-xl font-semibold transition-colors"
            >
              ★
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-xl font-semibold transition-colors"
            >
              ⌫
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
