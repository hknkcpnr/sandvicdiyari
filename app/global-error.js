'use client';

import { useEffect } from 'react';

/**
 * Next.js Global Root Error Boundary
 * Root layout çökmelerinde devreye girer.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Kök Düzen Hatası (Global Root Exception):', error);
  }, [error]);

  const handleReload = () => {
    try {
      sessionStorage.clear();
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
    <html lang="tr">
      <body className="min-h-screen flex items-center justify-center bg-stone-50 p-4 font-sans text-stone-800">
        <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner border border-amber-200/60">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Sandviç Diyarı
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              Sayfa yüklenirken geçici bir kesinti oluştu. Lütfen sayfayı yenileyiniz.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-5 rounded-2xl text-sm transition-all duration-200 cursor-pointer shadow-lg shadow-brand-500/25 active:scale-98"
          >
            Sayfayı Yenile
          </button>
        </div>
      </body>
    </html>
  );
}

