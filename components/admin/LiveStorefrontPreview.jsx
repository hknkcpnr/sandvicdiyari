'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import TopBar from '@/components/TopBar';
import HomePage from '@/components/pages/HomePage';
import HikayePage from '@/components/pages/HikayePage';
import IletisimPage from '@/components/pages/IletisimPage';
import {
  getBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';

const VIRTUAL_WIDTH = 1280;

function ScaledViewport({ children, className = '' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [scaledHeight, setScaledHeight] = useState(320);

  useEffect(() => {
    const outerEl = outerRef.current;
    const innerEl = innerRef.current;
    if (!outerEl || !innerEl || typeof ResizeObserver === 'undefined') return;

    const updateMetrics = () => {
      const containerWidth = outerEl.clientWidth || 600;
      const nextScale = Math.min(1, Math.max(0.25, containerWidth / VIRTUAL_WIDTH));
      const contentHeight = innerEl.scrollHeight || innerEl.offsetHeight || 400;
      setScale(nextScale);
      setScaledHeight(Math.max(120, Math.ceil(contentHeight * nextScale)));
    };

    updateMetrics();
    const ro = new ResizeObserver(updateMetrics);
    ro.observe(outerEl);
    ro.observe(innerEl);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className={`w-full overflow-x-hidden ${className}`}>
      <div className="relative w-full" style={{ height: `${scaledHeight}px` }}>
        <div
          ref={innerRef}
          className="origin-top-left bg-stone-50 text-stone-900"
          style={{
            width: `${VIRTUAL_WIDTH}px`,
            transform: `scale(${scale})`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LiveStorefrontPreview({
  content,
  activeSubTab,
  isCurrentVisible = true
}) {
  const reduxProducts = useSelector((state) => state.product?.items);
  const reduxReviews = useSelector((state) => state.ui?.reviews);

  const [liveProducts, setLiveProducts] = useState(() =>
    Array.isArray(reduxProducts) && reduxProducts.length > 0 ? reduxProducts : []
  );
  const [liveReviews, setLiveReviews] = useState(() =>
    Array.isArray(reduxReviews) && reduxReviews.length > 0 ? reduxReviews : []
  );
  const [viewScope, setViewScope] = useState('section'); // 'section' | 'full'
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (Array.isArray(reduxProducts) && reduxProducts.length > 0) {
      setLiveProducts(reduxProducts);
    } else {
      const cachedProd = getBrowserCache('products_all');
      if (cachedProd?.data && Array.isArray(cachedProd.data) && cachedProd.data.length > 0) {
        setLiveProducts(cachedProd.data);
      }
      if (!cachedProd?.data || isBrowserCacheStale('products_all', CACHE_TTL_LONG)) {
        fetchWithBrowserCache('products_all', '/api/products', {
          maxAgeMs: CACHE_TTL_LONG,
          persist: true,
          extract: (res) => res.data
        })
          .then((res) => {
            if (res.ok && Array.isArray(res.data)) {
              setLiveProducts(res.data);
            }
          })
          .catch(() => {});
      }
    }

    if (Array.isArray(reduxReviews) && reduxReviews.length > 0) {
      setLiveReviews(reduxReviews);
    } else {
      const cachedRev = getBrowserCache('reviews_approved');
      if (cachedRev?.data && Array.isArray(cachedRev.data) && cachedRev.data.length > 0) {
        setLiveReviews(cachedRev.data);
      }
      if (!cachedRev?.data || isBrowserCacheStale('reviews_approved', CACHE_TTL_LONG)) {
        fetchWithBrowserCache('reviews_approved', '/api/reviews', {
          maxAgeMs: CACHE_TTL_LONG,
          persist: true,
          extract: (res) => res.data
        })
          .then((res) => {
            if (res.ok && Array.isArray(res.data)) {
              setLiveReviews(res.data);
            }
          })
          .catch(() => {});
      }
    }
  }, [reduxProducts, reduxReviews]);

  const renderStorefront = () => {
    if (viewScope === 'full') {
      return (
        <div className="bg-stone-50">
          <TopBar previewContact={content?.contactBar} />
          <HomePage
            previewContent={content}
            previewProducts={liveProducts}
            previewReviews={liveReviews}
          />
        </div>
      );
    }

    if (activeSubTab === 'story') {
      return <HikayePage previewStory={content?.storySection} />;
    }

    if (activeSubTab === 'contact') {
      return (
        <div className="bg-stone-900">
          <TopBar previewContact={content?.contactBar} />
          <IletisimPage previewContact={content?.contactBar} previewCardsOnly={true} />
        </div>
      );
    }

    return (
      <div className="bg-stone-50">
        {activeSubTab === 'hero' && <TopBar previewContact={content?.contactBar} />}
        <HomePage
          previewContent={content}
          previewSection={activeSubTab}
          previewProducts={liveProducts}
          previewReviews={liveReviews}
        />
      </div>
    );
  };

  const renderFrame = (fullscreen = false) => (
    <div
      className={`bg-stone-900 text-white rounded-3xl p-3.5 shadow-xl border border-stone-800 space-y-2.5 flex flex-col ${
        fullscreen ? 'h-full' : ''
      }`}
    >
      {/* Üst Tarayıcı / Önizleme Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-center gap-1.5 bg-stone-800/90 px-2.5 py-1 rounded-full text-[10px] font-mono text-stone-300 truncate">
            <i className="fa-solid fa-lock text-[8px] text-emerald-400"></i>
            <span className="truncate">sandvicdiyari.com</span>
            <span className="text-[9px] font-sans font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded">
              1:1 Canlı
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex bg-stone-800 p-0.5 rounded-lg text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setViewScope('section')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'section'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Aktif Bölüm
            </button>
            <button
              type="button"
              onClick={() => setViewScope('full')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'full'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Tüm Ana Sayfa
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen(!fullscreen)}
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            title={fullscreen ? 'Tam Ekranı Kapat' : '1:1 Büyük Ekranda Gör'}
          >
            <i className={`fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'} text-[10px]`}></i>
            <span>{fullscreen ? 'Küçült' : 'Büyüt'}</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-[10px] font-bold transition-colors flex items-center gap-1"
            title="Gerçek Müşteri Sitesini Yeni Sekmede Aç"
          >
            <span>Siteyi Aç</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
        </div>
      </div>

      {/* Bölüm Gizli Uyarısı */}
      {viewScope === 'section' && !isCurrentVisible && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-200 px-3 py-2 rounded-xl text-center text-[11px] font-semibold shrink-0">
          <i className="fa-solid fa-eye-slash mr-1.5 text-rose-400"></i>
          Bu bölüm şu an sitede gizlidir; müşteriler görmez (aşağıda taslak görünümü yer alır).
        </div>
      )}

      {/* Gerçek 1280px Ölçeklenmiş Müşteri Sayfası Kanvası */}
      <div
        className={`rounded-2xl overflow-hidden border border-stone-700/80 bg-stone-50 ${
          viewScope === 'section' && !isCurrentVisible ? 'opacity-60' : ''
        } ${fullscreen ? 'flex-1 overflow-y-auto' : 'max-h-[75vh] overflow-y-auto'}`}
      >
        <ScaledViewport>{renderStorefront()}</ScaledViewport>
      </div>

      <div className="flex items-center justify-between text-[10px] text-stone-400 px-1 shrink-0">
        <span>
          <i className="fa-solid fa-display text-amber-400 mr-1"></i>
          Gerçek müşteri bileşenleri ve canlı veritabanı ürünleriyle birebir önizleme (1280px ölçekli)
        </span>
        <span className="hidden sm:inline text-stone-500">
          {liveProducts.length} ürün yüklü
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="xl:col-span-6 sticky top-4 space-y-3">
        {renderFrame(false)}
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFullscreen(false);
          }}
        >
          <div className="w-full max-w-[1340px] h-[92vh]">
            {renderFrame(true)}
          </div>
        </div>
      )}
    </>
  );
}
