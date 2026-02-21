'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const router = useRouter();

  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-7xl mb-4">🛒</div>
        <h1 className="text-3xl font-black text-purple-900 mb-4">Your cart is empty!</h1>
        <p className="text-gray-500 mb-8">Add some magical items to get started.</p>
        <Link href="/shop" className="bg-purple-700 hover:bg-purple-600 text-white font-black px-8 py-4 rounded-2xl text-lg transition-colors inline-block">
          Start Shopping ✨
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-purple-900">My Cart 🛒</h1>
        <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-600 font-medium transition-colors">
          Clear cart
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Cart Items */}
        <div className="flex-1 space-y-4">
          {cart.items.map((item) => {
            return (
              <div key={item.productId} className="bg-white rounded-2xl shadow-sm border border-purple-100 p-4 flex gap-4 items-start">
                {/* Product Image */}
                <Link href={`/product/${item.productId}`}>
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-white shrink-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.productId}`}>
                    <h3 className="font-black text-gray-900 hover:text-purple-700 transition-colors leading-tight">{item.product.name}</h3>
                  </Link>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{item.product.category}</p>

                  {item.product.isSale && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                      {item.product.discount}% OFF
                    </span>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 font-black flex items-center justify-center transition-colors"
                      >
                        −
                      </button>
                      <span className="font-black text-lg text-gray-900 w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 font-black flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="font-black text-purple-800 text-lg">${(item.product.price * item.quantity).toFixed(2)}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-gray-400">${item.product.price.toFixed(2)} each</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-1"
                  title="Remove item"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}

          <div className="pt-2">
            <Link href="/shop" className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1">
              ← Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5 sticky top-[110px]">
            <h2 className="font-black text-purple-900 text-xl mb-4">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cart.items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-semibold">${cart.subtotal.toFixed(2)}</span>
              </div>

              {cart.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Item Savings 🏷️</span>
                  <span className="font-bold">−${cart.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Estimated Tax (8%)</span>
                <span className="font-semibold">${cart.tax.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={`font-semibold ${cart.shipping === 0 ? 'text-green-600' : ''}`}>
                  {cart.shipping === 0 ? 'FREE 🎉' : `$${cart.shipping.toFixed(2)}`}
                </span>
              </div>

              {cart.shipping > 0 && (
                <p className="text-xs text-purple-500 bg-purple-50 px-3 py-2 rounded-lg">
                  Add ${(50 - cart.subtotal).toFixed(2)} more for free shipping!
                </p>
              )}

              <div className="border-t border-gray-100 pt-3 flex justify-between text-gray-900 font-black text-xl">
                <span>Total</span>
                <span className="text-purple-800">${cart.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/checkout')}
              className="mt-5 w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-purple-900 font-black py-4 rounded-2xl text-lg shadow-md transition-all hover:scale-105"
            >
              Proceed to Checkout →
            </button>

            <p className="text-center text-xs text-gray-400 mt-3">
              🔒 Secure checkout · 30-day returns
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
