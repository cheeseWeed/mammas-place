// Shared TypeScript interfaces for Product, Cart, CartItem, Order, and Review
export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  description: string;
  shortDescription: string;
  category: string;
  subcategory?: string;
  tags: string[];
  imageUrl: string;
  images: string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isSale: boolean;
  isFeatured: boolean;
  isComingSoon?: boolean;
  createdAt: string;
  availableOnWebsite: boolean;
  sku: string;
  audioPreviewUrl?: string;
  isAudiobook?: boolean;
  isStudyGuide?: boolean;
  studyGuideUrl?: string;
  downloadUrl?: string;
  // Series grouping for audiobooks (e.g. "Bedtime Explorers", "Rock Hunters").
  // Null/undefined for non-audiobook items. Each standalone audiobook gets its
  // own single-item series so the "up next" lookup always has a key.
  series?: string;
  // Episode number within the series (1-indexed). Used for ordering when picking
  // the next un-completed item in a series.
  episode?: number;
  reviews?: Review[];

  // ----- Inventory rotation (lib/inventory.ts) -----
  // null/undefined stockQuantity = unlimited (legacy default).
  stockQuantity?: number | null;
  // See lib/inventory.ts AvailabilityRule for the shape.
  availabilityRule?: {
    type: 'always' | 'weekly' | 'monthly' | 'dated';
    daysOfWeek?: number[];
    weekOfMonth?: number[];
    featuredDates?: string[];
  } | null;
  // See lib/inventory.ts RestockSchedule for the shape.
  restockSchedule?: {
    cadence: 'mon-thu' | 'weekly' | 'never';
    amount: number;
  } | null;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  createdAt: string;
  customerEmail?: string;
  promoCode?: string;
}
