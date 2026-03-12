'use client';

import { useState, useEffect } from 'react';

interface ServiceAd {
  icon: string;
  service: string;
  tagline: string;
  color: string;
  productId?: string;
}

const services: ServiceAd[] = [
  {
    icon: '🌱',
    service: 'Lawn Care',
    tagline: "We'll mow so you don't have to!",
    color: 'from-lime-400 to-green-600',
    productId: 'service-001'
  },
  {
    icon: '🔧',
    service: 'Plumbing',
    tagline: 'Fix leaks and drips fast!',
    color: 'from-blue-400 to-blue-600',
    productId: 'service-002'
  },
  {
    icon: '⚡',
    service: 'Electrician',
    tagline: 'Safe & reliable wiring!',
    color: 'from-yellow-400 to-orange-500',
    productId: 'service-003'
  },
  {
    icon: '🏠',
    service: 'Home Renovation',
    tagline: 'Transform your space!',
    color: 'from-gray-700 to-gray-900',
    productId: 'service-004'
  },
  {
    icon: '🎨',
    service: 'House Painting',
    tagline: 'Fresh colors, fresh start!',
    color: 'from-pink-400 to-rose-500',
    productId: 'service-005'
  },
  {
    icon: '📸',
    service: 'Photo Session',
    tagline: 'Capture precious moments!',
    color: 'from-purple-400 to-pink-500',
    productId: 'service-006'
  },
  {
    icon: '💊',
    service: 'Medical Checkup',
    tagline: 'Your health matters!',
    color: 'from-green-400 to-blue-500',
    productId: 'service-007'
  },
  {
    icon: '🦷',
    service: 'Dental Cleaning',
    tagline: 'Smile bright, feel great!',
    color: 'from-blue-400 to-indigo-600',
    productId: 'service-008'
  }
];

export default function ServiceAds() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % services.length);
        setIsVisible(true);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const goToNext = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % services.length);
      setIsVisible(true);
    }, 300);
  };

  const goToPrev = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + services.length) % services.length);
      setIsVisible(true);
    }, 300);
  };

  const currentAd = services[currentIndex];

  return (
    <div className="hidden lg:block w-[300px] shrink-0">
      <div className="sticky top-[140px] space-y-3 z-10">
        {/* FEATURED: Free Audiobooks Card */}
        <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 rounded-xl p-4 shadow-lg text-purple-900 border-2 border-yellow-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-purple-900 text-yellow-400 px-2 py-0.5 rounded-bl-lg text-xs font-black">
            FEATURED
          </div>
          <div className="text-3xl mb-2 text-center">🎧</div>
          <h3 className="text-base font-black text-center mb-1 leading-tight">
            FREE Premium Audiobooks
          </h3>
          <p className="text-center text-xs font-bold mb-2 text-purple-800">
            Download now - no purchase required!
          </p>
          <a
            href="/shop?category=audiobooks"
            className="block w-full bg-purple-900 hover:bg-purple-800 text-yellow-400 font-black py-2 px-3 rounded-lg transition-all hover:scale-105 text-center shadow-lg text-xs"
          >
            Browse Free Audiobooks →
          </a>
        </div>

        {/* Rotating Ad with Navigation */}
        <div className="relative">
          <div
            className={`bg-gradient-to-br ${currentAd.color} rounded-xl p-4 shadow-lg text-white transition-opacity duration-300 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="text-3xl mb-2 text-center">{currentAd.icon}</div>
            <h3 className="text-base font-black text-center mb-1">{currentAd.service}</h3>
            <p className="text-center text-xs opacity-90">{currentAd.tagline}</p>
            <a
              href={currentAd.productId ? `/product/${currentAd.productId}` : '/shop?category=services'}
              className="block w-full mt-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-1.5 px-3 rounded-lg transition-all hover:scale-105 text-xs text-center"
            >
              Learn More
            </a>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
            aria-label="Previous service"
          >
            ←
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
            aria-label="Next service"
          >
            →
          </button>
        </div>

        {/* View All Services Button */}
        <a
          href="/shop?category=services"
          className="block w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold py-2.5 px-4 rounded-lg transition-all hover:scale-105 text-center shadow-lg text-sm"
        >
          View All Services →
        </a>

        {/* Promo Card */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-3 shadow-lg text-purple-900">
          <div className="text-2xl mb-1 text-center">🎁</div>
          <h3 className="text-sm font-black text-center mb-1">Special Offer!</h3>
          <p className="text-center text-xs font-semibold">
            Get 15% off your first service booking!
          </p>
          <div className="mt-2 text-center">
            <span className="inline-block bg-purple-900 text-yellow-400 font-black px-2.5 py-0.5 rounded-full text-xs">
              CODE: FIRST15
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
