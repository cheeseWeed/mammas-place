import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mamma's Place - Amazing Toys & Gifts for Every Kid",
  description: "Shop toys for adventure, imagination, and discovery at Mamma's Place! Featuring games, archery, rock collections, and more.",
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
        <AdminAuthProvider>
        <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Header />
            <main className="pt-[128px] sm:pt-[104px]">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </CartProvider>
        </AuthProvider>
        </AdminAuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
