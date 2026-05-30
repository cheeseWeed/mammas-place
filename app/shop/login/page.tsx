// Shop-side login page — name + 4-digit PIN unlocks MP Money store credit.
// Uses the same /api/drive/* auth endpoints as /drive (one login, two worlds).

import ShopLoginForm from '@/components/ShopLoginForm';

export const metadata = {
  title: "Log in — Mamma's Place",
  description: 'Log in to see your MP Money balance and shop.',
};

export default function ShopLoginPage() {
  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-purple-900 mb-2">MP Money</h1>
          <p className="text-sm text-gray-700">
            MP Money is your closed-loop store credit — log in to see your
            balance and shop.
          </p>
        </div>
        <ShopLoginForm />
      </div>
    </div>
  );
}
