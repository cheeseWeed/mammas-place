'use client';

import Link from 'next/link';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product);
    showToast(`${product.name} added to cart!`, 'success', '🛒');
  };

  return (
    <Link href={`/product/${product.id}`} className="group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-purple-100">
      {/* Image */}
      <div className="relative bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden transition-transform duration-300 group-hover:scale-105">
        <div className={`${compact ? 'h-32' : 'h-52'} flex items-center justify-center p-4`}>
          <ProductImage product={product} />
        </div>
        {product.isSale && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            SALE {product.discount}% OFF
          </div>
        )}
        {product.isFeatured && !product.isSale && (
          <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            FEATURED
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-xs text-purple-500 uppercase font-semibold mb-1 capitalize">{product.category}</div>
        <h3 className={`font-bold text-gray-800 group-hover:text-purple-700 transition-colors leading-tight ${compact ? 'text-sm' : 'text-base'}`}>
          {product.name}
        </h3>

        {!compact && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{product.shortDescription}</p>
        )}

        {/* Rating */}
        {!compact && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex text-yellow-400 text-xs">
              {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
            </div>
            <span className="text-gray-400 text-xs">({product.reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className={`font-black text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}>
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-gray-400 text-xs line-through ml-2">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Add to Cart */}
        {!compact && (
          product.inStock ? (
            <button
              onClick={handleAddToCart}
              className="mt-3 w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Cart
            </button>
          ) : (
            <div className="mt-3 w-full bg-gray-100 text-gray-400 font-bold py-2 rounded-xl text-sm text-center border border-gray-200">
              ❌ Unavailable
            </div>
          )
        )}
      </div>
    </Link>
  );
}

function ProductImage({ product }: { product: Product }) {
  const emojiMap: Record<string, string> = {
    ponies: '🐴',
    unicorns: '🦄',
    princesses: '👑',
    'bow-and-arrow': '🏹',
    'rock-collections': '💎',
    games: '🎮',
    audiobooks: '🎧',
  };
  const emoji = emojiMap[product.category] ?? '🛍️';

  const colors: Record<string, string> = {
    ponies: 'from-pink-200 to-purple-200',
    unicorns: 'from-purple-200 to-blue-200',
    princesses: 'from-yellow-100 to-pink-200',
    'bow-and-arrow': 'from-green-100 to-yellow-100',
    'rock-collections': 'from-gray-100 to-blue-100',
    games: 'from-blue-100 to-purple-100',
    audiobooks: 'from-purple-200 to-indigo-200',
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${colors[product.category] ?? 'from-purple-100 to-white'} rounded-xl`}>
      <span className="text-6xl">{emoji}</span>
      <span className="text-xs text-gray-500 mt-1 text-center px-2 font-medium">{product.name.split(' ')[0]}</span>
    </div>
  );
}
