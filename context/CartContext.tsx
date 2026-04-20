'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cart, Product } from '@/types';
import * as cartLib from '@/lib/cart';
import * as gtag from '@/lib/gtag';

interface CartContextType {
  cart: Cart;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => {
    // Initialize state with cart from localStorage on first render (client-side only)
    // On server, this will return empty cart (window is undefined)
    return cartLib.getCart();
  });

  useEffect(() => {
    // Re-sync on mount to handle any SSR/hydration edge cases
    setCart(cartLib.getCart());
  }, []);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(cartLib.addToCart(product, quantity));
    gtag.addToCart({ id: product.id, name: product.name, category: product.category, price: product.price, quantity });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(cartLib.updateQuantity(productId, quantity));
  };

  const removeFromCart = (productId: string) => {
    const item = cart.items.find((i) => i.productId === productId);
    setCart(cartLib.removeFromCart(productId));
    if (item) {
      gtag.removeFromCart({ id: item.productId, name: item.product.name, price: item.product.price });
    }
  };

  const clearCart = () => {
    setCart(cartLib.clearCart());
  };

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
