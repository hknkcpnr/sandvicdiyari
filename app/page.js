'use client';

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setProducts } from '@/store/slices/productSlice';
import { login, logout } from '@/store/slices/authSlice';
import {
  showMessageModal,
  closeProfileModal,
  closeCheckoutModal,
  setFavorites,
  setOnlyFavoritesFilter
} from '@/store/slices/uiSlice';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import {
  getBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';
import CustomerAnnouncementBanner from '@/components/CustomerAnnouncementBanner';
import Footer from '@/components/Footer';

// Customer Pages
import HomePage from '@/components/pages/HomePage';
import MenuPage from '@/components/pages/MenuPage';
import KampanyalarPage from '@/components/pages/KampanyalarPage';
import HikayePage from '@/components/pages/HikayePage';
import IletisimPage from '@/components/pages/IletisimPage';

// Modals
import OptionsModal from '@/components/modals/OptionsModal';
import CartDrawer from '@/components/modals/CartDrawer';
import AuthModal from '@/components/modals/AuthModal';
import ProfileModal from '@/components/modals/ProfileModal';
import CheckoutModal from '@/components/modals/CheckoutModal';
import MessageModal from '@/components/modals/MessageModal';
import TrackOrderModal from '@/components/modals/TrackOrderModal';
import LiveOrderTracker from '@/components/LiveOrderTracker';
import FloatingCartBar from '@/components/FloatingCartBar';
import DraggableContactButton from '@/components/DraggableContactButton';
import FloatingTrackOrderButton from '@/components/FloatingTrackOrderButton';

export default function Home() {
  const dispatch = useDispatch();
  const { activePage } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);

  // Sadece giriş yapmış üyelerin kişisel favorilerini yükle; çıkışta/ziyaretçide sıfırla
  useEffect(() => {
    if (currentUser && currentUser.email) {
      const cleanEmail = String(currentUser.email).trim().toLowerCase();
      try {
        const saved = localStorage.getItem(`sd_favorites_${cleanEmail}`);
        dispatch(setFavorites(saved ? JSON.parse(saved) : []));
      } catch (e) {
        dispatch(setFavorites([]));
      }
    } else {
      dispatch(setFavorites([]));
      dispatch(setOnlyFavoritesFilter(false));
    }
  }, [currentUser, dispatch]);

  useEffect(() => {
    // ------------------------------------------------------------------------
    // OTURUM GÜVENLİK VE AKTİFLİK DOĞRULAMASI (/api/auth/me)
    // ------------------------------------------------------------------------
    // Admin panelinden üye silinmiş veya engellenmişse oturumu anında sonlandırır.
    const verifyCurrentSession = async (userCandidate) => {
      try {
        const u = userCandidate || (() => {
          try {
            const raw = localStorage.getItem('sd_current_user');
            return raw ? JSON.parse(raw) : null;
          } catch (e) {
            return null;
          }
        })();

        if (!u || (!u.email && !u.id)) return;

        let lastOrderId = u.lastOrderId || '';
        if (!lastOrderId) {
          try {
            const rawLast = localStorage.getItem('sd_last_order');
            if (rawLast) {
              const parsedLast = JSON.parse(rawLast);
              if (parsedLast?.id) lastOrderId = String(parsedLast.id);
            }
          } catch (e) {}
        }

        const res = await fetch(
          `/api/auth/me?email=${encodeURIComponent(u.email || '')}&id=${encodeURIComponent(u.id || '')}&orderId=${encodeURIComponent(lastOrderId)}`,
          { cache: 'no-store' }
        );
        const result = await res.json();

        // ÜYE SİLİNMİŞ / ENGELLENMİŞ VEYA MİSAFİR SİPARİŞİ TESLİM EDİLMİŞ / İPTAL / SİLİNMİŞSE OTURUMU DERHAL KAPAT
        if (result && result.valid === false) {
          dispatch(logout());
          dispatch(closeProfileModal());
          dispatch(closeCheckoutModal());
          try {
            localStorage.removeItem('sd_current_user');
            localStorage.removeItem('sd_auth_token');
            if (
              result.reason === 'guest_order_delivered' ||
              result.reason === 'guest_order_cancelled' ||
              result.reason === 'guest_order_deleted'
            ) {
              localStorage.removeItem('sd_last_order');
            }
          } catch (e) {}

          const title =
            result.reason === 'guest_order_delivered'
              ? 'Siparişiniz Teslim Edildi 🎉'
              : result.reason === 'guest_order_cancelled' || result.reason === 'guest_order_deleted'
              ? 'Siparişiniz İptal Edilmiştir'
              : result.reason === 'blocked'
              ? 'Hesabınız Engellendi ⛔'
              : 'Oturum Kapatıldı ℹ️';
          const text =
            result.reason === 'guest_order_delivered'
              ? 'Afiyet olsun! Siparişiniz teslim edildiği için misafir oturumunuz güvenlik amacıyla otomatik olarak sonlandırıldı.'
              : result.reason === 'guest_order_cancelled' || result.reason === 'guest_order_deleted'
              ? 'Siparişiniz iptal edildiği için misafir oturumunuz otomatik olarak sonlandırıldı.'
              : result.reason === 'blocked'
              ? `Hesabınız yönetici tarafından engellenmiştir. (${result.blockReason || 'Kısıtlama'})`
              : 'Hesabınız sistemden silindiği için oturumunuz otomatik olarak sonlandırıldı.';

          dispatch(
            showMessageModal({
              title,
              text,
              type: result.reason === 'guest_order_delivered' ? 'success' : 'warning'
            })
          );
        }
      } catch (err) {
        // Çevrimdışı / geçici ağ hatası durumunda kullanıcıyı rahatsız etme
      }
    };

    try {
      const savedUser = localStorage.getItem('sd_current_user');
      const expiresAtRaw = localStorage.getItem('sd_current_user_expires_at');
      if (savedUser) {
        const expiresAt = Number(expiresAtRaw || 0);
        // 2 saatlik müşteri oturum süresi dolduysa (veya eski süresiz kayıtsa) oturumu kapat
        if (!expiresAt || Date.now() > expiresAt) {
          localStorage.removeItem('sd_current_user');
          localStorage.removeItem('sd_auth_token');
          localStorage.removeItem('sd_current_user_expires_at');
          dispatch(logout());
        } else {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.email) {
            dispatch(login({ user: parsedUser, preserveExpiry: true }));
            // Sunucu ile hemen doğrula (silinmiş mi?)
            verifyCurrentSession(parsedUser);
          }
        }
      }
    } catch (e) {}

    // Müşteri sayfası açıkken 2 saat dolduğunda otomatik oturum sonlandırma
    const sessionExpiryTimer = setInterval(() => {
      try {
        const hasUser = localStorage.getItem('sd_current_user');
        if (!hasUser) return;
        const expiresAt = Number(localStorage.getItem('sd_current_user_expires_at') || 0);
        if (!expiresAt || Date.now() > expiresAt) {
          dispatch(logout());
          dispatch(
            showMessageModal({
              title: 'Oturum Süresi Doldu',
              text: 'Güvenliğiniz gereği 2 saatlik oturum süreniz sona erdi. Sipariş vermeye devam etmek için tekrar giriş yapabilirsiniz.',
              type: 'info',
            })
          );
        }
      } catch {}
    }, 30000);

    const loadProducts = (force = false) => {
      const cached = getBrowserCache('products_public');
      if (!force && cached?.data && Array.isArray(cached.data)) {
        dispatch(setProducts(cached.data));
        if (!isBrowserCacheStale('products_public', CACHE_TTL_LONG)) {
          return;
        }
      }

      fetchWithBrowserCache('products_public', '/api/products', {
        force: force === true,
        maxAgeMs: CACHE_TTL_LONG,
        persist: true,
        extract: (res) => res.data
      })
        .then((res) => {
          if (res.ok && Array.isArray(res.data)) {
            dispatch(setProducts(res.data));
          }
        })
        .catch((err) => console.error('Ürünler yüklenirken hata:', err));
    };

    loadProducts(false);

    // Günlük tekil cihaz ziyaretçi sayacı (Aynı cihaz aynı gün içinde yalnızca 1 kez sayılır)
    try {
      const todayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      let deviceId = localStorage.getItem('sd_device_id');
      if (!deviceId) {
        deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('sd_device_id', deviceId);
      }

      const lastVisitDay = localStorage.getItem('sd_last_visit_day');
      if (lastVisitDay !== todayKey) {
        fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId })
        })
          .then((r) => r.json())
          .then((j) => {
            if (j?.success) {
              try {
                localStorage.setItem('sd_last_visit_day', todayKey);
              } catch {}
            }
          })
          .catch(() => {});
      }
    } catch {}

    // Cross-tab real-time sync when admin changes inventory or revokes user session
    const handleStorageChange = (e) => {
      if (e.key === 'sandwich_inventory_updated') {
        loadProducts(true);
      }
      if (e.key === 'sandwich_session_event') {
        verifyCurrentSession();
      }
    };

    const handleWindowFocus = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadProducts(false);
      verifyCurrentSession();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', handleWindowFocus);

    // Akıllı ve kaynak tasarruflu senkronizasyon:
    // Sadece sekme aktif ve görünür durumdayken 45 saniyede bir kontrol (önbellek 2 dk tazeyse ağa gitmez)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadProducts(false);
        verifyCurrentSession();
      }
    }, 45000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleWindowFocus);
      clearInterval(pollInterval);
      clearInterval(sessionExpiryTimer);
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Contact Bar */}
      <TopBar />

      {/* Main Navbar */}
      <Navbar />

      {/* Live Customer Announcement Banner (Managed via Admin Notification Settings) */}
      <CustomerAnnouncementBanner />

      {/* Active Customer Page View */}
      <main className="flex-grow">
        {activePage === 'home' && <HomePage />}
        {activePage === 'menu' && <MenuPage />}
        {activePage === 'kampanyalar' && <KampanyalarPage />}
        {activePage === 'hikaye' && <HikayePage />}
        {activePage === 'iletisim' && <IletisimPage />}
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Interactive Global Modals */}
      <OptionsModal />
      <CartDrawer />
      <AuthModal />
      <ProfileModal />
      <CheckoutModal />
      <TrackOrderModal />
      <MessageModal />
      <LiveOrderTracker />
      <FloatingCartBar />
      <FloatingTrackOrderButton />
      {!currentUser && <DraggableContactButton />}
    </div>
  );
}
