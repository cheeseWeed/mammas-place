// Checkout — MP Money flow. Closed-loop family economy: no shipping, no card, no tax.
// Three states by learner: anonymous → login prompt; logged-in low balance → "ask Dad";
// logged-in funded → big yellow Pay button. Server (/api/money/order) re-prices and is
// the sole authority on balance — client cents value is a hint only.
'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';
import * as gtag from '@/lib/gtag';
import Link from 'next/link';
import Confetti from 'react-confetti';

// Server response shapes for /api/money/order.
interface OrderSuccess {
  ok: true;
  orderId: string;
  balanceCents: number;
  totalCents: number;
}
interface OrderInsufficient {
  error: 'Insufficient funds';
  balanceCents: number;
  neededCents: number;
}
interface OrderError {
  error: string;
}

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const { learner, balanceCents, loading: learnerLoading, refresh } = useLearner();

  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderSuccess | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Cart subtotal is dollars (float); convert to authoritative cents for display + server hint.
  const subtotalCents = Math.round(cart.subtotal * 100);
  const itemDiscountCents = Math.round(cart.discount * 100);
  const totalCents = subtotalCents - itemDiscountCents;

  // Confetti needs viewport dims; track resize so it covers the whole screen on rotate/resize.
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (orderResult) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [orderResult]);

  // begin_checkout fires once when there are items to check out. Analytics-only.
  useEffect(() => {
    if (cart.items.length > 0 && !orderResult) {
      gtag.beginCheckout(
        cart.total,
        cart.items.map((i) => ({ id: i.productId, name: i.product.name, price: i.product.price, quantity: i.quantity }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empty-cart guard (skip while showing success so clearCart() doesn't bounce the user).
  if (cart.items.length === 0 && !orderResult) {
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

  // Success screen.
  if (orderResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={300}
          />
        )}
        <div className="text-7xl mb-4">🎉</div>
        <h1 className="text-3xl font-black text-purple-900 mb-2">Order placed! 🎉</h1>
        <p className="text-gray-700 mb-6">Thanks, {learner}!</p>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 mb-8 text-left">
          <div className="flex justify-between mb-3">
            <span className="font-bold text-gray-700">Order ID</span>
            <span className="font-mono text-sm text-purple-900">{orderResult.orderId}</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className="font-bold text-gray-700">Paid</span>
            <span className="font-black text-purple-900">{centsToMP(orderResult.totalCents)}</span>
          </div>
          <div className="flex justify-between border-t border-purple-200 pt-3">
            <span className="font-bold text-gray-700">New MP balance</span>
            <span className="font-black text-xl text-purple-900">{centsToMP(orderResult.balanceCents)}</span>
          </div>
        </div>

        <Link href="/shop" className="bg-purple-700 hover:bg-purple-600 text-white font-black px-8 py-4 rounded-2xl text-lg inline-block transition-colors">
          Keep Shopping ✨
        </Link>
      </div>
    );
  }

  // Anonymous: no balance, no form — just a login nudge.
  if (!learnerLoading && learner === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8 text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-black text-purple-900 mb-3">Log in to use MP Money</h1>
          <p className="text-gray-700 mb-6">
            You need to be logged in to spend your MP.
            <br />
            Your cart will be waiting for you!
          </p>
          <Link
            href="/shop/login"
            className="bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-purple-900 font-black px-8 py-4 rounded-2xl text-lg inline-block shadow-md transition-all hover:scale-105"
          >
            Log In ✨
          </Link>
          <div className="mt-4">
            <Link href="/cart" className="text-sm text-purple-600 hover:underline font-medium">← Back to cart</Link>
          </div>
        </div>
      </div>
    );
  }

  // Server is authoritative; until we have a balance number, treat as not-enough.
  const haveEnough = balanceCents !== null && balanceCents >= totalCents;
  const shortfallCents = balanceCents === null ? totalCents : Math.max(0, totalCents - balanceCents);
  const afterCents = balanceCents === null ? 0 : balanceCents - totalCents;

  const handlePlaceOrder = async () => {
    if (placing) return;
    setPlacing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/money/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: learner,
          items: cart.items.map((i) => ({ productId: i.productId, qty: i.quantity })),
        }),
      });
      const data: OrderSuccess | OrderInsufficient | OrderError = await res.json();

      if (res.ok && 'ok' in data && data.ok) {
        gtag.purchase(
          data.orderId,
          data.totalCents / 100,
          cart.items.map((i) => ({ id: i.productId, name: i.product.name, price: i.product.price, quantity: i.quantity }))
        );
        clearCart();
        await refresh();
        setOrderResult(data);
        return;
      }

      if (res.status === 402 && 'balanceCents' in data) {
        // Race condition: balance dropped between page load and click. Refresh + show friendly insufficient state.
        await refresh();
        setErrorMsg(null);
      } else {
        setErrorMsg('error' in data && data.error ? data.error : 'Something went wrong. Try again?');
      }
    } catch {
      setErrorMsg('Network error. Try again?');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-black text-purple-900 mb-6">Checkout 🛍️</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT - Pay panel */}
        <div className="flex-1 space-y-5">
          {learnerLoading ? (
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8 text-center text-gray-500">
              Loading your balance…
            </section>
          ) : haveEnough ? (
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">💰</div>
                <h2 className="font-black text-purple-900 text-2xl mb-1">Pay with MP Money</h2>
                <p className="text-gray-700 text-sm">
                  Logged in as <span className="font-bold text-purple-800">{learner}</span>
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>Your balance</span>
                  <span className="font-bold">{centsToMP(balanceCents ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700 mb-2">
                  <span>This order</span>
                  <span className="font-bold">−{centsToMP(totalCents)}</span>
                </div>
                <div className="flex justify-between border-t border-purple-200 pt-2 text-base">
                  <span className="font-bold text-purple-900">After this order</span>
                  <span className="font-black text-purple-900">{centsToMP(afterCents)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={placing}
                className="w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 disabled:bg-yellow-200 disabled:cursor-not-allowed text-purple-900 font-black py-4 rounded-2xl text-lg shadow-md transition-all hover:scale-105 disabled:hover:scale-100"
              >
                {placing ? 'Placing order…' : `Pay ${centsToMP(totalCents)} ✨`}
              </button>

              {errorMsg && (
                <p className="text-red-600 text-sm mt-3 text-center font-medium">{errorMsg}</p>
              )}
            </section>
          ) : (
            <section className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8 text-center">
              <div className="text-6xl mb-4">🐷</div>
              <h2 className="font-black text-purple-900 text-2xl mb-2">Almost there!</h2>
              <p className="text-gray-700 text-base mb-4">
                You need{' '}
                <span className="font-black text-purple-900 text-xl">{centsToMP(shortfallCents)}</span>{' '}
                more.
              </p>
              <p className="text-gray-700 text-base mb-6">
                Ask Dad to top you up. 💖
              </p>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-2 text-left">
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>Your balance</span>
                  <span className="font-bold">{centsToMP(balanceCents ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>This order</span>
                  <span className="font-bold">{centsToMP(totalCents)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="mt-5 w-full bg-yellow-200 cursor-not-allowed text-purple-900/60 font-black py-4 rounded-2xl text-lg"
              >
                Not enough MP yet
              </button>
            </section>
          )}

          <div className="text-center">
            <Link href="/cart" className="text-sm text-purple-600 hover:underline font-medium">← Back to cart</Link>
          </div>
        </div>

        {/* RIGHT - Order Summary (cents-precise, no tax, no shipping) */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-5 sticky top-[110px]">
            <h2 className="font-black text-purple-900 text-xl mb-4">Order Summary</h2>

            <div className="space-y-3 mb-4">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex gap-3 items-center text-sm">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-xl shrink-0">
                    {item.product.category === 'ponies' ? '🐴' : item.product.category === 'unicorns' ? '🦄' : '👑'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-gray-700 text-sm">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-purple-800 shrink-0">
                    {centsToMP(Math.round(item.product.price * 100) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{centsToMP(subtotalCents)}</span>
              </div>
              {itemDiscountCents > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Item Savings 🏷️</span>
                  <span>−{centsToMP(itemDiscountCents)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between font-black text-xl text-gray-900">
                <span>Total</span>
                <span className="text-purple-800">{centsToMP(totalCents)}</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-700 mt-4">
              💜 Family money · No tax · No shipping
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
