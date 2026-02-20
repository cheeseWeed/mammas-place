'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function PortalDashboardPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/portal');
    }
  }, [isAuthenticated, router]);

  if (!user) return null;

  const isManager = user.role === 'manager';

  const handleLogout = () => {
    logout();
    router.push('/portal');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Portal Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-black">MP</div>
          <div>
            <div className="font-black text-sm">Mamma&apos;s Place Staff Portal</div>
            <div className="text-gray-400 text-xs capitalize">{user.role} Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">👋 {user.name}</span>
          <button onClick={handleLogout} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black mb-2">Dashboard</h1>
        <p className="text-gray-400 mb-8">Welcome back, {user.name}. You are signed in as <span className="text-purple-400 font-bold capitalize">{user.role}</span>.</p>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Products', value: '20', icon: '📦' },
            { label: 'Categories', value: '6', icon: '🗂️' },
            { label: 'On Sale', value: '9', icon: '🏷️' },
            { label: 'Featured', value: '8', icon: '⭐' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-gray-400 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-black text-lg mb-3">Product Management</h2>
            <div className="space-y-2">
              <Link href="/admin/upload" className="flex items-center gap-3 bg-purple-700 hover:bg-purple-600 px-4 py-3 rounded-xl text-sm font-bold transition-colors">
                📤 Upload Product Images
              </Link>
              <Link href="/shop" className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-xl text-sm font-medium transition-colors">
                🛍️ View Public Store
              </Link>
            </div>
          </div>

          {isManager && (
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <h2 className="font-black text-lg mb-3">Manager Tools</h2>
              <div className="space-y-2">
                <div className="bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-400">
                  🔐 Promo Codes: MAMMA10 · PRINCESS20 · UNICORN15 · PONY25 · SAVE30
                </div>
                <div className="bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-400">
                  📊 Analytics: Coming Soon
                </div>
                <div className="bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-400">
                  📋 Orders: Coming Soon
                </div>
              </div>
            </div>
          )}

          {!isManager && (
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <h2 className="font-black text-lg mb-3">Agent Tools</h2>
              <div className="space-y-2">
                <Link href="/shop" className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-xl text-sm font-medium transition-colors">
                  🔍 Browse Products
                </Link>
                <div className="bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-400">
                  💬 Customer Support: Coming Soon
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Promo codes visible to all staff */}
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-2xl p-5">
          <h3 className="font-black text-yellow-400 mb-3">🎟️ Active Promo Codes</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'MAMMA10', pct: '10%' },
              { code: 'PRINCESS20', pct: '20%' },
              { code: 'UNICORN15', pct: '15%' },
              { code: 'PONY25', pct: '25%' },
              { code: 'SAVE30', pct: '30%' },
            ].map(p => (
              <div key={p.code} className="bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-full text-xs font-black">
                {p.code} — {p.pct} off
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
