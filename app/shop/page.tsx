'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAllProducts, searchProducts, getCategories, getSubcategoriesByCategory } from '@/lib/products';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import SkeletonCard from '@/components/SkeletonCard';
import ServiceAds from '@/components/ServiceAds';

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [showSaleOnly, setShowSaleOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const allProducts = getAllProducts();
  const subcategories = selectedCategory !== 'all' ? getSubcategoriesByCategory(selectedCategory) : [];

  // Load categories and listen for changes
  useEffect(() => {
    setCategories(getCategories());

    const handleVisibilityChange = () => {
      setCategories(getCategories());
    };

    window.addEventListener('categoryVisibilityChanged', handleVisibilityChange);
    return () => window.removeEventListener('categoryVisibilityChanged', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const search = searchParams.get('search') ?? '';
    const cat = searchParams.get('category') ?? '';
    const subcat = searchParams.get('subcategory') ?? '';
    const sale = searchParams.get('sale') === 'true';

    setSearchQuery(search);
    if (cat) setSelectedCategory(cat);
    if (subcat) setSelectedSubcategory(subcat);
    if (sale) setShowSaleOnly(true);

    let results = search ? searchProducts(search) : allProducts;
    setProducts(results);
    setLoading(false);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset subcategory when category changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setSelectedSubcategory('all');
    }
  }, [selectedCategory]);

  const filtered = products
    .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
    .filter((p) => selectedSubcategory === 'all' || p.subcategory === selectedSubcategory)
    .filter((p) => !showSaleOnly || p.isSale)
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'sale') return (b.isSale ? 1 : 0) - (a.isSale ? 1 : 0);
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-purple-900">
          {searchQuery
            ? `Search Results`
            : selectedSubcategory !== 'all'
            ? selectedSubcategory.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            : selectedCategory !== 'all'
            ? selectedCategory.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            : 'All Products'}
        </h1>
        <p className="text-gray-700 mt-1">
          {searchQuery ? (
            <>
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'} for <span className="font-bold text-purple-700">"{searchQuery}"</span>
            </>
          ) : (
            `${filtered.length} items available`
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="w-full sm:w-56 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 sticky top-[110px]">
            <h2 className="font-black text-purple-900 text-lg mb-4">Filters</h2>

            {/* Categories */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase tracking-wide">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === 'all' ? 'bg-purple-700 text-white font-bold' : 'text-gray-600 hover:bg-purple-50'}`}
                >
                  All Items
                </button>
                {categories.map((cat) => {
                  const categoryEmojis: Record<string, string> = {
                    'automotive': '🚗',
                    'grocery': '🛒',
                    'footwear': '👟',
                    'lawn-and-garden': '🌱',
                    'clothing': '👕',
                    'tools-and-hardware': '🔧',
                    'home-decor': '🖼️',
                    'electronics': '📱',
                    'sports': '🏀',
                    'pet-supplies': '🐾',
                    'toys-and-games': '🎮',
                    'audiobooks': '🎧',
                    'landscaping': '🌳',
                    'construction': '🏗️',
                    'electrician': '⚡',
                    'plumbing': '🔧'
                  };
                  const emoji = categoryEmojis[cat] || '';
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${selectedCategory === cat ? 'bg-purple-700 text-white font-bold' : 'text-gray-600 hover:bg-purple-50'}`}
                    >
                      {emoji && `${emoji} `}{cat.replace(/-/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategories - only show when category is selected */}
            {selectedCategory !== 'all' && subcategories.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase tracking-wide">Subcategory</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedSubcategory('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubcategory === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-gray-600 hover:bg-purple-50'}`}
                  >
                    All {selectedCategory.replace(/-/g, ' ')}
                  </button>
                  {subcategories.map((subcat) => {
                    const subcategoryEmojis: Record<string, string> = {
                      'ponies': '🐴',
                      'unicorns': '🦄',
                      'princesses': '👑',
                      'bow-and-arrow': '🏹',
                      'rock-collections': '💎',
                      'board-games': '🎲',
                      'classic-cars': '🏎️',
                      'tires-parts': '🛞',
                      'balls': '⚽',
                      'exercise-equipment': '🏋️',
                      'outdoor-recreation': '⛺'
                    };
                    const emoji = subcategoryEmojis[subcat] || '▸';
                    return (
                      <button
                        key={subcat}
                        onClick={() => setSelectedSubcategory(subcat)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${selectedSubcategory === subcat ? 'bg-purple-600 text-white font-bold' : 'text-gray-600 hover:bg-purple-50'}`}
                      >
                        {emoji && `${emoji} `}{subcat.replace(/-/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sale Filter */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase tracking-wide">Deals</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSaleOnly}
                  onChange={(e) => setShowSaleOnly(e.target.checked)}
                  className="w-4 h-4 accent-purple-700"
                />
                <span className="text-sm text-gray-600">Sale items only 🏷️</span>
              </label>
            </div>

            {/* Sort */}
            <div>
              <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase tracking-wide">Sort By</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="sale">On Sale First</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Product Grid - scrollable list */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-700">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-xl font-bold">
                {searchQuery ? `No results found for "${searchQuery}"` : 'No products found'}
              </p>
              <p className="text-sm mt-2">
                {searchQuery ? 'Try a different search term or browse our categories' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((product) => (
                <div key={product.id} className="animate-fadeIn">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Ads */}
        <ServiceAds />
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-purple-500 font-bold text-xl">Loading shop...</div>}>
      <ShopContent />
    </Suspense>
  );
}
