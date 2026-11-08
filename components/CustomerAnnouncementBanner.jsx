'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setActivePage } from '@/store/slices/uiSlice';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';

export const BANNER_THEMES = {
  campaign: {
    gradient:
      'radial-gradient(circle at 14% 50%, rgba(251, 191, 36, 0.22), transparent 48%), linear-gradient(90deg, #6b0f2b 0%, #991b1b 26%, #c2410c 60%, #b45309 86%, #78350f 100%)',
    borderClass: 'border-b border-amber-300/35',
    iconBox:
      'bg-gradient-to-br from-amber-300 to-amber-400 text-red-950 ring-2 ring-white/30 shadow-md',
    titlePill: 'bg-white text-red-900 shadow-sm',
    btn: 'bg-amber-300 hover:bg-amber-200 text-stone-950 ring-1 ring-amber-100/70 shadow-md',
    icon: 'fa-solid fa-fire-flame-curved'
  },
  delivery: {
    gradient:
      'radial-gradient(circle at 14% 50%, rgba(52, 211, 153, 0.22), transparent 48%), linear-gradient(90deg, #022c22 0%, #065f46 30%, #0f766e 66%, #134e4a 100%)',
    borderClass: 'border-b border-emerald-300/35',
    iconBox:
      'bg-gradient-to-br from-emerald-200 to-teal-300 text-emerald-950 ring-2 ring-white/30 shadow-md',
    titlePill: 'bg-white text-emerald-950 shadow-sm',
    btn: 'bg-emerald-300 hover:bg-emerald-200 text-emerald-950 ring-1 ring-emerald-100/70 shadow-md',
    icon: 'fa-solid fa-motorcycle'
  },
  info: {
    gradient:
      'radial-gradient(circle at 14% 50%, rgba(129, 140, 248, 0.25), transparent 48%), linear-gradient(90deg, #1e1b4b 0%, #3730a3 32%, #1d4ed8 68%, #4c1d95 100%)',
    borderClass: 'border-b border-indigo-300/35',
    iconBox:
      'bg-gradient-to-br from-sky-200 to-indigo-200 text-indigo-950 ring-2 ring-white/30 shadow-md',
    titlePill: 'bg-white text-indigo-950 shadow-sm',
    btn: 'bg-amber-300 hover:bg-amber-200 text-stone-950 ring-1 ring-amber-100/70 shadow-md',
    icon: 'fa-solid fa-bullhorn'
  },
  warning: {
    gradient:
      'radial-gradient(circle at 14% 50%, rgba(251, 113, 133, 0.22), transparent 48%), linear-gradient(90deg, #4c0519 0%, #9f1239 32%, #be123c 68%, #7f1d1d 100%)',
    borderClass: 'border-b border-rose-300/35',
    iconBox:
      'bg-gradient-to-br from-amber-200 to-amber-300 text-rose-950 ring-2 ring-white/30 shadow-md',
    titlePill: 'bg-white text-rose-950 shadow-sm',
    btn: 'bg-amber-300 hover:bg-amber-200 text-stone-950 ring-1 ring-amber-100/70 shadow-md',
    icon: 'fa-solid fa-triangle-exclamation'
  }
};

export default function CustomerAnnouncementBanner() {
  const dispatch = useDispatch();
  const [settings, setSettings] = useState(null);
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    try {
      const savedDismissed = sessionStorage.getItem('sd_dismissed_banner') || '';
      setDismissedKey(savedDismissed);
    } catch (e) {}

    if (typeof window !== 'undefined' && window.__sdNotificationData?.settings) {
      setSettings(window.__sdNotificationData.settings);
    } else {
      fetch('/api/notifications', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          if (j?.success && j?.data?.settings) {
            setSettings(j.data.settings);
          }
        })
        .catch(() => {});
    }

    const handleSync = (e) => {
      if (e.detail?.settings) {
        setSettings(e.detail.settings);
      }
    };

    window.addEventListener('sd_notifications_synced', handleSync);
    return () => window.removeEventListener('sd_notifications_synced', handleSync);
  }, []);

  const current = settings || DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS;
  if (!settings || current.enabled === false || current.showBanner === false) {
    return null;
  }

  const bannerSignature = `${current.bannerTitle}|${current.bannerText}`;
  if (!current.bannerTitle && !current.bannerText) return null;
  if (dismissedKey === bannerSignature) return null;

  const theme = BANNER_THEMES[current.bannerType] || BANNER_THEMES.campaign;

  const handleDismiss = () => {
    setDismissedKey(bannerSignature);
    try {
      sessionStorage.setItem('sd_dismissed_banner', bannerSignature);
    } catch (e) {}
  };

  return (
    <div
      className={`w-full text-white ${theme.borderClass} shadow-md relative z-30 overflow-hidden`}
      style={{ backgroundImage: theme.gradient }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl ${theme.iconBox} flex items-center justify-center shrink-0`}
          >
            <i className={`${theme.icon} text-xs sm:text-sm`}></i>
          </span>

          <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {current.bannerTitle && (
              <strong
                className={`${theme.titlePill} font-black tracking-tight text-[11px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shrink-0`}
              >
                {current.bannerTitle}
              </strong>
            )}
            {current.bannerText && (
              <span
                className="text-white font-semibold text-xs sm:text-[13.5px] leading-snug tracking-[0.01em]"
                style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)' }}
              >
                {current.bannerText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {current.bannerActionPage &&
            current.bannerActionPage !== 'none' &&
            current.bannerActionLabel && (
              <button
                type="button"
                onClick={() => dispatch(setActivePage(current.bannerActionPage))}
                className={`${theme.btn} font-extrabold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-98 cursor-pointer flex items-center gap-1.5`}
              >
                <span>{current.bannerActionLabel}</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Duyuruyu Kapat"
            className="w-7 h-7 rounded-full bg-black/25 hover:bg-black/40 text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

