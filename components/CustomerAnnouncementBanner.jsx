'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setActivePage } from '@/store/slices/uiSlice';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';

const BANNER_THEMES = {
  campaign: {
    bar: 'bg-gradient-to-r from-amber-500 via-orange-500 to-brand-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    btn: 'bg-white text-brand-700 hover:bg-amber-50',
    icon: 'fa-solid fa-fire-flame-curved'
  },
  delivery: {
    bar: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    btn: 'bg-white text-emerald-800 hover:bg-emerald-50',
    icon: 'fa-solid fa-motorcycle'
  },
  info: {
    bar: 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    btn: 'bg-white text-indigo-800 hover:bg-indigo-50',
    icon: 'fa-solid fa-bullhorn'
  },
  warning: {
    bar: 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    btn: 'bg-white text-rose-800 hover:bg-rose-50',
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
    <div className={`w-full ${theme.bar} shadow-sm relative z-30`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={`w-6 h-6 rounded-lg border ${theme.badge} flex items-center justify-center shrink-0`}
          >
            <i className={`${theme.icon} text-[11px]`}></i>
          </span>
          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {current.bannerTitle && (
              <strong className="font-extrabold tracking-tight">{current.bannerTitle}</strong>
            )}
            {current.bannerText && (
              <span className="opacity-95 truncate sm:whitespace-normal">{current.bannerText}</span>
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
                className={`${theme.btn} font-extrabold text-[11px] px-3 py-1 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1`}
              >
                <span>{current.bannerActionLabel}</span>
                <i className="fa-solid fa-arrow-right text-[9px]"></i>
              </button>
            )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Duyuruyu Kapat"
            className="w-6 h-6 rounded-lg hover:bg-black/15 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

