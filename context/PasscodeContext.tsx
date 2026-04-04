'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const PASSCODE = '1234';
const STORAGE_KEY = 'mammas-place-passcode-unlocked';

interface PasscodeContextType {
  unlocked: boolean;
  unlock: (code: string) => boolean;
  lock: () => void;
}

const PasscodeContext = createContext<PasscodeContextType | null>(null);

export function PasscodeProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setUnlocked(true);
    setChecked(true);
  }, []);

  const unlock = (code: string): boolean => {
    if (code === PASSCODE) {
      setUnlocked(true);
      sessionStorage.setItem(STORAGE_KEY, 'true');
      return true;
    }
    return false;
  };

  const lock = () => {
    setUnlocked(false);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  if (!checked) return null;

  return (
    <PasscodeContext.Provider value={{ unlocked, unlock, lock }}>
      {children}
    </PasscodeContext.Provider>
  );
}

export function usePasscode() {
  const ctx = useContext(PasscodeContext);
  if (!ctx) throw new Error('usePasscode must be used within PasscodeProvider');
  return ctx;
}
