'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAllProducts, searchProducts, getCategories } from '@/lib/products';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import SkeletonCard from '@/components/SkeletonCard';

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [showSaleOnly, setShowSaleOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = getCategories();
  const allProducts = getAllProducts();

  useEffect(() => {
    const search = searchParams.get('search') ?? '';
    const cat = searchParams.get('category') ?? '';
    const sale = searchParams.get('sale') === 'true';

    setSearchQuery(search);
    if (cat) setSelectedCategory(cat);
    if (sale) setShowSaleOnly(true);

    let results = search ? searchProducts(search) : allProducts;
    setProducts(results);
    setLoading(false);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = products
    .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
    .filter((p) => !showSaleOnly || p.isSale)
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'sale') return (b.isSale ? 1 : 0) - (a.isSale ? 1 : 0);
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-purple-900">
          {searchQuery
            ? `Search Results`
            : selectedCategory !== 'all'
            ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)
            : 'All Products'}
        </h1>
        <p className="text-gray-500 mt-1">
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
                  const emoji = cat === 'ponies' ? '🐴' : cat === 'unicorns' ? '🦄' : cat === 'princesses' ? '👑' : cat === 'bow-and-arrow' ? '🏹' : cat === 'rock-collections' ? '💎' : cat === 'games' ? '🎮' : cat === 'audiobooks' ? '🎧' : '';
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
            <div className="text-center py-20 text-gray-400">
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
