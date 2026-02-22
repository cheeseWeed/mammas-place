'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="text-white mt-12 py-12 px-4" style={{background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 50%, #2d0550 100%)'}}>
      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand section */}
          <div className="text-center md:text-left">
            <div className="text-2xl font-black mb-2">Mamma&apos;s Place</div>
            <p className="text-purple-300 text-sm mb-4">Whatever you want, we got it</p>
            <div className="flex justify-center md:justify-start gap-3">
              <a href="#" aria-label="Facebook" className="w-8 h-8 rounded-full bg-purple-700 hover:bg-purple-600 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="w-8 h-8 rounded-full bg-purple-700 hover:bg-purple-600 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="#" aria-label="Pinterest" className="w-8 h-8 rounded-full bg-purple-700 hover:bg-purple-600 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Customer Service */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold mb-4 text-yellow-300">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="text-purple-300 hover:text-yellow-300 transition-colors">Contact Us</Link></li>
              <li><Link href="/faq" className="text-purple-300 hover:text-yellow-300 transition-colors">FAQ</Link></li>
              <li><Link href="/shipping" className="text-purple-300 hover:text-yellow-300 transition-colors">Shipping & Returns</Link></li>
              <li><Link href="/about" className="text-purple-300 hover:text-yellow-300 transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Shop */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold mb-4 text-yellow-300">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop?category=automotive" className="text-purple-300 hover:text-yellow-300 transition-colors">Automotive</Link></li>
              <li><Link href="/shop?category=grocery" className="text-purple-300 hover:text-yellow-300 transition-colors">Grocery</Link></li>
              <li><Link href="/shop?category=tools-and-hardware" className="text-purple-300 hover:text-yellow-300 transition-colors">Tools & Hardware</Link></li>
              <li><Link href="/shop?sale=true" className="text-purple-300 hover:text-yellow-300 transition-colors">Sale Items</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold mb-4 text-yellow-300">Get in Touch</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-center md:justify-start gap-2">
                <svg className="w-4 h-4 text-yellow-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:support@mammasplace.com" className="text-purple-300 hover:text-yellow-300 transition-colors break-all">
                  support@mammasplace.com
                </a>
              </li>
              <li className="flex items-center justify-center md:justify-start gap-2">
                <svg className="w-4 h-4 text-yellow-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:1-800-626-6271" className="text-purple-300 hover:text-yellow-300 transition-colors">
                  1-800-MAMMAS-1<br />
                  <span className="text-sm">(1-800-626-6271)</span>
                </a>
              </li>
              <li className="flex items-center justify-center md:justify-start gap-2">
                <svg className="w-4 h-4 text-yellow-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-purple-300">
                  Mon-Fri: 9am-5pm EST
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-purple-700 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-purple-300">
            <div className="text-center sm:text-left">
              &copy; 2026 Mamma&apos;s Place. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="bg-purple-700/50 px-3 py-1 rounded-full">Free Shipping Over $50</span>
              <span className="bg-yellow-400/20 text-yellow-300 px-3 py-1 rounded-full font-bold">Use Code: MAMMA10</span>
            </div>
            <Link href="/admin/upload" className="text-purple-500 hover:text-purple-400 text-sm transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
