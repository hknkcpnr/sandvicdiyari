'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActivePage, openProfileModal } from '@/store/slices/uiSlice';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';

function formatRelativeTime(isoStr) {
  if (!isoStr) return '';
  const diffMs = Date.now() - new Date(isoStr).getTime();
  if (Number.isNaN(diffMs) || diffMs < 45 * 1000) return 'Az önce';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Date(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function playGentleCustomerChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.14);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {}
}

const TYPE_STYLES = {
  order: {
    icon: 'fa-solid fa-motorcycle',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    badge: 'Sipariş',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  personal: {
    icon: 'fa-solid fa-envelope-open-text',
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    badge: 'Size Özel',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  campaign: {
    icon: 'fa-solid fa-gift',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    badge: 'Kampanya',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  info: {
    icon: 'fa-solid fa-bullhorn',
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    badge: 'Duyuru',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200'
  },
  warning: {
    icon: 'fa-solid fa-circle-exclamation',
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    badge: 'Önemli',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  }
};

export default function CustomerNotificationBell() {
  const dispatch = useDispatch();
  const { currentUser } = useSelector((state) => state.auth);

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'personal' | 'campaign'
  const [settings, setSettings] = useState(DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS);
  const [notifications, setNotifications] = useState([]);
  const [seenIds, setSeenIds] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  const dropdownRef = useRef(null);
  const knownIdsRef = useRef(new Set());
  const initialLoadedRef = useRef(false);
  const prevUserRef = useRef(null);

  // Oturum kapandığında (özellikle misafir oturumu sonlandığında) bildirimleri ve toast'u anında temizle
  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = currentUser;

    if (prevUser && !currentUser) {
      setNotifications([]);
      setActiveToast(null);
      setIsOpen(false);
      knownIdsRef.current.clear();
      initialLoadedRef.current = false;
      try {
        localStorage.removeItem('sd_seen_notifications');
      } catch (e) {}
    }
  }, [currentUser]);

  // Yerel okundu listesini yükle
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sd_seen_notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSeenIds(parsed);
      }
    } catch (e) {}
  }, []);

  const persistSeenIds = (nextIds) => {
    setSeenIds(nextIds);
    try {
      localStorage.setItem('sd_seen_notifications', JSON.stringify(nextIds.slice(-150)));
    } catch (e) {}
  };

  // Dışarı tıklanınca açılır paneli kapat
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (currentUser?.email) q.set('email', currentUser.email);
      if (currentUser?.id) q.set('id', currentUser.id);

      // Misafir olarak sipariş verildiyse (currentUser boş olsa bile) son siparişten takip et
      let hasLastOrder = false;
      try {
        const lastRaw = localStorage.getItem('sd_last_order');
        if (lastRaw) {
          const lastOrder = JSON.parse(lastRaw);
          if (lastOrder?.id && lastOrder.status !== 'Teslim Edildi' && lastOrder.status !== 'İptal Edildi') {
            hasLastOrder = true;
            q.set('orderId', String(lastOrder.id));
            if (!currentUser?.email && lastOrder?.userEmail) {
              q.set('email', String(lastOrder.userEmail));
            }
          }
        }
      } catch (e) {}

      // Aktif oturum veya takip edilen sipariş yoksa gereksiz bildirim çekme/gösterme
      if (!currentUser && !hasLastOrder) {
        setNotifications([]);
        setActiveToast(null);
        return;
      }

      const res = await fetch(`/api/notifications?${q.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json?.success || !json?.data) return;

      const nextSettings = json.data.settings || DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS;
      const nextList = Array.isArray(json.data.notifications) ? json.data.notifications : [];

      setSettings(nextSettings);
      setNotifications(nextList);

      // Sayfa içi duyuru bandı ve profil modalı ile senkronize et
      if (typeof window !== 'undefined') {
        window.__sdNotificationData = { settings: nextSettings, notifications: nextList };
        window.dispatchEvent(
          new CustomEvent('sd_notifications_synced', {
            detail: { settings: nextSettings, notifications: nextList }
          })
        );
      }

      // İlk yüklemeden sonra yeni düşen bildirim varsa anlık Toast & Ses tetikle
      if (!initialLoadedRef.current) {
        if (Array.isArray(nextList)) {
          nextList.forEach((n) => {
            if (n && n.id) knownIdsRef.current.add(n.id);
          });
        }
        initialLoadedRef.current = true;
      } else {
        const brandNew = Array.isArray(nextList)
          ? nextList.find((n) => n && n.id && !knownIdsRef.current.has(n.id))
          : null;
        if (Array.isArray(nextList)) {
          nextList.forEach((n) => {
            if (n && n.id) knownIdsRef.current.add(n.id);
          });
        }

        if (brandNew && nextSettings.enabled !== false && nextSettings.toastEnabled !== false) {
          setActiveToast(brandNew);
          if (nextSettings.soundEnabled !== false) {
            playGentleCustomerChime();
          }
        }
      }
    } catch (e) {}
  }, [currentUser?.email, currentUser?.id]);

  useEffect(() => {
    fetchNotifications();

    const handleStorage = (e) => {
      if (e.key === 'sandwich_notifications_updated' || e.key === 'sd_last_order') {
        fetchNotifications();
      }
    };
    const handleFocus = () => fetchNotifications();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('sd_order_created', handleFocus);
    window.addEventListener('sd_order_updated', handleFocus);

    const timer = setInterval(fetchNotifications, 5000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('sd_order_created', handleFocus);
      window.removeEventListener('sd_order_updated', handleFocus);
      clearInterval(timer);
    };
  }, [fetchNotifications]);

  // Toast otomatik kapanma (6 sn)
  useEffect(() => {
    if (!activeToast) return;
    const t = setTimeout(() => setActiveToast(null), 6000);
    return () => clearTimeout(t);
  }, [activeToast]);

  const isUnread = useCallback(
    (n) => {
      if (seenIds.includes(n.id)) return false;
      if (n.scope === 'personal') return n.read !== true;
      return true;
    },
    [seenIds]
  );

  const unreadCount = useMemo(
    () => (Array.isArray(notifications) ? notifications.filter((n) => isUnread(n)).length : 0),
    [notifications, isUnread]
  );

  const filteredList = useMemo(() => {
    if (!Array.isArray(notifications)) return [];
    if (filterTab === 'personal') {
      return notifications.filter((n) => n?.scope === 'personal' || n?.scope === 'order');
    }
    if (filterTab === 'campaign') {
      return notifications.filter((n) => n?.scope === 'broadcast');
    }
    return notifications;
  }, [notifications, filterTab]);

  const handleMarkAllRead = async () => {
    const safeSeen = Array.isArray(seenIds) ? seenIds : [];
    const safeNotifs = Array.isArray(notifications) ? notifications : [];
    const allIds = Array.from(new Set([...safeSeen, ...safeNotifs.map((n) => n?.id).filter(Boolean)]));
    persistSeenIds(allIds);
    setNotifications((prev) => (Array.isArray(prev) ? prev.map((n) => ({ ...n, read: true })) : []));

    if (currentUser?.email || currentUser?.id) {
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_all_read',
            email: currentUser.email,
            id: currentUser.id
          })
        });
      } catch (e) {}
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!seenIds.includes(notif.id)) {
      persistSeenIds([...seenIds, notif.id]);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );

    if (notif.scope === 'personal' && (currentUser?.email || currentUser?.id)) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          email: currentUser.email,
          id: currentUser.id,
          notificationId: notif.id
        })
      }).catch(() => {});
    }

    setIsOpen(false);
    setActiveToast(null);

    if (notif.targetPage === 'profile_orders' || notif.scope === 'order') {
      if (currentUser) {
        dispatch(openProfileModal());
      }
    } else if (
      notif.targetPage &&
      ['home', 'menu', 'kampanyalar', 'hikaye', 'iletisim'].includes(notif.targetPage)
    ) {
      dispatch(setActivePage(notif.targetPage));
    } else if (notif.type === 'campaign') {
      dispatch(setActivePage('kampanyalar'));
    }
  };

  if (settings.enabled === false) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* ZİL BUTONU (Mobilde Zarif & Minimal, Masaüstünde Ferah) */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Bildirimler"
          title="Bildirimler ve Duyurular"
          className={`relative p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all border cursor-pointer flex items-center justify-center ${
            isOpen
              ? 'bg-brand-500 text-white border-brand-600 shadow-md ring-2 ring-brand-500/20'
              : unreadCount > 0
              ? 'bg-amber-50 hover:bg-amber-100 text-brand-700 border-amber-200 shadow-xs'
              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
          }`}
        >
          <i
            className={`fa-solid fa-bell text-sm sm:text-lg transition-transform ${
              unreadCount > 0 && !isOpen ? 'animate-bounce' : ''
            }`}
          ></i>

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 bg-rose-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* AÇILIR BİLDİRİM MERKEZİ PANELİ (%100 OPAK BEYAZ) */}
        {isOpen && (
          <div
            style={{ backgroundColor: '#ffffff' }}
            className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-96 bg-white rounded-2xl shadow-[0_22px_55px_rgba(15,23,42,0.24)] ring-1 ring-stone-900/5 border border-stone-200 z-50 animate-dropdown overflow-hidden"
          >
            {/* Üst Başlık */}
            <div className="px-4 py-3.5 bg-gradient-to-r from-stone-50 via-white to-amber-50/70 border-b border-stone-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center text-xs shadow-sm shrink-0">
                  <i className="fa-solid fa-bell"></i>
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-tight flex items-center gap-1.5 select-none">
                    <span>Bildirimler</span>
                    {unreadCount > 0 && (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {unreadCount} Yeni
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Sipariş durumları, kampanyalar ve size özel mesajlar
                  </p>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Tümünü Oku
                </button>
              )}
            </div>

            {/* Kategori Sekmeleri */}
            <div className="px-3 pt-2.5 pb-2 bg-white border-b border-stone-100 flex items-center gap-1.5">
              {[
                { id: 'all', label: 'Tümü' },
                { id: 'personal', label: 'Sipariş & Özel' },
                { id: 'campaign', label: 'Kampanyalar' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bildirim Listesi */}
            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 bg-white dropdown-scroll">
              {filteredList.length === 0 ? (
                <div className="py-10 px-6 text-center bg-white space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto text-lg">
                    <i className="fa-regular fa-bell-slash"></i>
                  </div>
                  <p className="text-xs font-bold text-stone-700">Henüz bildirim bulunmuyor</p>
                  <p className="text-[11px] text-stone-400">
                    Yeni kampanyalar ve sipariş güncellemeleri burada listelenir.
                  </p>
                </div>
              ) : (
                filteredList.map((notif) => {
                  const unread = isUnread(notif);
                  const style = TYPE_STYLES[notif.type] || TYPE_STYLES.info;

                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                        unread ? 'bg-amber-50/45 hover:bg-amber-50/80' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl ${style.bg} ${style.text} flex items-center justify-center text-sm shrink-0 mt-0.5`}
                      >
                        <i className={style.icon}></i>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.badgeClass}`}
                          >
                            {style.badge}
                          </span>
                          <span className="text-[10px] font-medium text-stone-400 shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <p
                          className={`text-xs leading-snug ${
                            unread ? 'font-extrabold text-stone-900' : 'font-bold text-stone-700'
                          }`}
                        >
                          {notif.title}
                        </p>

                        <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-3">
                          {notif.message}
                        </p>
                      </div>

                      {unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-500 shrink-0 mt-2 ring-4 ring-brand-500/15"></span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Alt Çubuk */}
            {currentUser && (
              <div className="px-3 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-stone-500 truncate">
                  {currentUser.name} olarak oturum açık
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    dispatch(openProfileModal());
                  }}
                  className="text-[11px] font-bold text-stone-700 hover:text-brand-600 cursor-pointer flex items-center gap-1"
                >
                  <span>Profil &amp; Siparişler</span>
                  <i className="fa-solid fa-chevron-right text-[9px]"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ANLIK CANLI BİLDİRİM BALONU (TOAST) */}
      {activeToast && (
        <div
          style={{ backgroundColor: '#ffffff' }}
          className="fixed top-24 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.25)] border-2 border-brand-400 p-4 animate-dropdown"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white flex items-center justify-center text-base shadow-sm shrink-0">
              <i className="fa-solid fa-bell"></i>
            </div>
            <div
              onClick={() => handleNotificationClick(activeToast)}
              className="min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-600">
                  Yeni Bildirim
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 mt-0.5">
                {activeToast.title}
              </h4>
              <p className="text-xs text-stone-600 mt-0.5 line-clamp-2 leading-relaxed">
                {activeToast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 cursor-pointer shrink-0"
              aria-label="Kapat"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

