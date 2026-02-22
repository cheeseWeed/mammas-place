'use client';

import { useParams, useRouter } from 'next/navigation';
import { getProductById, getRelatedProducts } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import SkeletonProductDetail from '@/components/SkeletonProductDetail';
import AudioPlayer from '@/components/AudioPlayer';
import { Review } from '@/types';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 50); return () => clearTimeout(t); }, []);
  if (loading) return <SkeletonProductDetail />;

  const product = getProductById(params.id as string);

  if (!product) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">😢</div>
        <h1 className="text-2xl font-black text-gray-700">Product not found</h1>
        <Link href="/shop" className="mt-4 inline-block text-purple-700 font-bold hover:underline">← Back to Shop</Link>
      </div>
    );
  }

  const related = getRelatedProducts(product, 5);

  // Mock customer reviews for demo purposes
  const mockReviews: Review[] = [
    {
      id: '1',
      author: 'Sarah M.',
      rating: 5,
      date: '2026-02-10',
      comment: 'My kids absolutely love this! Best purchase I\'ve made in a while. Great quality and fast shipping.',
      verified: true
    },
    {
      id: '2',
      author: 'Mike T.',
      rating: 5,
      date: '2026-02-05',
      comment: 'Exceeded expectations! My daughter plays with this every day. Highly recommend!',
      verified: true
    },
    {
      id: '3',
      author: 'Jennifer L.',
      rating: 4,
      date: '2026-01-28',
      comment: 'Really good product, kids enjoy it. Only minor issue was packaging could be better.',
      verified: true
    },
  ];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`${product.name} added!`, 'success', '🛒');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    router.push('/checkout');
  };

  const emojiMap: Record<string, string> = {
    ponies: '🐴',
    unicorns: '🦄',
    princesses: '👑',
    'bow-and-arrow': '🏹',
    'rock-collections': '💎',
    games: '🎮',
    audiobooks: '🎧',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-700 mb-4 flex gap-2 items-center">
        <Link href="/" className="hover:text-purple-700">Home</Link>
        <span>›</span>
        <Link href="/shop" className="hover:text-purple-700">Shop</Link>
        <span>›</span>
        <Link href={`/shop?category=${product.category}`} className="hover:text-purple-700 capitalize">{product.category}</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium truncate">{product.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT SIDEBAR - Related Items (as requested) */}
        <aside className="w-full lg:w-60 shrink-0 order-3 lg:order-1">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 sticky top-[110px]">
            <h2 className="font-black text-purple-900 text-base mb-3">You Might Also Love</h2>
            <div className="space-y-3">
              {related.map((r) => (
                <Link key={r.id} href={`/product/${r.id}`} className="flex gap-3 items-center group p-2 rounded-xl hover:bg-purple-50 transition-colors">
                  <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white">
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 group-hover:text-purple-700 leading-tight line-clamp-2">{r.name}</p>
                    <p className="text-purple-700 font-black text-sm mt-1">${r.price.toFixed(2)}</p>
                    {r.isSale && (
                      <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">SALE</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Link href={`/shop?category=${product.category}`} className="mt-4 block text-center text-sm text-purple-600 font-bold hover:underline">
              See all {product.category} →
            </Link>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 order-1 lg:order-2">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
            {/* Product Image */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-10 flex items-center justify-center">
              <div className="w-full max-w-md">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>

            {/* Product Info */}
            <div className="p-6">
              {/* Category & Sale Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-purple-500 uppercase font-semibold capitalize bg-purple-50 px-2 py-1 rounded-full">{product.category}</span>
                {product.isSale && (
                  <span className="text-sm bg-red-500 text-white font-bold px-2 py-1 rounded-full">
                    {product.discount}% OFF SALE!
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex text-yellow-400 text-lg">
                  {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
                </div>
                <span className="text-gray-600 text-sm font-medium">{product.rating} ({product.reviewCount} reviews)</span>
              </div>

              {/* Audio Preview Player */}
              {product.isAudiobook && product.audioPreviewUrl && (
                <div className="mt-4">
                  <AudioPlayer src={product.audioPreviewUrl} title={product.name} />
                </div>
              )}

              {/* Price Section */}
              <div className="mt-4 p-4 bg-purple-50 rounded-xl">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-black text-purple-800">${product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <div className="mb-1">
                      <span className="text-gray-600 text-xl line-through">${product.originalPrice.toFixed(2)}</span>
                      <div className="text-green-600 text-sm font-bold">
                        You save ${(product.originalPrice - product.price).toFixed(2)}!
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  {product.inStock
                    ? `✅ In Stock — ${product.stockCount} available`
                    : '❌ Out of Stock'}
                </p>
                <p className="text-sm text-green-600 font-medium mt-1">
                  🚚 {product.price >= 50 ? 'FREE shipping!' : `Add $${(50 - product.price).toFixed(2)} more for free shipping`}
                </p>
              </div>

              {!product.inStock && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-2">
                  ❌ This item is currently unavailable and cannot be added to cart.
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="w-9 h-9 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 font-black text-lg flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <span className="text-xl font-black text-gray-900 w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                    aria-label="Increase quantity"
                    className="w-9 h-9 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 font-black text-lg flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-700">Total: <strong className="text-purple-800">${(product.price * quantity).toFixed(2)}</strong></span>
                </div>
              </div>

              {/* Action Buttons - from your sketch */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBuyNow}
                  disabled={!product.inStock}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:bg-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:scale-100 text-purple-900 font-black py-4 rounded-2xl text-lg shadow-md transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  ⚡ BUY NOW
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className="flex-1 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 disabled:bg-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:scale-100 text-white font-black py-4 rounded-2xl text-lg shadow-md transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  ADD TO CART
                </button>
              </div>

              {/* Description - Explanation as in your sketch */}
              <div className="mt-6">
                <h2 className="text-lg font-black text-gray-900 mb-3">Explanation / Description</h2>
                <p className="text-gray-700 leading-relaxed">{product.description}</p>
              </div>

              {/* Product Details */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-black text-gray-700 mb-3 uppercase tracking-wide">Product Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-700">Category</span>
                    <p className="font-semibold capitalize">{product.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-700">Tags</span>
                    <p className="font-semibold">{product.tags.join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-700">In Stock</span>
                    <p className="font-semibold">{product.stockCount} units</p>
                  </div>
                  <div>
                    <span className="text-gray-700">Rating</span>
                    <p className="font-semibold">{product.rating}/5.0</p>
                  </div>
                </div>
              </div>

              {/* Customer Reviews Section */}
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="text-lg font-black text-gray-900 mb-4">Customer Reviews</h3>

                {/* Review Summary */}
                <div className="bg-purple-50 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-center sm:text-left">
                    <div className="text-4xl font-black text-purple-800">{product.rating}</div>
                    <div className="flex text-yellow-400 text-lg mt-1">
                      {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">{product.reviewCount} reviews</div>
                  </div>
                  <div className="flex-1 text-sm text-gray-600">
                    <p className="font-semibold">Customers love this product!</p>
                    <p className="text-sm mt-1">Based on verified purchases</p>
                  </div>
                </div>

                {/* Individual Reviews */}
                <div className="space-y-4">
                  {mockReviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-gray-900">{review.author}</span>
                            {review.verified && (
                              <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex text-yellow-400 text-sm">
                              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </div>
                            <span className="text-sm text-gray-700">
                              {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Customers Also Bought Section */}
          {related.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-black text-gray-900 mb-4">Customers Also Bought</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {related.slice(0, 4).map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
