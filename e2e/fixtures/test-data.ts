export const PASSCODE = "1379";

export const STORAGE_KEYS = {
  passcode: "mammas-place-passcode-unlocked",
  auth: "mammas-place-auth",
  adminAuth: "mammas-place-admin-auth",
  cart: "mammas-place-cart",
};

export const STAFF_CREDENTIALS = {
  manager: { username: "manager", password: "manager", role: "manager", name: "Store Manager" },
  agent1: { username: "agent1", password: "agent1", role: "agent", name: "Sales Agent 1" },
  agent2: { username: "agent2", password: "agent2", role: "agent", name: "Sales Agent 2" },
};

export const ADMIN_CREDENTIALS = { username: "admin", password: "admin" };

export const PROMO_CODES: Record<string, number> = {
  MAMMA10: 10,
  PRINCESS20: 20,
  UNICORN15: 15,
  PONY25: 25,
  SAVE30: 30,
};

export const PRODUCTS = {
  regular: { id: "pony-001", name: "Rainbow Sparkle Pony", price: 24.99, category: "toys-and-games" },
  sale: { id: "pony-001", name: "Rainbow Sparkle Pony" },
  outOfStock: { id: "princess-002" },
};

export const TEST_CHECKOUT_FORM = {
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  address: "123 Test Street",
  city: "Testville",
  state: "UT",
  zip: "84101",
  cardName: "Test User",
  cardNumber: "4111 1111 1111 1111",
  expiry: "12/30",
  cvv: "123",
};
