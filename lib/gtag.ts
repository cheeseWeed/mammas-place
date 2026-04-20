import { sendGAEvent } from "@next/third-parties/google";

// E-commerce events
export const viewItem = (item: { id: string; name: string; category: string; price: number }) => {
  sendGAEvent("event", "view_item", {
    currency: "USD",
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price }],
  });
};

export const addToCart = (item: { id: string; name: string; category: string; price: number; quantity: number }) => {
  sendGAEvent("event", "add_to_cart", {
    currency: "USD",
    value: item.price * item.quantity,
    items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price, quantity: item.quantity }],
  });
};

export const removeFromCart = (item: { id: string; name: string; price: number }) => {
  sendGAEvent("event", "remove_from_cart", {
    currency: "USD",
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
};

export const beginCheckout = (value: number, items: { id: string; name: string; price: number; quantity: number }[]) => {
  sendGAEvent("event", "begin_checkout", {
    currency: "USD",
    value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
};

export const purchase = (transactionId: string, value: number, items: { id: string; name: string; price: number; quantity: number }[]) => {
  sendGAEvent("event", "purchase", {
    transaction_id: transactionId,
    currency: "USD",
    value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
};

export const promoCodeApplied = (code: string) => {
  sendGAEvent("event", "promo_code_applied", {
    event_category: "engagement",
    event_label: code,
  });
};
