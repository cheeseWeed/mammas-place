'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { applyPromoCode } from '@/lib/cart';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const router = useRouter();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });

  if (cart.items.length === 0 && !orderPlaced) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-7xl mb-4">🛒</div>
        <h1 className="text-3xl font-black text-purple-900 mb-4">Your cart is empty!</h1>
        <Link href="/shop" className="bg-purple-700 text-white font-black px-8 py-4 rounded-2xl text-lg inline-block hover:bg-purple-600 transition-colors">
          Go Shopping ✨
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-7xl mb-4">🎉</div>
        <h1 className="text-3xl font-black text-purple-900 mb-2">Order Confirmed!</h1>
        <p className="text-gray-600 mb-2">Thank you for shopping at Mamma&apos;s Place!</p>
        <p className="text-gray-500 mb-8">A confirmation will be sent to <strong>{form.email}</strong></p>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 mb-8 text-left">
          <h2 className="font-black text-purple-900 mb-3">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>${cart.subtotal.toFixed(2)}</span></div>
            {cart.discount > 0 && <div className="flex justify-between text-green-600"><span>Item Savings</span><span>−${cart.discount.toFixed(2)}</span></div>}
            {promoDiscount > 0 && <div className="flex justify-between text-green-600"><span>Promo ({appliedPromo})</span><span>−${(cart.subtotal * promoDiscount).toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>Tax</span><span>${cart.tax.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{cart.shipping === 0 ? 'FREE' : `$${cart.shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-black text-lg text-purple-900 border-t border-purple-200 pt-2 mt-2">
              <span>Total Paid</span>
              <span>${(cart.total - cart.subtotal * promoDiscount).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <Link href="/shop" className="bg-purple-700 hover:bg-purple-600 text-white font-black px-8 py-4 rounded-2xl text-lg inline-block transition-colors">
          Keep Shopping ✨
        </Link>
      </div>
    );
  }

  const handleApplyPromo = () => {
    const discount = applyPromoCode(promoCode);
    if (discount > 0) {
      setPromoDiscount(discount);
      setAppliedPromo(promoCode.toUpperCase());
      setPromoError('');
    } else {
      setPromoError('Invalid promo code. Try MAMMA10, PRINCESS20, UNICORN15, PONY25, or SAVE30');
      setPromoDiscount(0);
      setAppliedPromo('');
    }
  };

  const promoSavings = cart.subtotal * promoDiscount;
  const finalTotal = cart.total - promoSavings;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderPlaced(true);
    clearCart();
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-black text-purple-900 mb-6">Checkout 🛍️</h1>

      <form onSubmit={handlePlaceOrder}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT - Form */}
          <div className="flex-1 space-y-5">
            {/* Contact */}
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
              <h2 className="font-black text-purple-900 text-lg mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-purple-700 text-white rounded-full flex items-center justify-center text-sm font-black">1</span>
                Contact Information
              </h2>
              <input
                required
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </section>

            {/* Shipping */}
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
              <h2 className="font-black text-purple-900 text-lg mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-purple-700 text-white rounded-full flex items-center justify-center text-sm font-black">2</span>
                Shipping Address
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input required type="text" placeholder="First name" value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <input required type="text" placeholder="Last name" value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <input required type="text" placeholder="Address" value={form.address} onChange={(e) => updateForm('address', e.target.value)} className="col-span-2 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <input required type="text" placeholder="City" value={form.city} onChange={(e) => updateForm('city', e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" placeholder="State" value={form.state} onChange={(e) => updateForm('state', e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input required type="text" placeholder="ZIP" value={form.zip} onChange={(e) => updateForm('zip', e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5">
              <h2 className="font-black text-purple-900 text-lg mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-purple-700 text-white rounded-full flex items-center justify-center text-sm font-black">3</span>
                Payment
              </h2>
              <div className="space-y-3">
                <input required type="text" placeholder="Name on card" value={form.cardName} onChange={(e) => updateForm('cardName', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <input required type="text" placeholder="Card number (e.g. 4111 1111 1111 1111)" value={form.cardNumber} onChange={(e) => updateForm('cardNumber', e.target.value)} maxLength={19} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" placeholder="MM/YY" value={form.expiry} onChange={(e) => updateForm('expiry', e.target.value)} maxLength={5} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input required type="text" placeholder="CVV" value={form.cvv} onChange={(e) => updateForm('cvv', e.target.value)} maxLength={4} className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                🔒 Your payment info is secure and encrypted
              </p>
            </section>
          </div>

          {/* RIGHT - Order Summary */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5 sticky top-[110px]">
              <h2 className="font-black text-purple-900 text-xl mb-4">Order Summary</h2>

              {/* Items */}
              <div className="space-y-3 mb-4">
                {cart.items.map((item) => (
                  <div key={item.productId} className="flex gap-3 items-center text-sm">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-xl shrink-0">
                      {item.product.category === 'ponies' ? '🐴' : item.product.category === 'unicorns' ? '🦄' : '👑'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{item.product.name}</p>
                      <p className="text-gray-400 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold text-purple-800 shrink-0">${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                {/* Promo Code */}
                <div className="mb-3">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1 block">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter code"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                  {appliedPromo && <p className="text-green-600 text-xs mt-1 font-bold">✅ {appliedPromo} applied! {(promoDiscount * 100).toFixed(0)}% off</p>}
                </div>

                {/* Price Breakdown */}
                <div className="text-sm space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${cart.subtotal.toFixed(2)}</span>
                  </div>
                  {cart.discount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Item Savings 🏷️</span>
                      <span>−${cart.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {promoSavings > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Promo ({appliedPromo}) 🎟️</span>
                      <span>−${promoSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (8%)</span>
                    <span>${cart.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className={cart.shipping === 0 ? 'text-green-600 font-bold' : ''}>
                      {cart.shipping === 0 ? 'FREE 🎉' : `$${cart.shipping.toFixed(2)}`}
                    </span>
                  </div>

                  {(cart.discount + promoSavings) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 flex justify-between text-green-700 font-bold text-sm">
                      <span>You saved!</span>
                      <span>−${(cart.discount + promoSavings).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3 flex justify-between font-black text-xl text-gray-900">
                    <span>Total</span>
                    <span className="text-purple-800">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-4 w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-purple-900 font-black py-4 rounded-2xl text-lg shadow-md transition-all hover:scale-105"
                >
                  Place Order — ${finalTotal.toFixed(2)} 🎉
                </button>

                <p className="text-center text-xs text-gray-400 mt-2">
                  🔒 Secure checkout · 30-day returns · SSL encrypted
                </p>

                <div className="text-center mt-2">
                  <Link href="/cart" className="text-xs text-purple-500 hover:underline">← Back to cart</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
