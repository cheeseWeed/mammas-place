// Root layout — wraps every page with providers, analytics, and the global shell
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { LearnerProvider } from "@/context/LearnerContext";
import { PasscodeProvider } from "@/context/PasscodeContext";
import PasscodeGate from "@/components/PasscodeGate";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mammas-place.vercel.app'),
  title: {
    default: "Mamma's Place - Learning & Family Shop",
    template: "%s | Mamma's Place",
  },
  description:
    "Learning hub and family shop — geography, spelling, math, language arts, chess, driver study, and more, all in one place.",
  openGraph: {
    title: "Mamma's Place - Learning & Family Shop",
    description:
      "Learning hub and family shop — geography, spelling, math, language arts, chess, driver study, and more, all in one place.",
    type: 'website',
    locale: 'en_US',
    siteName: "Mamma's Place",
    url: 'https://mammas-place.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Mamma's Place - Learning & Family Shop",
    description:
      "Learning hub and family shop — geography, spelling, math, language arts, chess, driver study, and more, all in one place.",
  },
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
        {/* Provider stack: passcode gate → staff auth → cart → toasts.
            (Admin auth removed — the merged admin is parent-PIN-gated server-side.) */}
        <PasscodeProvider>
        <PasscodeGate>
        <AuthProvider>
        <LearnerProvider>
        <CartProvider>
          <ToastProvider>
            <ImpersonationBanner />
            <Header />
            <main className="pt-[218px] sm:pt-[142px] print:pt-0">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </CartProvider>
        </LearnerProvider>
        </AuthProvider>
        </PasscodeGate>
        </PasscodeProvider>
        {/* Analytics — placed outside providers so they load even if passcode is locked */}
        <GoogleAnalytics gaId="G-VP0PHD3ZTL" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
