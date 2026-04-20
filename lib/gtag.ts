export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

const isAvailable = () => typeof window !== "undefined" && typeof window.gtag === "function";

// Log a page view
export const pageview = (url: string) => {
  if (!isAvailable()) return;
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

// Log a custom event
type GTagEvent = {
  action: string;
  category: string;
  label: string;
  value?: number;
};

export const event = ({ action, category, label, value }: GTagEvent) => {
  if (!isAvailable()) return;
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// E-commerce events
export const viewItem = (item: { id: string; name: string; category: string; price: number }) => {
  if (!isAvailable()) return;
  window.gtag("event", "view_item", {
    currency: "USD",
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price }],
  });
};

export const addToCart = (item: { id: string; name: string; category: string; price: number; quantity: number }) => {
  if (!isAvailable()) return;
  window.gtag("event", "add_to_cart", {
    currency: "USD",
    value: item.price * item.quantity,
    items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price, quantity: item.quantity }],
  });
};

export const removeFromCart = (item: { id: string; name: string; price: number }) => {
  if (!isAvailable()) return;
  window.gtag("event", "remove_from_cart", {
    currency: "USD",
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
};

export const beginCheckout = (value: number, items: { id: string; name: string; price: number; quantity: number }[]) => {
  if (!isAvailable()) return;
  window.gtag("event", "begin_checkout", {
    currency: "USD",
    value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
};

export const purchase = (transactionId: string, value: number, items: { id: string; name: string; price: number; quantity: number }[]) => {
  if (!isAvailable()) return;
  window.gtag("event", "purchase", {
    transaction_id: transactionId,
    currency: "USD",
    value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
};

export const promoCodeApplied = (code: string) => {
  if (!isAvailable()) return;
  window.gtag("event", "promo_code_applied", {
    event_category: "engagement",
    event_label: code,
  });
};
