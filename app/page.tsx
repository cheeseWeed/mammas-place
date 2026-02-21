import Link from 'next/link';
import { getFeaturedProducts, getSaleProducts, getComingSoonProducts } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function HomePage() {
  const featured = getFeaturedProducts();
  const saleItems = getSaleProducts().slice(0, 4);
  const comingSoon = getComingSoonProducts();

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-purple-900 via-purple-700 to-purple-500 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-6xl mb-4">🏹🎮💎</div>
          <h1 className="text-4xl sm:text-6xl font-black mb-4 drop-shadow-lg">
            Welcome to<br />
            <span className="text-yellow-300">Mamma&apos;s Place!</span>
          </h1>
          <p className="text-purple-200 text-lg sm:text-xl mb-8 max-w-2xl mx-auto">
            Amazing toys for every kid. Shop our exciting collection of toys for adventure, imagination, and discovery!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop" className="bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-black text-lg px-8 py-3 rounded-full shadow-lg transition-all hover:scale-105">
              Shop Now
            </Link>
            <Link href="/shop?sale=true" className="border-2 border-white text-white hover:bg-white hover:text-purple-900 font-bold text-lg px-8 py-3 rounded-full transition-all hover:scale-105">
              View Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Category Banners */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-black text-purple-900 mb-6 text-center">Shop by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {[
            { label: 'Ponies', emoji: '🐴', color: 'from-pink-400 to-purple-400', cat: 'ponies' },
            { label: 'Unicorns', emoji: '🦄', color: 'from-purple-400 to-blue-400', cat: 'unicorns' },
            { label: 'Princesses', emoji: '👑', color: 'from-yellow-300 to-pink-400', cat: 'princesses' },
            { label: 'Bow & Arrow', emoji: '🏹', color: 'from-green-500 to-blue-600', cat: 'bow-and-arrow' },
            { label: 'Rock Collections', emoji: '💎', color: 'from-blue-500 to-purple-600', cat: 'rock-collections' },
            { label: 'Games', emoji: '🎮', color: 'from-red-500 to-orange-500', cat: 'games' },
            { label: 'Audiobooks', emoji: '🎧', color: 'from-indigo-500 to-purple-500', cat: 'audiobooks' },
          ].map((c) => (
            <Link
              key={c.cat}
              href={`/shop?category=${c.cat}`}
              className={`bg-gradient-to-br ${c.color} rounded-2xl p-6 text-white text-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300`}
            >
              <div className="text-4xl mb-2">{c.emoji}</div>
              <div className="text-lg font-black">{c.label}</div>
              <div className="text-xs sm:text-sm opacity-80 mt-1">Shop all →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Sale Items */}
      <section className="bg-red-50 border-y border-red-100 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-red-600">🏷️ On Sale Now!</h2>
            <Link href="/shop?sale=true" className="text-purple-700 hover:text-purple-500 font-semibold text-sm">
              View all sales →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {saleItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-purple-900">⭐ Featured Items</h2>
          <Link href="/shop" className="text-purple-700 hover:text-purple-500 font-semibold text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Coming Soon */}
      {comingSoon.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-black text-purple-900">🔜 Coming Soon</h2>
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">Dropping Soon!</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {comingSoon.map((product) => {
              return (
                <div key={product.id} className="bg-white rounded-2xl shadow-md border border-purple-100 overflow-hidden relative">
                  <div className="absolute top-2 right-2 z-10 bg-purple-700 text-white text-xs font-black px-2 py-1 rounded-full">COMING SOON</div>
                  <div className="h-40 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center overflow-hidden opacity-60 blur-[1px]">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-black text-gray-800 text-sm">{product.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{product.shortDescription}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-black text-purple-800">${product.price.toFixed(2)}</span>
                      <button disabled className="text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded-full font-bold cursor-not-allowed">
                        Notify Me
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Promo Codes Banner */}
      <section className="bg-purple-900 text-white py-10 px-4 text-center">
        <h2 className="text-3xl font-black mb-2">Free Shipping on Orders Over $50!</h2>
        <p className="text-purple-300 mb-4">Use promo codes at checkout for extra savings</p>
        <div className="flex flex-wrap justify-center gap-3">
          {['MAMMA10', 'ADVENTURE20', 'DISCOVER15', 'PLAY25', 'SAVE30'].map((code) => (
            <span key={code} className="bg-yellow-400 text-purple-900 font-black px-4 py-2 rounded-full text-sm">
              {code}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
