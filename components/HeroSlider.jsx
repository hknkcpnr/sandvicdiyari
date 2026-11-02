'use client';

import { useState, useEffect } from 'react';
import { heroSlides } from '@/data/initialData';

export default function HeroSlider() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="relative w-full max-w-md aspect-square bg-gradient-to-tr from-brand-500/20 to-brand-600/10 rounded-3xl p-4 border border-brand-500/20 flex items-center justify-center shadow-2xl overflow-visible group">
      {/* Slider Görsel Konteyneri */}
      <div id="hero-slider" className="w-full h-full relative rounded-2xl overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === currentSlideIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover rounded-2xl shadow-lg"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=600';
              }}
            />
          </div>
        ))}
      </div>

      {/* Slider Kontrolleri */}
      <button
        onClick={prevSlide}
        type="button"
        aria-label="Önceki Slayt"
        className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-30 cursor-pointer"
      >
        <i className="fa-solid fa-chevron-left"></i>
      </button>
      <button
        onClick={nextSlide}
        type="button"
        aria-label="Sonraki Slayt"
        className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-30 cursor-pointer"
      >
        <i className="fa-solid fa-chevron-right"></i>
      </button>

      {/* Puan Kartı ve En Çok Tercih Ediliyor Rozeti */}
      <div className="absolute -top-12 -left-4 sm:-left-8 bg-white text-stone-900 p-4 rounded-2xl shadow-2xl border border-stone-100 flex items-center gap-3 z-30">
        <div className="w-10 h-10 bg-brand-500 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md shadow-brand-500/30">
          <i className="fa-solid fa-star"></i>
        </div>
        <div>
          <span className="text-[10px] bg-brand-100 text-brand-800 font-extrabold px-2.5 py-0.5 rounded-full inline-block mb-1">
            En Çok Tercih Ediliyor
          </span>
          <span className="text-xs text-stone-500 block font-medium">Müşteri Puanı</span>
          <span className="text-sm font-bold text-stone-900">4.9 / 5.0 (2,400+ Yorum)</span>
        </div>
      </div>
    </div>
  );
}
