'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cart, Product } from '@/types';
import * as cartLib from '@/lib/cart';

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
  const [cart, setCart] = useState<Cart>({
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 0,
  });

  useEffect(() => {
    setCart(cartLib.getCart());
  }, []);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(cartLib.addToCart(product, quantity));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(cartLib.updateQuantity(productId, quantity));
  };

  const removeFromCart = (productId: string) => {
    setCart(cartLib.removeFromCart(productId));
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
