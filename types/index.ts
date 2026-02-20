export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  description: string;
  shortDescription: string;
  category: string;
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
