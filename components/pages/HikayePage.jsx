'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_SITE_CONTENT } from '@/lib/siteContentDefaults';

export default function HikayePage() {
  const [story, setStory] = useState(DEFAULT_SITE_CONTENT.storySection);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const fetchStoryContent = async () => {
    try {
      const res = await fetch('/api/site-content', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data?.storySection) {
        setStory({
          ...DEFAULT_SITE_CONTENT.storySection,
          ...json.data.storySection,
          images:
            Array.isArray(json.data.storySection.images) &&
            json.data.storySection.images.length > 0
              ? json.data.storySection.images
              : DEFAULT_SITE_CONTENT.storySection.images,
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchStoryContent();
    const handleStorage = (e) => {
      if (e.key === 'sandwich_site_content_updated') {
        fetchStoryContent();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const slides =
    Array.isArray(story?.images) && story.images.length > 0
      ? story.images
      : DEFAULT_SITE_CONTENT.storySection.images;

  const safeIndex = activeIndex >= slides.length ? 0 : activeIndex;

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  if (story?.visible === false) {
    return null;
  }

  const currentSlide = slides[safeIndex] || slides[0];

  return (
    <div id="page-hikaye" className="page-content animate-in fade-in duration-300">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Sol Sütun: Hikayemiz Metinleri */}
          <div className="space-y-6">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
              {story.badgeText || DEFAULT_SITE_CONTENT.storySection.badgeText}
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
              {story.title || DEFAULT_SITE_CONTENT.storySection.title}
            </h3>
            <p className="text-stone-600 leading-relaxed text-sm">
              {story.description || DEFAULT_SITE_CONTENT.storySection.description}
            </p>
            <div className="bg-brand-50/70 border border-brand-200 rounded-2xl p-4 text-xs text-stone-700 leading-relaxed flex items-start gap-3">
              <i className="fa-solid fa-stamp text-brand-600 text-xl mt-0.5"></i>
              <div>
                <strong className="text-brand-900 block font-bold mb-1">
                  {story.qualityTitle || DEFAULT_SITE_CONTENT.storySection.qualityTitle}
                </strong>
                {story.qualityText || DEFAULT_SITE_CONTENT.storySection.qualityText}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">Gece 03:00</span>
                <span className="text-[11px] text-stone-500 font-medium">Paket Servis</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">VISA / MC</span>
                <span className="text-[11px] text-stone-500 font-medium">Kapıda Kart</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm text-center">
                <span className="text-brand-600 font-extrabold text-xl block">40+ Çeşit</span>
                <span className="text-[11px] text-stone-500 font-medium">Zengin Menü</span>
              </div>
            </div>
          </div>

          {/* Sağ Sütun: İnteraktif Görsel Slider */}
          <div
            className="space-y-3"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-stone-200/80 bg-stone-900 h-[340px] sm:h-[410px] group">
              <img
                key={currentSlide.url}
                src={currentSlide.url}
                alt={currentSlide.caption || 'Sandviç Diyarı'}
                className="w-full h-full object-cover transition-all duration-500"
                onError={(e) => {
                  e.currentTarget.src = '/images/kasap_sucuk_ekmek.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-black/15"></div>

              {/* Sağ Üst: Slayt Sayacı */}
              {slides.length > 1 && (
                <div className="absolute top-3.5 right-3.5 bg-stone-950/70 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/15">
                  {safeIndex + 1} / {slides.length}
                </div>
              )}

              {/* Sol / Sağ Geçiş Okları */}
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    aria-label="Önceki Görsel"
                  >
                    <i className="fa-solid fa-chevron-left text-xs"></i>
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                    aria-label="Sonraki Görsel"
                  >
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                  </button>
                </>
              )}

              {/* Alt Başlık ve Nokta Göstergeleri */}
              <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  {currentSlide.caption && (
                    <span className="inline-block bg-brand-500 text-white text-xs font-extrabold px-3 py-1 rounded-xl shadow-sm truncate max-w-full">
                      {currentSlide.caption}
                    </span>
                  )}
                </div>

                {slides.length > 1 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {slides.map((sl, i) => (
                      <button
                        key={sl.id || i}
                        type="button"
                        onClick={() => setActiveIndex(i)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          i === safeIndex ? 'w-6 bg-brand-400' : 'w-2 bg-white/60 hover:bg-white'
                        }`}
                        aria-label={`Görsel ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alt Küçük Önizleme Şeridi (Thumbnail Strip) */}
            {slides.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {slides.map((sl, i) => (
                  <button
                    key={sl.id || i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      i === safeIndex
                        ? 'border-brand-500 ring-2 ring-brand-500/25 scale-[1.02]'
                        : 'border-stone-200 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={sl.url}
                      alt={sl.caption || `Görsel ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/images/kasap_sucuk_ekmek.jpg';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

