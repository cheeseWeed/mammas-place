import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us - Mamma\'s Place',
  description: 'Learn about Mamma\'s Place - your one-stop marketplace for everything you need, from automotive to groceries, tools to toys',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-purple-900 mb-4">
            About Mamma&apos;s Place
          </h1>
          <p className="text-lg text-purple-600 max-w-2xl mx-auto">
            Your one-stop marketplace for everything you need
          </p>
        </div>

        {/* Main Story */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <div className="prose max-w-none">
            <h2 className="text-2xl font-bold text-purple-900 mb-4">Our Story</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Welcome to Mamma&apos;s Place, where you can find everything you need under one roof! We&apos;re your friendly neighborhood marketplace that competes with the big-box retailers while keeping that personal touch.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              What started as a small shop has grown into a comprehensive marketplace offering everything from automotive supplies and groceries to home goods, tools, clothing, electronics, and yes - even toys! Whether you need new tires, lawn care supplies, picture frames, or handyman services, we&apos;ve got you covered.
            </p>
            <p className="text-gray-700 leading-relaxed">
              At Mamma&apos;s Place, we believe in the motto: "Whatever you want, we got it." We&apos;re here to compete with Walmart, Costco, and Amazon by offering the same variety with better service, competitive prices, and that Mamma warmth you can&apos;t find anywhere else. Every product we carry is carefully selected for quality and value.
            </p>
          </div>
        </div>

        {/* Our Values */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <h2 className="text-2xl font-bold text-purple-900 mb-6 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="bg-purple-600 rounded-full p-3 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-2">Safety & Standards</h3>
                  <p className="text-gray-700 text-sm">
                    All our products meet or exceed industry safety standards. We only partner with trusted manufacturers and suppliers who prioritize quality and compliance.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="bg-purple-600 rounded-full p-3 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-2">Quality Products</h3>
                  <p className="text-gray-700 text-sm">
                    We hand-pick every item in our store, ensuring it meets our high standards for durability, educational value, and fun.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="bg-purple-600 rounded-full p-3 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-2">Customer Care</h3>
                  <p className="text-gray-700 text-sm">
                    Your satisfaction is our priority. We offer hassle-free returns, responsive customer service, and a shopping experience you can trust.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="bg-purple-600 rounded-full p-3 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-900 mb-2">Complete Selection</h3>
                  <p className="text-gray-700 text-sm">
                    From everyday essentials to specialty items, we stock a comprehensive range of products across all categories to meet your every need.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What We Offer */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <h2 className="text-2xl font-bold text-purple-900 mb-6 text-center">What We Offer</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/shop?category=automotive" className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-6 text-center hover:shadow-lg transition-shadow border border-gray-200 group">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🚗</div>
              <h3 className="font-bold text-purple-900">Automotive</h3>
              <p className="text-xs text-gray-600 mt-1">Tires & supplies</p>
            </a>
            <a href="/shop?category=grocery" className="bg-gradient-to-br from-green-100 to-green-50 rounded-xl p-6 text-center hover:shadow-lg transition-shadow border border-green-200 group">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🛒</div>
              <h3 className="font-bold text-purple-900">Groceries</h3>
              <p className="text-xs text-gray-600 mt-1">Food & essentials</p>
            </a>
            <a href="/shop?category=tools-and-hardware" className="bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl p-6 text-center hover:shadow-lg transition-shadow border border-orange-200 group">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🔧</div>
              <h3 className="font-bold text-purple-900">Tools & Hardware</h3>
              <p className="text-xs text-gray-600 mt-1">Fix & build</p>
            </a>
            <a href="/shop?category=toys-and-games" className="bg-gradient-to-br from-pink-100 to-pink-50 rounded-xl p-6 text-center hover:shadow-lg transition-shadow border border-pink-200 group">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🎮</div>
              <h3 className="font-bold text-purple-900">Toys & Games</h3>
              <p className="text-xs text-gray-600 mt-1">Family fun</p>
            </a>
          </div>
          <div className="text-center mt-6">
            <a href="/shop" className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3 rounded-full transition-colors">
              Explore All Products
            </a>
          </div>
        </div>

        {/* Why Shop With Us */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl shadow-lg p-6 md:p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Shop With Us?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">Free Shipping</h3>
              <p className="text-purple-200 text-sm">On orders over $50</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">Easy Returns</h3>
              <p className="text-purple-200 text-sm">30-day money-back guarantee</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">Customer Support</h3>
              <p className="text-purple-200 text-sm">Mon-Fri: 9am-5pm EST</p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-purple-900 mb-3">Have Questions?</h2>
          <p className="text-gray-700 mb-6">We&apos;re here to help make your shopping experience magical!</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/contact" className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3 rounded-full transition-colors">
              Contact Us
            </a>
            <a href="/faq" className="bg-white hover:bg-gray-50 text-purple-900 font-bold px-8 py-3 rounded-full transition-colors border-2 border-purple-300">
              Read FAQs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
