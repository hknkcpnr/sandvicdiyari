'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { openTrackOrderModal } from '@/store/slices/uiSlice';

export default function FloatingTrackOrderButton() {
  const dispatch = useDispatch();
  const { isCartOpen } = useSelector((state) => state.ui || {});
  const [hasActiveLiveOrder, setHasActiveLiveOrder] = useState(false);

  // Canlı sipariş takip çubuğunun açık olup olmadığını kontrol et
  useEffect(() => {
    const checkActiveOrder = () => {
      try {
        const rawLast = localStorage.getItem('sd_last_order');
        if (rawLast) {
          const parsed = JSON.parse(rawLast);
          if (parsed?.id && parsed.status && parsed.status !== 'Teslim Edildi' && parsed.status !== 'İptal Edildi') {
            setHasActiveLiveOrder(true);
            return;
          }
        }
        setHasActiveLiveOrder(false);
      } catch {
        setHasActiveLiveOrder(false);
      }
    };

    checkActiveOrder();
    window.addEventListener('storage', checkActiveOrder);
    window.addEventListener('sd_order_created', checkActiveOrder);
    window.addEventListener('sd_order_updated', checkActiveOrder);

    const interval = setInterval(checkActiveOrder, 3000);

    return () => {
      window.removeEventListener('storage', checkActiveOrder);
      window.removeEventListener('sd_order_created', checkActiveOrder);
      window.removeEventListener('sd_order_updated', checkActiveOrder);
      clearInterval(interval);
    };
  }, []);

  // Sepet çekmecesi açıkken gizle
  if (isCartOpen) return null;

  return (
    <div
      className={`fixed right-3 sm:right-5 z-30 transition-all duration-300 ${
        hasActiveLiveOrder ? 'bottom-22 sm:bottom-24' : 'bottom-4 sm:bottom-5'
      }`}
    >
      <button
        type="button"
        onClick={() => dispatch(openTrackOrderModal())}
        className="group flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-white/95 hover:bg-white text-stone-800 hover:text-amber-900 border border-stone-200/90 hover:border-amber-400/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_35px_rgba(245,158,11,0.22)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer active:scale-95"
        title="Sipariş No ve Telefonunuz ile Anlık Takip Edin"
        aria-label="Sipariş Takibi"
      >
        <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors border border-amber-200/60 shadow-2xs">
          <i className="fa-solid fa-location-crosshairs text-xs sm:text-sm group-hover:rotate-45 transition-transform duration-300"></i>
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        </span>

        <div className="text-left leading-tight pr-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
            Canlı Sorgula
          </span>
          <span className="text-xs sm:text-[13px] font-extrabold text-stone-900 group-hover:text-amber-950 block">
            Sipariş Takibi
          </span>
        </div>
      </button>
    </div>
  );
}
