'use client';

import { useState, useEffect } from 'react';

interface ServiceAd {
  icon: string;
  service: string;
  tagline: string;
  color: string;
}

const services: ServiceAd[] = [
  {
    icon: '🏹',
    service: 'Archery Supplies',
    tagline: 'Bullseye deals on bows & arrows!',
    color: 'from-green-400 to-blue-500'
  },
  {
    icon: '🚗',
    service: 'New Tires',
    tagline: 'Roll into savings!',
    color: 'from-gray-700 to-gray-900'
  },
  {
    icon: '👟',
    service: 'Shoes',
    tagline: 'Step up your style!',
    color: 'from-pink-400 to-rose-500'
  },
  {
    icon: '🌱',
    service: 'Lawn Care',
    tagline: "We'll mow so you don't have to!",
    color: 'from-lime-400 to-green-600'
  },
  {
    icon: '🚲',
    service: 'Bike Repair',
    tagline: 'Get rolling again!',
    color: 'from-orange-400 to-red-500'
  },
  {
    icon: '🔧',
    service: 'Toy Assembly',
    tagline: 'We build, you play!',
    color: 'from-yellow-400 to-orange-500'
  },
  {
    icon: '🎉',
    service: 'Party Planning',
    tagline: 'Make it magical!',
    color: 'from-purple-400 to-pink-500'
  },
  {
    icon: '📚',
    service: 'Tutoring',
    tagline: 'Homework help for clever kids!',
    color: 'from-blue-400 to-indigo-600'
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

  const currentAd = services[currentIndex];

  return (
    <div className="hidden lg:block w-[300px] shrink-0">
      <div className="sticky top-[110px] space-y-4">
        {/* FEATURED: Free Audiobooks Card */}
        <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 rounded-2xl p-8 shadow-2xl text-purple-900 border-4 border-yellow-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-purple-900 text-yellow-400 px-3 py-1 rounded-bl-xl text-xs font-black">
            FEATURED
          </div>
          <div className="text-6xl mb-4 text-center animate-pulse">🎧</div>
          <h3 className="text-2xl font-black text-center mb-2 leading-tight">
            FREE Premium Audiobooks
          </h3>
          <p className="text-center text-sm font-bold mb-4 text-purple-800">
            Download now - no purchase required!
          </p>
          <a
            href="/shop?category=audiobooks"
            className="block w-full bg-purple-900 hover:bg-purple-800 text-yellow-400 font-black py-3 px-4 rounded-xl transition-all hover:scale-105 text-center shadow-lg"
          >
            Browse Free Audiobooks →
          </a>
        </div>

        {/* Rotating Ad */}
        <div
          className={`bg-gradient-to-br ${currentAd.color} rounded-2xl p-6 shadow-lg text-white transition-opacity duration-300 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="text-5xl mb-3 text-center">{currentAd.icon}</div>
          <h3 className="text-xl font-black text-center mb-2">{currentAd.service}</h3>
          <p className="text-center text-sm opacity-90">{currentAd.tagline}</p>
          <button className="w-full mt-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-2 px-4 rounded-xl transition-all hover:scale-105">
            Learn More
          </button>
        </div>

        {/* Static "All Services" Card */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-lg text-white">
          <h3 className="text-lg font-black mb-3 text-center">Mamma's Services</h3>
          <div className="space-y-2">
            {services.slice(0, 4).map((service, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-xl">{service.icon}</span>
                <span className="font-semibold">{service.service}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-bold py-2 px-4 rounded-xl transition-all hover:scale-105">
            View All Services
          </button>
        </div>

        {/* Promo Card */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 shadow-lg text-purple-900">
          <div className="text-3xl mb-2 text-center">🎁</div>
          <h3 className="text-lg font-black text-center mb-2">Special Offer!</h3>
          <p className="text-center text-sm font-semibold">
            Get 15% off your first service booking!
          </p>
          <div className="mt-3 text-center">
            <span className="inline-block bg-purple-900 text-yellow-400 font-black px-3 py-1 rounded-full text-xs">
              CODE: FIRST15
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
