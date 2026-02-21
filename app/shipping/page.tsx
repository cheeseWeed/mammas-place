import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping & Returns - Mamma\'s Place',
  description: 'Learn about our shipping options, delivery times, and hassle-free return policy',
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-purple-900 mb-4">
            Shipping & Returns
          </h1>
          <p className="text-lg text-purple-600 max-w-2xl mx-auto">
            Fast, reliable shipping and hassle-free returns. Your satisfaction is our priority!
          </p>
        </div>

        {/* Free Shipping Banner */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-2xl p-6 mb-8 text-center shadow-xl border-2 border-yellow-500">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-8 h-8 text-purple-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl md:text-3xl font-black text-purple-900">FREE SHIPPING</h2>
          </div>
          <p className="text-purple-900 font-bold text-lg">On all orders over $50!</p>
          <p className="text-purple-700 text-sm mt-1">Continental US only</p>
        </div>

        {/* Shipping Information */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <h2 className="text-2xl font-bold text-purple-900 mb-6 pb-3 border-b-2 border-purple-200">
            Shipping Information
          </h2>

          <div className="space-y-6">
            {/* Shipping Options Table */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-4">Shipping Options & Rates</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-2 border-purple-200 rounded-lg">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-purple-900">Method</th>
                      <th className="px-4 py-3 text-left font-bold text-purple-900">Delivery Time</th>
                      <th className="px-4 py-3 text-left font-bold text-purple-900">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-200">
                    <tr className="hover:bg-purple-50">
                      <td className="px-4 py-3 font-medium">Standard Shipping</td>
                      <td className="px-4 py-3">5-7 business days</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-green-600">FREE</span> over $50
                        <br />
                        <span className="text-sm text-gray-600">$5.99 under $50</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-purple-50">
                      <td className="px-4 py-3 font-medium">Expedited Shipping</td>
                      <td className="px-4 py-3">2-3 business days</td>
                      <td className="px-4 py-3 font-bold">$12.99</td>
                    </tr>
                    <tr className="hover:bg-purple-50">
                      <td className="px-4 py-3 font-medium">Overnight Shipping</td>
                      <td className="px-4 py-3">1 business day</td>
                      <td className="px-4 py-3 font-bold">$24.99</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Processing Time */}
            <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded">
              <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Processing Time
              </h3>
              <p className="text-gray-700">
                All orders are processed within 1-2 business days. Orders are not shipped or delivered on weekends or holidays. If we experience a high volume of orders, shipments may be delayed by a few days.
              </p>
            </div>

            {/* Tracking */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">Order Tracking</h3>
              <p className="text-gray-700 mb-3">
                Once your order has shipped, you will receive a confirmation email with a tracking number. You can track your package in real-time through the carrier&apos;s website.
              </p>
              <a href="/portal" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Track Your Order
              </a>
            </div>

            {/* Shipping Restrictions */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">Shipping Restrictions</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>We currently only ship to addresses within the continental United States</li>
                <li>We do not ship to P.O. Boxes for expedited or overnight shipping</li>
                <li>APO/FPO addresses are shipped via standard shipping only</li>
                <li>Some items may have shipping restrictions based on size or weight</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Returns & Exchanges */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
          <h2 className="text-2xl font-bold text-purple-900 mb-6 pb-3 border-b-2 border-purple-200">
            Returns & Exchanges
          </h2>

          <div className="space-y-6">
            {/* 30-Day Policy */}
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-2xl font-bold text-green-900">30-Day Money-Back Guarantee</h3>
              </div>
              <p className="text-green-800">We want you to be completely satisfied with your purchase!</p>
            </div>

            {/* Return Policy */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">Return Policy</h3>
              <p className="text-gray-700 mb-4">
                You may return most items within 30 days of delivery for a full refund. To be eligible for a return:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>Items must be unused and in their original packaging</li>
                <li>Items must be in resellable condition</li>
                <li>Return must be initiated within 30 days of delivery</li>
                <li>Original receipt or proof of purchase required</li>
              </ul>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-gray-700">
                  <strong className="text-yellow-800">Note:</strong> Some items cannot be returned for hygiene reasons, including opened audiobooks, opened games with small pieces, and personalized items.
                </p>
              </div>
            </div>

            {/* How to Return */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">How to Start a Return</h3>
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li className="pl-2">
                  <strong>Contact Us:</strong> Email us at <a href="mailto:support@mammasplace.com" className="text-purple-600 hover:text-purple-900 underline">support@mammasplace.com</a> or call <a href="tel:1-800-626-6271" className="text-purple-600 hover:text-purple-900 underline">1-800-MAMMAS-1</a> with your order number
                </li>
                <li className="pl-2">
                  <strong>Receive Label:</strong> We&apos;ll email you a prepaid return shipping label within 24 hours
                </li>
                <li className="pl-2">
                  <strong>Pack & Ship:</strong> Securely pack the item(s) in the original packaging and attach the label
                </li>
                <li className="pl-2">
                  <strong>Get Refund:</strong> Once we receive your return, we&apos;ll process your refund within 3-5 business days
                </li>
              </ol>
            </div>

            {/* Return Shipping */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Free Return Shipping If:
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Item is defective or damaged</li>
                  <li>• We sent the wrong item</li>
                  <li>• Item arrived not as described</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  $5.99 Return Shipping If:
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Changed your mind</li>
                  <li>• Ordered wrong size/color</li>
                  <li>• No longer needed</li>
                </ul>
              </div>
            </div>

            {/* Exchanges */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">Exchanges</h3>
              <p className="text-gray-700 mb-3">
                Need a different size, color, or item? We&apos;re happy to help! When contacting us about your return, just let us know what you&apos;d like instead, and we&apos;ll process the exchange.
              </p>
              <p className="text-gray-700">
                Exchanges are processed as quickly as possible. Once we receive your return, we&apos;ll ship out the replacement item immediately.
              </p>
            </div>

            {/* Refund Timeline */}
            <div>
              <h3 className="text-xl font-bold text-purple-900 mb-3">Refund Timeline</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-purple-600 flex-shrink-0">3-5 days:</span>
                    <span>After we receive your return, refund is processed</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-bold text-purple-600 flex-shrink-0">5-10 days:</span>
                    <span>Your bank posts the credit to your account</span>
                  </li>
                </ul>
                <p className="text-sm text-gray-600 mt-3">
                  Refunds are issued to the original payment method. You&apos;ll receive an email confirmation when your refund is processed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-8 text-center text-white shadow-xl">
          <h2 className="text-2xl font-bold mb-3">Questions About Shipping or Returns?</h2>
          <p className="text-purple-200 mb-6">Our customer service team is here to help!</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:support@mammasplace.com" className="bg-white text-purple-900 font-bold px-8 py-3 rounded-full hover:bg-yellow-300 transition-colors">
              Email Us
            </a>
            <a href="tel:1-800-626-6271" className="bg-yellow-400 text-purple-900 font-bold px-8 py-3 rounded-full hover:bg-yellow-300 transition-colors">
              Call 1-800-MAMMAS-1
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
