'use client';

import { useEffect } from 'react';

/**
 * Next.js Global Page Error Boundary
 * Beklenmeyen bir JavaScript / hidrasyon hatası durumunda çökme ekranı yerine
 * kullanıcı dostu, otomatik kurtarma / yenileme sağlayan modern hata arayüzü.
 */
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('İstemci Çalışma Zamanı Hatası (Client-side Exception):', error);
  }, [error]);

  const handleFullReset = () => {
    try {
      // Bozuk veya uyumsuz eski önbelleği temizle
      sessionStorage.clear();
      localStorage.removeItem('sd_dismissed_banner');
    } catch (e) {}

    if (typeof reset === 'function') {
      try {
        reset();
        return;
      } catch (e) {}
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 font-sans text-stone-800 selection:bg-brand-500 selection:text-white">
      <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 text-center space-y-5">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner border border-amber-200/60">
          <i className="fa-solid fa-rotate-right"></i>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Sayfa Yenileniyor
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Tarayıcınızdaki eski önbellek veya geçici bağlantı nedeniyle sayfa yüklenemedi. Aşağıdaki butona tıklayarak hemen yeniden başlatabilirsiniz.
          </p>
        </div>

        {error?.message && (
          <div className="text-[11px] bg-stone-50 text-stone-600 p-3 rounded-xl border border-stone-200 text-left font-mono break-all max-h-24 overflow-y-auto">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleFullReset}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-5 rounded-2xl text-sm transition-all duration-200 cursor-pointer shadow-lg shadow-brand-500/25 active:scale-98 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-arrows-rotate text-xs"></i>
            <span>Sayfayı Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors cursor-pointer"
          >
            Ana Sayfa
          </button>
        </div>
      </div>
    </div>
  );
}

