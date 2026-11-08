'use client';

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setProducts } from '@/store/slices/productSlice';
import { login, logout } from '@/store/slices/authSlice';
import { showMessageModal, closeProfileModal, closeCheckoutModal } from '@/store/slices/uiSlice';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
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
import LiveOrderTracker from '@/components/LiveOrderTracker';
import FloatingCartBar from '@/components/FloatingCartBar';

export default function Home() {
  const dispatch = useDispatch();
  const { activePage } = useSelector((state) => state.ui);

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

        const res = await fetch(
          `/api/auth/me?email=${encodeURIComponent(u.email || '')}&id=${encodeURIComponent(u.id || '')}`
        );
        const result = await res.json();

        // ÜYE SİLİNMİŞ VEYA ENGELLENMİŞSE OTURUMU DERHAL KAPAT
        if (result && result.valid === false) {
          dispatch(logout());
          dispatch(closeProfileModal());
          dispatch(closeCheckoutModal());
          try {
            localStorage.removeItem('sd_current_user');
            localStorage.removeItem('sd_auth_token');
          } catch (e) {}

          const title = result.reason === 'blocked' ? 'Hesabınız Engellendi ⛔' : 'Oturum Kapatıldı ℹ️';
          const text =
            result.reason === 'blocked'
              ? `Hesabınız yönetici tarafından engellenmiştir. (${result.blockReason || 'Kısıtlama'})`
              : 'Hesabınız sistemden silindiği için oturumunuz otomatik olarak sonlandırıldı.';

          dispatch(
            showMessageModal({
              title,
              text,
              type: 'warning'
            })
          );
        }
      } catch (err) {
        // Çevrimdışı / geçici ağ hatası durumunda kullanıcıyı rahatsız etme
      }
    };

    try {
      const savedUser = localStorage.getItem('sd_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.email) {
          dispatch(login({ user: parsedUser }));
          // Sunucu ile hemen doğrula (silinmiş mi?)
          verifyCurrentSession(parsedUser);
        }
      }
    } catch (e) {}

    const loadProducts = () => {
      fetch('/api/products')
        .then((res) => res.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            dispatch(setProducts(res.data));
          }
        })
        .catch((err) => console.error('Ürünler yüklenirken hata:', err));
    };

    loadProducts();

    // Cross-tab real-time sync when admin changes inventory or revokes user session
    const handleStorageChange = (e) => {
      if (e.key === 'sandwich_inventory_updated') {
        loadProducts();
      }
      if (e.key === 'sandwich_session_event') {
        verifyCurrentSession();
      }
    };

    const handleWindowFocus = () => {
      loadProducts();
      verifyCurrentSession();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    // Periodic lightweight sync every 3 seconds for instant reaction
    const pollInterval = setInterval(() => {
      loadProducts();
      verifyCurrentSession();
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(pollInterval);
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Contact Bar */}
      <TopBar />

      {/* Main Navbar */}
      <Navbar />

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
      <MessageModal />
      <LiveOrderTracker />
      <FloatingCartBar />
    </div>
  );
}
