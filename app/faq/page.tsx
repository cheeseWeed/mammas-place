import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions - Mamma\'s Place',
  description: 'Common questions about shipping, returns, payments, and more at Mamma\'s Place',
};

export default function FAQPage() {
  const faqs = [
    {
      category: 'Shipping',
      questions: [
        {
          q: 'Do you offer free shipping?',
          a: 'Yes! We offer FREE standard shipping on all orders over $50 within the continental United States. Orders under $50 have a flat shipping rate of $5.99.',
        },
        {
          q: 'How long does shipping take?',
          a: 'Standard shipping typically takes 5-7 business days. Expedited shipping (2-3 business days) is available for $12.99, and overnight shipping is available for $24.99. Processing time is 1-2 business days before shipment.',
        },
        {
          q: 'Do you ship internationally?',
          a: 'Currently, we only ship to addresses within the United States. We hope to expand internationally in the future!',
        },
        {
          q: 'How can I track my order?',
          a: 'Once your order ships, you\'ll receive a confirmation email with a tracking number. You can use this number to track your package on the carrier\'s website. You can also check your order status in your account dashboard.',
        },
      ],
    },
    {
      category: 'Returns & Exchanges',
      questions: [
        {
          q: 'What is your return policy?',
          a: 'We want you to be completely satisfied! You can return most items within 30 days of delivery for a full refund. Items must be unused, in original packaging, and in resellable condition. Some items (audiobooks, opened games) may not be returnable for hygiene reasons.',
        },
        {
          q: 'How do I start a return?',
          a: 'Contact our customer service team at support@mammasplace.com or call 1-800-MAMMAS-1. We\'ll send you a return label and instructions. Return shipping is free for defective items; otherwise, $5.99 is deducted from your refund.',
        },
        {
          q: 'Can I exchange an item?',
          a: 'Absolutely! If you\'d like to exchange an item for a different size, color, or product, just let us know when you contact us about your return. We\'ll process the exchange as quickly as possible.',
        },
        {
          q: 'How long do refunds take?',
          a: 'Once we receive your return, refunds are processed within 3-5 business days. The refund will be credited to your original payment method. Please allow your bank 5-10 business days to post the credit.',
        },
      ],
    },
    {
      category: 'Payments & Pricing',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit cards (Visa, MasterCard, American Express, Discover), PayPal, Apple Pay, and Google Pay. All payments are processed securely through Stripe.',
        },
        {
          q: 'Do you offer discounts or promotions?',
          a: 'Yes! Use code MAMMA10 for 10% off your first order. We also run seasonal sales and special promotions. Sign up for our newsletter to be the first to know about deals!',
        },
        {
          q: 'Can I use multiple discount codes?',
          a: 'Unfortunately, only one discount code can be applied per order. We automatically apply the code that gives you the best savings.',
        },
        {
          q: 'Do you price match?',
          a: 'We strive to offer the best prices! If you find an identical item at a lower price from an authorized retailer, contact us within 7 days of purchase, and we\'ll refund the difference.',
        },
      ],
    },
    {
      category: 'Products & Safety',
      questions: [
        {
          q: 'What age groups are your toys suitable for?',
          a: 'Each product listing includes recommended age ranges. Most of our toys are designed for children ages 3 and up. Items with small parts are clearly marked and include choking hazard warnings for children under 3.',
        },
        {
          q: 'Are your products safe?',
          a: 'Absolutely! All our toys meet or exceed US safety standards and are tested for safety. We only carry products from reputable manufacturers who comply with CPSC regulations and ASTM toy safety standards.',
        },
        {
          q: 'Do you offer gift wrapping?',
          a: 'Yes! For just $4.99 per item, we\'ll gift wrap your purchase in beautiful paper with a ribbon and include a personalized gift message. Select this option at checkout.',
        },
        {
          q: 'Can I include a gift receipt?',
          a: 'Of course! During checkout, you can choose to include a gift receipt (which doesn\'t show prices) instead of a regular receipt. Perfect for sending gifts directly to the recipient!',
        },
      ],
    },
    {
      category: 'Account & Orders',
      questions: [
        {
          q: 'Do I need an account to order?',
          a: 'No, you can check out as a guest. However, creating an account lets you track orders, save shipping addresses, view order history, and check out faster on future orders.',
        },
        {
          q: 'Can I modify or cancel my order?',
          a: 'Orders can be modified or cancelled within 2 hours of placement. After that, orders enter processing and cannot be changed. Contact us immediately at support@mammasplace.com if you need to make changes.',
        },
        {
          q: 'What if I receive a damaged item?',
          a: 'We\'re so sorry if that happens! Contact us within 48 hours of delivery with photos of the damage. We\'ll send a replacement immediately at no cost to you, and you won\'t need to return the damaged item.',
        },
        {
          q: 'How do I contact customer service?',
          a: 'We\'re here to help! Email us at support@mammasplace.com or call 1-800-MAMMAS-1 (1-800-626-6271). Our hours are Monday-Friday, 9am-5pm EST. We typically respond to emails within 24 hours.',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-purple-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-purple-600 max-w-2xl mx-auto">
            Find answers to common questions about shipping, returns, payments, and more. Can&apos;t find what you&apos;re looking for? Contact us anytime!
          </p>
        </div>

        {/* Quick Contact Card */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 mb-12 text-white shadow-xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="mailto:support@mammasplace.com" className="flex items-center gap-2 bg-white text-purple-900 px-6 py-3 rounded-full font-bold hover:bg-yellow-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Us
              </a>
              <a href="tel:1-800-626-6271" className="flex items-center gap-2 bg-white text-purple-900 px-6 py-3 rounded-full font-bold hover:bg-yellow-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call 1-800-MAMMAS-1
              </a>
            </div>
            <p className="text-purple-200 text-sm mt-3">Mon-Fri: 9am-5pm EST</p>
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-8">
          {faqs.map((section, sectionIdx) => (
            <div key={sectionIdx} className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100">
              <h2 className="text-2xl font-bold text-purple-900 mb-6 pb-3 border-b-2 border-purple-200 flex items-center gap-3">
                <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">
                  {sectionIdx + 1}
                </span>
                {section.category}
              </h2>
              <div className="space-y-6">
                {section.questions.map((item, itemIdx) => (
                  <div key={itemIdx} className="border-l-4 border-purple-300 pl-4 py-2">
                    <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-start gap-2">
                      <span className="text-purple-600 flex-shrink-0">Q:</span>
                      <span>{item.q}</span>
                    </h3>
                    <p className="text-gray-700 leading-relaxed pl-6">
                      <span className="font-bold text-purple-600">A:</span> {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-purple-900 mb-3">Ready to Shop?</h2>
          <p className="text-gray-700 mb-6">Explore our amazing collection of toys and gifts for every kid!</p>
          <a href="/shop" className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-4 rounded-full text-lg transition-colors shadow-lg">
            Browse All Products
          </a>
        </div>
      </div>
    </div>
  );
}
