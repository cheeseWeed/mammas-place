'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PortalLoginPage() {
  const { login, isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/portal/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Small delay to feel real
    await new Promise(r => setTimeout(r, 400));
    const ok = login(username, password);
    if (!ok) {
      setError('Invalid username or password.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-700 border-2 border-purple-400 mb-3">
            <span className="text-white font-black text-xl">MP</span>
          </div>
          <h1 className="text-white font-black text-2xl">Mamma&apos;s Place</h1>
          <p className="text-purple-400 text-sm mt-1">Staff Portal</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
          <h2 className="text-white font-bold text-lg mb-5">Sign In</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter username"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter password"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-black py-3 rounded-xl transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="mt-4 text-center">
            <Link href="/" className="text-gray-500 hover:text-gray-400 text-xs">← Back to store</Link>
          </div>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Mamma&apos;s Place Staff Portal · Authorized Access Only
        </p>
      </div>
    </div>
  );
}
