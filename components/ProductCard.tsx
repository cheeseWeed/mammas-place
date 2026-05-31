// Product card — reusable grid item used on shop page, homepage, and related products
'use client';

import Link from 'next/link';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { isAvailableNow, isInStock } from '@/lib/inventory';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

// "Coming Tuesday" / "Coming Sunday" — friendly label for a product whose
// weekly availability window includes a future day this week. Returns null if
// we can't compute a useful next-available day (e.g. monthly/dated/always rules).
function nextAvailableLabel(product: Product): string | null {
  const rule = product.availabilityRule;
  if (!rule) return null;
  if (rule.type !== 'weekly' || !rule.daysOfWeek || rule.daysOfWeek.length === 0) {
    return null;
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();
  // Find the next future day in the rule (wrap-around).
  for (let i = 1; i <= 7; i++) {
    const candidate = (today + i) % 7;
    if (rule.daysOfWeek.includes(candidate)) {
      return `Coming ${dayNames[candidate]}`;
    }
  }
  return null;
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  // Inventory gates — server is authoritative (order route also checks), but
  // the UI surfaces the state so the buy button can be disabled and a friendly
  // badge can replace the price block instead of just hiding the card.
  const available = isAvailableNow(product);
  const stocked = isInStock(product);
  const soldOut = !stocked;
  const comingLabel = !available ? nextAvailableLabel(product) : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product);
    showToast(`${product.name} added to cart!`, 'success', '🛒');
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (product.downloadUrl) {
      const link = document.createElement('a');
      link.href = product.downloadUrl;
      link.download = product.name.replace(/[^a-z0-9]/gi, '_') + '.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloading ${product.name}...`, 'success', '📥');
    }
  };

  return (
    <Link href={`/product/${product.id}`} className="group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-purple-100">
      {/* Image */}
      <div className="relative bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden transition-transform duration-300 group-hover:scale-105">
        <div className={`${compact ? 'h-32' : 'h-52'} flex items-center justify-center p-4`}>
          <ProductImage product={product} />
        </div>
        {product.isSale && product.discount && product.discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            SALE {product.discount}% OFF
          </div>
        )}
        {product.isFeatured && !product.isSale && (
          <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            FEATURED
          </div>
        )}
        {soldOut && (
          <div className="absolute top-2 right-2 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">
            SOLD OUT
          </div>
        )}
        {!soldOut && comingLabel && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {comingLabel.toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-sm text-purple-500 uppercase font-semibold mb-1 capitalize">{product.category}</div>
        <h3 className={`font-bold text-gray-800 group-hover:text-purple-700 transition-colors leading-tight ${compact ? 'text-sm' : 'text-base'}`}>
          {product.name}
        </h3>

        {!compact && (
          <p className="text-gray-700 text-sm mt-1 line-clamp-2">{product.shortDescription}</p>
        )}

        {/* Rating */}
        {!compact && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex text-yellow-400 text-sm">
              {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
            </div>
            <span className="text-gray-600 text-sm">({product.reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className={`font-black text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}>
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-gray-600 text-sm line-through ml-2">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Add to Cart or Download */}
        {!compact && (
          product.isAudiobook && product.downloadUrl ? (
            <button
              onClick={handleDownload}
              aria-label={`Download ${product.name}`}
              className="mt-3 w-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          ) : soldOut ? (
            <div className="mt-3 w-full bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm text-center border border-gray-300">
              Sold Out
            </div>
          ) : !available ? (
            <div className="mt-3 w-full bg-amber-50 text-amber-800 font-bold py-2 rounded-xl text-sm text-center border border-amber-200">
              {comingLabel ?? 'Not available today'}
            </div>
          ) : product.inStock ? (
            <button
              onClick={handleAddToCart}
              aria-label={`Add ${product.name} to cart`}
              className="mt-3 w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Cart
            </button>
          ) : (
            <div className="mt-3 w-full bg-gray-100 text-gray-600 font-bold py-2 rounded-xl text-sm text-center border border-gray-200">
              ❌ Unavailable
            </div>
          )
        )}
      </div>
    </Link>
  );
}

function ProductImage({ product }: { product: Product }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden bg-white">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
