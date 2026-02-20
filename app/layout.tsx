import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mamma's Place - Magical Toys & Gifts",
  description: "Shop ponies, unicorns, and princess toys at Mamma's Place!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-purple-50 min-h-screen`}
      >
        <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Header />
            <main className="pt-[128px] sm:pt-[104px]">
              {children}
            </main>
            <footer className="text-white mt-12 py-8 px-4" style={{background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 50%, #2d0550 100%)'}}>
              <div className="max-w-7xl mx-auto text-center">
                <div className="text-2xl font-black mb-1">Mamma&apos;s Place</div>
                <p className="text-purple-300 text-sm">Magical toys for magical kids</p>
                <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-purple-300">
                  <span>© 2026 Mamma&apos;s Place</span>
                  <span className="hidden sm:inline">|</span>
                  <span>Free shipping over $50</span>
                  <span className="hidden sm:inline">|</span>
                  <span>Use code MAMMA10 for 10% off</span>
                  <span className="hidden sm:inline">|</span>
                  <Link href="/admin/upload" className="text-purple-500 hover:text-purple-300 text-xs">Admin</Link>
                </div>
              </div>
            </footer>
          </ToastProvider>
        </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
