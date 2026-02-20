'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { itemCount } = useCart();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/shop?search=${encodeURIComponent(search.trim())}`);
      setMenuOpen(false);
    }
  };

  const navLinks = [
    { href: '/shop', label: 'All Products' },
    { href: '/shop?category=ponies', label: '🐴 Ponies' },
    { href: '/shop?category=unicorns', label: '🦄 Unicorns' },
    { href: '/shop?category=princesses', label: '👑 Princesses' },
    { href: '/shop?category=bow-and-arrow', label: '🏹 Bow & Arrow' },
    { href: '/shop?category=rock-collections', label: '💎 Rock Collections' },
    { href: '/shop?category=games', label: '🎮 Games' },
    { href: '/shop?category=audiobooks', label: '🎧 Audiobooks' },
    { href: '/shop?sale=true', label: '🏷️ Sale Items' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 shadow-xl" style={{background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 40%, #581c87 70%, #2d0550 100%)'}}>
      {/* Top promo bar */}
      <div className="text-white text-xs text-center py-1 px-4 hidden sm:block" style={{background: 'rgba(0,0,0,0.4)'}}>
        Free shipping on orders over $50! Use code <span className="font-bold text-yellow-300">MAMMA10</span> for 10% off
      </div>

      {/* Main header row */}
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={() => setMenuOpen(false)}>
          <div className="relative">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer black shadow ring */}
              <circle cx="26" cy="27" r="24" fill="black" opacity="0.35" />
              {/* White outer ring */}
              <circle cx="26" cy="26" r="24" fill="white" />
              {/* Purple inner fill */}
              <circle cx="26" cy="26" r="21" fill="#6b21a8" />
              {/* Inner subtle black shadow arc for depth */}
              <circle cx="26" cy="26" r="21" fill="url(#shadowGrad)" />
              {/* MP text */}
              <text
                x="26"
                y="31"
                textAnchor="middle"
                fontFamily="Georgia, serif"
                fontWeight="900"
                fontSize="15"
                fill="white"
                letterSpacing="1"
              >MP</text>
              {/* White decorative dots top */}
              <circle cx="26" cy="7" r="2" fill="white" opacity="0.6" />
              <circle cx="18" cy="9" r="1.5" fill="white" opacity="0.4" />
              <circle cx="34" cy="9" r="1.5" fill="white" opacity="0.4" />
              {/* Black highlight arc at top for depth */}
              <path d="M 10 18 Q 26 8 42 18" stroke="black" strokeWidth="1.5" fill="none" opacity="0.15" strokeLinecap="round"/>
              <defs>
                <radialGradient id="shadowGrad" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="black" stopOpacity="0.18" />
                </radialGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="text-white font-black text-xl leading-tight tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] group-hover:text-purple-200 transition-colors">
              Mamma&apos;s
            </div>
            <div className="text-purple-300 font-bold text-base leading-tight tracking-widest -mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
              PLACE
            </div>
          </div>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-6 hidden md:flex">
          <div className="flex w-full rounded-full overflow-hidden border-2 border-white shadow">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ponies, unicorns, princesses..."
              className="flex-1 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-white"
            />
            <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 px-4 py-2 font-bold text-purple-900 transition-colors">
              Search
            </button>
          </div>
        </form>

        {/* Right side: desktop nav + cart + hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-3">
            <Link href="/shop" className="text-white hover:text-yellow-300 text-sm font-medium transition-colors">Shop</Link>
            <Link href="/shop?sale=true" className="text-yellow-300 hover:text-yellow-200 text-sm font-bold transition-colors">Sale 🏷️</Link>
          </nav>

          {/* Cart */}
          <Link href="/cart" className="relative flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold px-3 py-2 rounded-full transition-colors text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline font-black">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-colors gap-1.5"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <form onSubmit={handleSearch} className="flex md:hidden px-4 pb-2">
        <div className="flex w-full rounded-full overflow-hidden border-2 border-white shadow">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="flex-1 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-white"
          />
          <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 px-4 py-2 font-bold text-purple-900">
            Go
          </button>
        </div>
      </form>

      {/* Mobile dropdown menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        <nav className="px-4 pt-2 pb-4 flex flex-col gap-1 border-t border-purple-900/50" style={{background: 'linear-gradient(135deg, #2d0550 0%, #4a0d7a 100%)'}}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-4 py-3 rounded-xl font-medium text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/cart"
            onClick={() => setMenuOpen(false)}
            className="text-purple-900 bg-yellow-400 hover:bg-yellow-300 px-4 py-3 rounded-xl font-black text-sm transition-colors text-center mt-2 flex items-center justify-center gap-2"
          >
            🛒 View Cart {itemCount > 0 && `(${itemCount})`}
          </Link>
        </nav>
      </div>
    </header>
  );
}
