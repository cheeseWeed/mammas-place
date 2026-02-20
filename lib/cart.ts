import { Cart, CartItem, Product } from '@/types';

const CART_KEY = 'mammas-place-cart';

export function getCart(): Cart {
  if (typeof window === 'undefined') return emptyCart();
  const stored = localStorage.getItem(CART_KEY);
  if (!stored) return emptyCart();
  try {
    const items: CartItem[] = JSON.parse(stored);
    return calculateCart(items);
  } catch {
    return emptyCart();
  }
}

export function addToCart(product: Product, quantity = 1): Cart {
  const cart = getCart();
  const existing = cart.items.find((i) => i.productId === product.id);
  let items: CartItem[];
  if (existing) {
    items = cart.items.map((i) =>
      i.productId === product.id
        ? { ...i, quantity: i.quantity + quantity }
        : i
    );
  } else {
    items = [...cart.items, { productId: product.id, product, quantity }];
  }
  const newCart = calculateCart(items);
  saveCart(items);
  return newCart;
}

export function updateQuantity(productId: string, quantity: number): Cart {
  const cart = getCart();
  const items =
    quantity <= 0
      ? cart.items.filter((i) => i.productId !== productId)
      : cart.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        );
  const newCart = calculateCart(items);
  saveCart(items);
  return newCart;
}

export function removeFromCart(productId: string): Cart {
  const cart = getCart();
  const items = cart.items.filter((i) => i.productId !== productId);
  const newCart = calculateCart(items);
  saveCart(items);
  return newCart;
}

export function clearCart(): Cart {
  saveCart([]);
  return emptyCart();
}

export function applyPromoCode(code: string): number {
  const codes: Record<string, number> = {
    MAMMA10: 0.1,
    PRINCESS20: 0.2,
    UNICORN15: 0.15,
    PONY25: 0.25,
    SAVE30: 0.3,
  };
  return codes[code.toUpperCase()] ?? 0;
}

function calculateCart(items: CartItem[]): Cart {
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const discount = items.reduce((sum, item) => {
    const orig = item.product.originalPrice ?? item.product.price;
    const savings = (orig - item.product.price) * item.quantity;
    return sum + (savings > 0 ? savings : 0);
  }, 0);
  const tax = subtotal * 0.08;
  const shipping = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + tax + shipping;
  return { items, subtotal, discount, tax, shipping, total };
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function emptyCart(): Cart {
  return { items: [], subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 };
}
