// Global header — logo, search bar, category mega menu, cart badge, mobile hamburger
'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, categorySubcategoryMapFromProducts } from '@/lib/products-client';
import BalanceChip from '@/components/BalanceChip';
import IdentityBadge from '@/components/IdentityBadge';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';
import FeedbackWidget from '@/components/FeedbackWidget';
import { isSabbath } from '@/lib/sabbath';

export default function Header() {
  const { itemCount } = useCart();
  const { learner, balanceCents, logout } = useLearner();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sabbath gating: on Sundays the shop + most learning sections are hidden;
  // only Scripture Study, Music, and Audiobooks stay. Guard on `mounted` so SSR
  // (server's day) and the client (family-tz day) don't mismatch on hydration.
  const sabbath = mounted && isSabbath();

  // Dropdown close-delay: when cursor leaves the trigger, wait 200ms before
  // closing so a quick cursor wobble between button and panel doesn't kill
  // the menu. mouseEnter on either button OR panel cancels the pending close.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openDropdown = (name: string) => {
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setActiveDropdown(name);
  };
  const scheduleDropdownClose = () => {
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setActiveDropdown(null), 200);
  };
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Catalog comes from /api/products via the DB now; useProducts caches it
  // across mounts so flipping between pages doesn't re-fetch every nav.
  const { products: allProducts } = useProducts();
  const categorySubcategoryMap = useMemo(
    () => categorySubcategoryMapFromProducts(allProducts),
    [allProducts],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/shop?search=${encodeURIComponent(search.trim())}`);
      setMenuOpen(false);
    }
  };

  const categoryConfig: Record<string, { emoji: string; label: string }> = {
    'automotive': { emoji: '🚗', label: 'Automotive' },
    'grocery': { emoji: '🛒', label: 'Grocery' },
    'home-garden': { emoji: '🏡', label: 'Home & Garden' },
    'sports': { emoji: '🏀', label: 'Sports' },
    'toys-and-games': { emoji: '🎮', label: 'Toys & Games' },
    'audiobooks': { emoji: '🎧', label: 'Audiobooks' },
    'study-guides': { emoji: '📖', label: 'Study Guides' },
    'services': { emoji: '🛠️', label: 'Services' },
    'restaurant': { emoji: '🍽️', label: 'Restaurant' }
  };

  const subcategoryConfig: Record<string, { emoji: string; label: string }> = {
    'ponies': { emoji: '🐴', label: 'Ponies' },
    'unicorns': { emoji: '🦄', label: 'Unicorns' },
    'princesses': { emoji: '👑', label: 'Princesses' },
    'bow-and-arrow': { emoji: '🏹', label: 'Bow & Arrow' },
    'rock-collections': { emoji: '💎', label: 'Rock Collections' },
    'board-games': { emoji: '🎲', label: 'Board Games' },
    'classic-cars': { emoji: '🏎️', label: 'Classic Cars' },
    'tires-parts': { emoji: '🛞', label: 'Tires & Parts' },
    'balls': { emoji: '⚽', label: 'Balls' },
    'exercise-equipment': { emoji: '🏋️', label: 'Exercise Equipment' },
    'outdoor-recreation': { emoji: '⛺', label: 'Outdoor Recreation' },
    'breakfast': { emoji: '🍳', label: 'Breakfast' },
    'lunch': { emoji: '🥗', label: 'Lunch' },
    'dinner': { emoji: '🍝', label: 'Dinner' },
    'dessert': { emoji: '🍰', label: 'Dessert' },
    'home-services': { emoji: '🏠', label: 'Home Services' },
    'personal-services': { emoji: '💇', label: 'Personal Services' },
    'pantry': { emoji: '🥫', label: 'Pantry' }
  };

  const navLinks = [
    { href: '/shop', label: 'All Products' },
    { href: '/shop?sale=true', label: '🏷️ Sale Items' },
    { href: '/geography', label: '🗺️ Geography' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] shadow-xl print:hidden" style={{background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 40%, #581c87 70%, #2d0550 100%)'}}>
      {/* DEMO SITE WARNING */}
      <div className="text-gray-900 font-black text-xs sm:text-sm text-center py-2 px-4 border-b-2 border-orange-600" style={{background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'}}>
        🎓 DEMO SITE - For Learning & Portfolio Purposes Only - No Real Transactions
      </div>

      {/* Top promo bar - now visible on mobile too */}
      <div className="text-white text-xs sm:text-sm text-center py-1 px-4" style={{background: 'rgba(0,0,0,0.4)'}}>
        Free shipping on orders over $50! Use code <span className="font-bold text-yellow-300">MAMMA10</span> for 10% off
      </div>

      {/* Who you're logged in as — pinned to the FAR-LEFT edge of the whole
          header bar (anchored to <header>, which is fixed). Stacked greeting +
          actions. Hidden on small screens to avoid overlapping the logo; the
          mobile menu carries the identity instead. */}
      <div className="hidden lg:block absolute left-3 bottom-3 z-[110]">
        <IdentityBadge />
      </div>

      {/* Main header row */}
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Left cluster: logo */}
        <div className="flex items-center gap-4 sm:gap-6">
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
        </div>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-6 hidden md:flex">
          <div className="flex w-full rounded-full overflow-hidden border-2 border-white shadow">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search everything - tires, groceries, toys, tools..."
              aria-label="Search products"
              className="flex-1 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-white"
            />
            <button type="submit" aria-label="Submit search" className="bg-yellow-400 hover:bg-yellow-300 px-4 py-2 font-bold text-purple-900 transition-colors">
              Search
            </button>
          </div>
        </form>

        {/* Right side: desktop nav + cart + hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop nav links with dropdowns */}
          <nav className="hidden lg:flex items-center gap-1 relative">
            {/* Shop is closed on the Sabbath — hide all shop entry points. */}
            {!sabbath && (
            <>
            <Link href="/shop" className="text-white hover:text-yellow-300 text-sm font-medium transition-colors px-3 py-2 rounded">Shop All</Link>

            {/* Categories dropdown menu */}
            <div
              className="relative"
              onMouseEnter={() => openDropdown('categories')}
              onMouseLeave={scheduleDropdownClose}
            >
              <button className="text-white hover:text-yellow-300 text-sm font-medium transition-colors px-3 py-2 rounded flex items-center gap-1">
                Categories
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Mega dropdown — pt-3 acts as a hover-bridge so the cursor
                  never crosses an empty gap between button and panel. */}
              {activeDropdown === 'categories' && (
                <div className="absolute top-full left-0 bg-white rounded-lg shadow-2xl border border-purple-100 p-4 min-w-[600px] z-50 grid grid-cols-3 gap-4" style={{ marginTop: 0 }}
                  onMouseEnter={() => openDropdown('categories')}
                  onMouseLeave={scheduleDropdownClose}>
                  {Object.entries(categorySubcategoryMap).map(([category, subcats]) => {
                    const catConfig = categoryConfig[category];
                    if (!catConfig) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <Link
                          href={`/shop?category=${category}`}
                          className="font-bold text-purple-900 hover:text-purple-600 text-sm flex items-center gap-1"
                          onClick={() => setActiveDropdown(null)}
                        >
                          {catConfig.emoji} {catConfig.label}
                        </Link>
                        {subcats.length > 0 && (
                          <div className="pl-4 space-y-1">
                            {subcats.map((subcat) => {
                              const subcatConfig = subcategoryConfig[subcat];
                              if (!subcatConfig) return null;

                              return (
                                <Link
                                  key={subcat}
                                  href={`/shop?category=${category}&subcategory=${subcat}`}
                                  className="text-gray-600 hover:text-purple-600 text-xs block"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  {subcatConfig.emoji} {subcatConfig.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Link href="/shop?sale=true" className="text-yellow-300 hover:text-yellow-200 text-sm font-bold transition-colors px-3 py-2 rounded">Sale 🏷️</Link>
            </>
            )}

            {/* Learn dropdown — side projects for homeschool kids */}
            <div
              className="relative"
              onMouseEnter={() => openDropdown('learn')}
              onMouseLeave={scheduleDropdownClose}
            >
              <button className="text-emerald-300 hover:text-emerald-200 text-sm font-bold transition-colors px-3 py-2 rounded flex items-center gap-1">
                🎓 L&apos;Earn
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {activeDropdown === 'learn' && (
                <div className="absolute top-full right-0 bg-white rounded-lg shadow-2xl border border-purple-100 p-3 min-w-[220px] z-50" style={{ marginTop: 0 }}
                  onMouseEnter={() => openDropdown('learn')}
                  onMouseLeave={scheduleDropdownClose}>
                  <Link
                    href="/scripture-study"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">📖</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Scripture Study Guide</div>
                      <div className="text-xs text-gray-600">Faith &amp; gospel study by topic</div>
                    </div>
                  </Link>
                  {/* Sabbath-closed learning sections — hidden on Sundays. */}
                  {!sabbath && (
                  <>
                  <Link
                    href="/letters"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🔤</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Letters &amp; Sounds</div>
                      <div className="text-xs text-gray-600">Preschool &amp; K — letters, sounds, blends</div>
                    </div>
                  </Link>
                  <Link
                    href="/geography"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🗺️</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Geography</div>
                      <div className="text-xs text-gray-600">US states, capitals, regions</div>
                    </div>
                  </Link>
                  <Link
                    href="/drive"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🚗</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Drive</div>
                      <div className="text-xs text-gray-600">Utah driver license study</div>
                    </div>
                  </Link>
                  <Link
                    href="/spelling"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🐝</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Spelling</div>
                      <div className="text-xs text-gray-600">Spelling bee practice</div>
                    </div>
                  </Link>
                  <Link
                    href="/math"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🧮</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Math Arena</div>
                      <div className="text-xs text-gray-600">Timed drills · earn MP</div>
                    </div>
                  </Link>
                  <Link
                    href="/language-arts"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">📚</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Language Arts</div>
                      <div className="text-xs text-gray-600">Homophones, grammar, more</div>
                    </div>
                  </Link>
                  <Link
                    href="/chess"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">♟️</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Chess</div>
                      <div className="text-xs text-gray-600">Full rules · 4 piece sets</div>
                    </div>
                  </Link>
                  </>
                  )}
                  {/* Music stays open on the Sabbath. */}
                  <Link
                    href="/music"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🎻</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Practice Studio</div>
                      <div className="text-xs text-gray-600">Daily plan · score your playing · earn MP</div>
                    </div>
                  </Link>
                  {!sabbath && (
                  <Link
                    href="/chores"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="text-2xl">🧹</span>
                    <div>
                      <div className="font-bold text-purple-900 group-hover:text-emerald-700">Family Chores</div>
                      <div className="text-xs text-gray-600">Check off jobs · earn MP · redeem</div>
                    </div>
                  </Link>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* MP Money balance chip — anchors right-side cluster before Cart */}
          <BalanceChip />

          {/* Feedback button — small, yellow pop, sits between balance + cart.
              Mobile collapses to icon-only inside the FeedbackWidget itself. */}
          <FeedbackWidget />

          {/* Cart */}
          <Link href="/cart" className="relative flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold px-3 py-2 rounded-full transition-colors text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline font-black">Cart</span>
            {mounted && itemCount > 0 && (
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
            aria-label="Search products"
            className="flex-1 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-white"
          />
          <button type="submit" aria-label="Submit search" className="bg-yellow-400 hover:bg-yellow-300 px-4 py-2 font-bold text-purple-900">
            Go
          </button>
        </div>
      </form>

      {/* Mobile dropdown menu */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        <nav className="px-4 pt-2 pb-4 flex flex-col gap-1 border-t border-purple-900/50 max-h-[70vh] overflow-y-auto" style={{background: 'linear-gradient(135deg, #2d0550 0%, #4a0d7a 100%)'}}>
          {/* Shop is closed on the Sabbath. */}
          {!sabbath && (
          <>
          <Link
            href="/shop"
            onClick={() => setMenuOpen(false)}
            className="text-white hover:bg-purple-700 hover:text-yellow-300 px-4 py-3 rounded-xl font-medium text-sm transition-colors"
          >
            All Products
          </Link>

          {/* Mobile Categories with Subcategories */}
          {Object.entries(categorySubcategoryMap).map(([category, subcats]) => {
            const catConfig = categoryConfig[category];
            if (!catConfig) return null;

            return (
              <div key={category} className="border-b border-purple-800/50 pb-2">
                <Link
                  href={`/shop?category=${category}`}
                  onClick={() => setMenuOpen(false)}
                  className="text-white hover:bg-purple-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                >
                  {catConfig.emoji} {catConfig.label}
                </Link>
                {subcats.length > 0 && (
                  <div className="pl-6 space-y-1 mt-1">
                    {subcats.map((subcat) => {
                      const subcatConfig = subcategoryConfig[subcat];
                      if (!subcatConfig) return null;

                      return (
                        <Link
                          key={subcat}
                          href={`/shop?category=${category}&subcategory=${subcat}`}
                          onClick={() => setMenuOpen(false)}
                          className="text-purple-200 hover:bg-purple-700 hover:text-yellow-300 px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-2"
                        >
                          {subcatConfig.emoji} {subcatConfig.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <Link
            href="/shop?sale=true"
            onClick={() => setMenuOpen(false)}
            className="text-yellow-300 hover:bg-purple-700 hover:text-yellow-200 px-4 py-3 rounded-xl font-bold text-sm transition-colors"
          >
            🏷️ Sale Items
          </Link>
          </>
          )}

          {/* Learn section — side projects */}
          <div className="border-b border-purple-800/50 pb-2 pt-1">
            <div className="text-emerald-300 px-4 py-2 font-bold text-xs uppercase tracking-wide">
              🎓 L&apos;Earn
            </div>
            <Link
              href="/scripture-study"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              📖 Scripture Study Guide
            </Link>
            {/* Sabbath-closed learning sections — hidden on Sundays. */}
            {!sabbath && (
            <>
            <Link
              href="/letters"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🔤 Letters &amp; Sounds
            </Link>
            <Link
              href="/geography"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🗺️ Geography
            </Link>
            <Link
              href="/drive"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🚗 Drive (UT License)
            </Link>
            <Link
              href="/spelling"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🐝 Spelling
            </Link>
            <Link
              href="/math"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🧮 Math Arena
            </Link>
            <Link
              href="/language-arts"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              📚 Language Arts
            </Link>
            <Link
              href="/chess"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              ♟️ Chess
            </Link>
            </>
            )}
            {/* Music stays open on the Sabbath. */}
            <Link
              href="/music"
              onClick={() => setMenuOpen(false)}
              className="text-white hover:bg-purple-700 hover:text-yellow-300 px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              🎻 Practice Studio
            </Link>
          </div>

          {/* Mobile MP Money — chip is desktop-only, so render an explicit row here.
              The balance tile is a link to /portal/money so kids can tap to see
              their orders + earnings. */}
          {mounted && (learner ? (
            <>
              <Link
                href="/portal/money"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between bg-yellow-400 hover:bg-yellow-300 text-purple-900 px-4 py-3 rounded-xl font-bold text-sm mt-2 transition-colors"
              >
                <span className="truncate">
                  <span className="font-black">{balanceCents === null ? '…' : centsToMP(balanceCents)}</span>
                  <span className="opacity-70"> · </span>
                  <span className="capitalize">{learner}</span>
                </span>
                <span className="text-xs ml-3 shrink-0">See →</span>
              </Link>
              <button
                type="button"
                onClick={() => { logout(); setMenuOpen(false); }}
                className="text-yellow-300 hover:text-yellow-200 text-xs underline px-4 pb-1 text-left"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/shop/login"
              onClick={() => setMenuOpen(false)}
              className="text-yellow-300 border border-yellow-300/60 hover:bg-purple-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors text-center mt-2"
            >
              Log in for MP
            </Link>
          ))}

          <Link
            href="/cart"
            onClick={() => setMenuOpen(false)}
            className="text-purple-900 bg-yellow-400 hover:bg-yellow-300 px-4 py-3 rounded-xl font-black text-sm transition-colors text-center mt-2 flex items-center justify-center gap-2"
          >
            🛒 View Cart {mounted && itemCount > 0 && `(${itemCount})`}
          </Link>
        </nav>
      </div>
    </header>
  );
}
