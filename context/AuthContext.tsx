'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'manager' | 'agent' | null;

interface AuthUser {
  username: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

// Hardcoded credentials (in production these would be in a database)
const USERS: Array<AuthUser & { password: string }> = [
  { username: 'manager', password: 'manager', role: 'manager', name: 'Store Manager' },
  { username: 'agent1', password: 'agent1', role: 'agent', name: 'Sales Agent 1' },
  { username: 'agent2', password: 'agent2', role: 'agent', name: 'Sales Agent 2' },
];

const AUTH_KEY = 'mammas-place-auth';
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const found = USERS.find(u => u.username === username && u.password === password);
    if (found) {
      const authUser: AuthUser = { username: found.username, role: found.role, name: found.name };
      setUser(authUser);
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
