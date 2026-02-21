'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUser {
  username: string;
  authenticated: boolean;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  adminLogin: (username: string, password: string) => boolean;
  adminLogout: () => void;
  isAdminAuthenticated: boolean;
}

// Hardcoded admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

const ADMIN_AUTH_KEY = 'mammas-place-admin-auth';
const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_AUTH_KEY);
    if (stored) {
      try {
        setAdminUser(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const adminLogin = (username: string, password: string): boolean => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const authUser: AdminUser = { username, authenticated: true };
      setAdminUser(authUser);
      localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(authUser));
      return true;
    }
    return false;
  };

  const adminLogout = () => {
    setAdminUser(null);
    localStorage.removeItem(ADMIN_AUTH_KEY);
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, adminLogin, adminLogout, isAdminAuthenticated: !!adminUser }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
